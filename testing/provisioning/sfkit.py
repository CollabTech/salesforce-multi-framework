"""Shared helpers for the SMF-3 provisioning scripts (standard library only).

Rules enforced here (AGENTS.md §5, smf-salesforce-boundaries):
- every org command gets an explicit --target-org; there is no default-org fallback;
- org identity is verified before any write, and the Dev Hub is refused as a test org unless
  the caller passes the recorded fallback decision flag;
- raw CLI output (usernames, record/org IDs) is written only under private/ (git-ignored);
  anything printed goes through redact() first.
"""
import datetime, json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROV = Path(__file__).resolve().parent
PRIVATE = ROOT / "private"
PRIVATE_SMF3 = PRIVATE / "smf3"

PERSONAS = ("MF-TECH", "MF-SUPPORT", "MF-RESTRICTED")   # business personas created by SMF-3
# 15/18-character alphanumeric tokens containing both letters and digits (Salesforce ID shape)
ID_RX = re.compile(r"\b(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])(?:[A-Za-z0-9]{18}|[A-Za-z0-9]{15})\b")
EMAIL_RX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")


class SfError(RuntimeError):
    pass


def now():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def redact(text):
    """Mask anything shaped like a Salesforce ID or an e-mail/username before printing."""
    text = EMAIL_RX.sub("<redacted-username>", str(text))
    return ID_RX.sub("<redacted-id>", text)


def say(*parts):
    print(redact(" ".join(str(p) for p in parts)), flush=True)


def sf_exe():
    exe = shutil.which("sf") or shutil.which("sf.cmd")
    if not exe:
        raise SfError("Salesforce CLI 'sf' not found on PATH")
    return exe


def sf(args, target_org, check=True):
    """Run `sf <args> --json --target-org <alias>` and return the parsed JSON."""
    if not target_org:
        raise SfError("refusing to run an org command without an explicit --target-org")
    os.environ.setdefault("SF_DISABLE_TELEMETRY", "true")
    cmd = [sf_exe(), *args, "--json", "--target-org", target_org]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=ROOT)
    try:
        out = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        out = {"status": r.returncode or 1, "message": (r.stderr or r.stdout)[-500:]}
    if check and out.get("status", r.returncode) != 0:
        raise SfError(f"sf {' '.join(args[:3])} failed: {out.get('name', '')} {out.get('message', '')}".strip())
    return out


def query(target_org, soql, tooling=False):
    args = ["data", "query", "--query", soql] + (["--use-tooling-api"] if tooling else [])
    return sf(args, target_org)["result"]["records"]


def soql_str(s):
    return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'"


def write_private(rel, obj, mode=0o600):
    p = PRIVATE / rel
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, indent=2, default=str) + "\n", encoding="utf-8")
    try:
        os.chmod(p, mode)
    except OSError:
        pass
    return p


def read_private(rel, default=None):
    p = PRIVATE / rel
    return json.loads(p.read_text(encoding="utf-8")) if p.exists() else default


def verify_target(target_org, allow_devhub=False):
    """Read-only identity check before any write. Returns a sanitized identity dict."""
    disp = sf(["org", "display"], target_org)["result"]
    org = query(target_org, "SELECT OrganizationType, IsSandbox, InstanceName, LanguageLocaleKey FROM Organization")[0]
    is_hub = sf(["data", "query", "--query", "SELECT Id FROM ScratchOrgInfo LIMIT 1"], target_org, check=False).get("status") == 0
    ident = {"edition": org["OrganizationType"], "sandbox": org["IsSandbox"], "instance": org["InstanceName"],
             "language": org["LanguageLocaleKey"], "api_version": disp.get("apiVersion"),
             "is_scratch": bool(disp.get("devHubId") or disp.get("expirationDate")), "is_devhub": is_hub}
    # `sf org display` reports the ORG id as "id"; the running user's own Id is resolved here so
    # ownership checks compare user Ids (an org id never matches OwnerId; see running_user).
    me = query(target_org, f"SELECT Id FROM User WHERE Username = {soql_str(disp['username'])}")
    disp["userId"] = me[0]["Id"] if me else None
    write_private(f"smf3/org-display-{target_org}.json", {"display": disp, "organization": org, "checked": now()})
    if is_hub and not allow_devhub:
        raise SfError("target org is a Dev Hub. The Dev Hub is not the application test org (SMF-2 ENV-03). "
                      "Use the smf-dev scratch org, or pass --allow-devhub-as-dev only after recording the "
                      "SMF-2 fallback decision (docs/smf-2/setup-path.md).")
    return ident, disp


def running_user(disp):
    """(username, User Id) of the CLI user. Never disp["id"]: that is the org id."""
    return disp.get("username"), disp.get("userId")


def apex(target_org, file_path):
    """Run an anonymous Apex file; return (success, MF-* debug lines). Raw log stays private."""
    out = sf(["apex", "run", "--file", str(file_path)], target_org, check=False)
    res = out.get("result") or {}
    stamp = now().replace(":", "")
    write_private(f"smf3/apex-{Path(file_path).stem}-{stamp}.json", out)
    lines = [m.group(1).strip() for m in re.finditer(r"USER_DEBUG\|\[\d+\]\|DEBUG\|(MF\|[^\n]*)", res.get("logs", "") or "")]
    ok = bool(res.get("success")) and bool(res.get("compiled"))
    if not ok:
        problem = res.get("compileProblem") or res.get("exceptionMessage") or out.get("message", "")
        lines.append(f"MF|ERROR|{problem}")
    return ok, lines


def git_commit():
    r = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT, capture_output=True, text=True)
    return r.stdout.strip() or "unknown"


def exit_blocked(msg):
    say(f"BLOCKED: {msg}")
    sys.exit(3)
