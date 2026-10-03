#!/usr/bin/env python3
"""SMF-5 cloud packaging flow used by pipeline stages 60-64 (docs/smf-5/subscriber-runbook.md).

  pkgflow.py preflight                 Dev Hub reachable, unlocked 2GP on, subscriber reachable
  pkgflow.py version v1|v2             create the package if absent, then a validated version
                                       built from HEAD (+ set_version.py v2 for v2) in a
                                       throw-away git worktree under private/; idempotent via
                                       the version tag smf5-<label>-<sha>
  pkgflow.py install v1|v2             install (v1) or upgrade (v2) into smf-install-test
  pkgflow.py access                    assign FieldSupport_Access to the subscriber personas
  pkgflow.py state <label>             seeded-state snapshot + FieldSupport_Access count
  pkgflow.py verify-state <a> <b>      compare two snapshots; personas still see MF-CASE-001

Exit 0 = done, 2 = BLOCKED (reason printed), other = failure. Every org command names
--target-dev-hub smf-devhub or --target-org smf-install-test[-<persona>]. Package/request
IDs live only in private/packages.json and private/smf5/*.json; evidence gets sanitized
reports (sanitize_report.py). The package is rediscovered from the Dev Hub on each run, so
a fresh container needs no saved IDs.
"""
import json, os, re, shutil, subprocess, sys, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import sanitize_report  # noqa: E402
import state_snapshot  # noqa: E402

DEVHUB, SUB = "smf-devhub", "smf-install-test"
PERSONAS = ("tech", "support", "restricted")
PKG = "FieldSupportPoC"
PRIVATE = ROOT / "private"
PDIR = PRIVATE / "smf5"
REPORTS = ROOT / "evidence" / "SMF-5" / "reports"
VERSION_PREFIX = {"v1": "1.0.0", "v2": "1.1.0"}


class Blocked(Exception):
    pass


def sf(*args, cwd=ROOT, check=True):
    exe = os.environ.get("SF_BIN") or shutil.which("sf") or "sf"
    r = subprocess.run([exe, *args, "--json"], cwd=cwd, capture_output=True, text=True,
                       env={**os.environ, "SF_DISABLE_TELEMETRY": "true"})
    try:
        data = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        data = {"status": r.returncode or 1, "message": "non-JSON output"}
    if check and data.get("status", r.returncode) != 0:
        raise RuntimeError(f"sf {' '.join(args[:3])}: {sanitize_report.scrub_text(str(data.get('message', '')))[:400]}")
    return data


def git(*args, cwd=ROOT):
    return subprocess.run(["git", *args], cwd=cwd, capture_output=True, text=True, check=True).stdout.strip()


def save_private(name: str, data) -> None:
    PDIR.mkdir(parents=True, exist_ok=True)
    (PDIR / name).write_text(json.dumps(data, indent=2), encoding="utf-8")


def publish(name: str, data) -> None:
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / name).write_text(json.dumps(sanitize_report.sanitize(data), indent=2, sort_keys=True) + "\n",
                                encoding="utf-8")
    print(f"report: evidence/SMF-5/reports/{name}")


def ledger(update=None) -> dict:
    p = PRIVATE / "packages.json"
    d = json.loads(p.read_text(encoding="utf-8")) if p.exists() else {}
    if update:
        update(d)
        PRIVATE.mkdir(exist_ok=True)
        p.write_text(json.dumps(d, indent=2), encoding="utf-8")
    return d


# ---- pure helpers (unit-tested) -------------------------------------------------------
def version_tag(label: str, sha: str) -> str:
    return f"smf5-{label}-{sha[:12]}"


def pick_version(versions: list, label: str, tag: str):
    """Latest validated version for this label and source tag, or None."""
    prefix = VERSION_PREFIX[label] + "."
    hits = [v for v in versions if str(v.get("Version", "")).startswith(prefix) and v.get("Tag") == tag
            and not v.get("ValidationSkipped")]
    return max(hits, key=lambda v: int(str(v["Version"]).split(".")[3])) if hits else None


def installed_version(installed: list):
    for p in installed:
        if p.get("SubscriberPackageName") == PKG:
            return p
    return None


def same_id(a: str, b: str) -> bool:
    return bool(a) and bool(b) and a[:15] == b[:15]


def is_beta_upgrade_refusal(message: str) -> bool:
    return bool(re.search(r"(?i)beta", message or "")) and bool(re.search(r"(?i)upgrade", message or ""))


# ---- stages ---------------------------------------------------------------------------
def preflight() -> None:
    if sf("org", "display", "--target-org", DEVHUB, check=False).get("status") != 0:
        raise Blocked("Dev Hub alias smf-devhub not authenticated (HUMAN-SETUP H1/H2)")
    q = sf("data", "query", "--use-tooling-api", "--query", "SELECT Id FROM Package2 LIMIT 1",
           "--target-org", DEVHUB, check=False)
    if q.get("status") != 0:
        raise Blocked("unlocked/2GP packaging is OFF on smf-devhub: Setup -> Dev Hub -> 'Enable Unlocked Packages "
                      "and Second-Generation Managed Packages' (no CLI equivalent; HUMAN-SETUP H3 consent)")
    if sf("org", "display", "--target-org", SUB, check=False).get("status") != 0:
        raise Blocked("subscriber alias smf-install-test missing (stage 20)")
    print("preflight OK: Dev Hub, 2GP, subscriber reachable")


def package_id() -> str:
    for p in sf("package", "list", "--target-dev-hub", DEVHUB)["result"]:
        if p.get("Name") == PKG:
            return p["Id"]
    return ""


def build_tree(label: str):
    """Throw-away worktree of HEAD (+ v2 marker), built and checked. Returns (path, sha, tag)."""
    sha = git("rev-parse", "HEAD")
    if git("status", "--porcelain", "--untracked-files=all", "--", "force-app", "sfdx-project.json", "scripts/smf5"):
        raise RuntimeError("working tree has uncommitted tracked changes: versions must map to a commit")
    wt = PDIR / f"build-{label}"
    if wt.exists():
        subprocess.run(["git", "worktree", "remove", "--force", str(wt)], cwd=ROOT, capture_output=True)
    PDIR.mkdir(parents=True, exist_ok=True)
    git("worktree", "add", "--detach", str(wt), sha)
    subprocess.run([sys.executable, "scripts/smf5/set_version.py", label], cwd=wt, check=True)
    b = wt / "force-app/main/default/uiBundles/FieldSupport"
    build_id = sha[:7] + ("" if label == "v1" else "+v2")
    for cmd in (["npm", "ci", "--no-audit", "--no-fund"], ["npm", "run", "lint"], ["npx", "vitest", "run"], ["npm", "run", "build"]):
        subprocess.run(cmd, cwd=b, check=True, env={**os.environ, "VITE_BUILD_COMMIT": build_id},
                       stdout=subprocess.DEVNULL)
    subprocess.run([sys.executable, "scripts/smf5/check_package.py", "--built"], cwd=wt, check=True)
    return wt, sha, version_tag(label, sha)


def version(label: str) -> None:
    pid = package_id()
    if not pid:
        wt, _, _ = build_tree(label)
        out = sf("package", "create", "--name", PKG, "--package-type", "Unlocked", "--org-dependent",
                 "--no-namespace", "--path", "force-app", "--description",
                 "SMF-5 Field Support PoC (FieldSupport UI bundle)", "--target-dev-hub", DEVHUB, cwd=wt)
        save_private("package-create.json", out)
        pid = out["result"]["Id"]
        print("package created")
    ledger(lambda d: d.update(package={"name": PKG, "id": pid}))
    sha = git("rev-parse", "HEAD")
    tag = version_tag(label, sha)
    versions = sf("package", "version", "list", "--packages", pid, "--verbose", "--target-dev-hub", DEVHUB)["result"]
    hit = pick_version(versions, label, tag)
    if hit:
        print(f"{label}: version {hit['Version']} for this commit already exists; reused")
    else:
        wt, sha, tag = build_tree(label)
        pj = wt / "sfdx-project.json"  # aliases only in the throw-away worktree, never committed
        proj = json.loads(pj.read_text(encoding="utf-8"))
        proj.setdefault("packageAliases", {})[PKG] = pid
        pj.write_text(json.dumps(proj, indent=2), encoding="utf-8")
        sub = sf("package", "version", "create", "--package", PKG, "--path", "force-app", "--installation-key-bypass",
                 "--code-coverage", "--tag", tag, "--target-dev-hub", DEVHUB, cwd=wt)
        req = sub["result"]["Id"]
        ledger(lambda d: d.setdefault("versions", {}).setdefault(label, {}).update(request=req, commit=sha, tag=tag))
        deadline = time.time() + 90 * 60
        while True:
            rep = sf("package", "version", "create", "report", "-i", req, "--target-dev-hub", DEVHUB, cwd=wt)
            st = rep["result"][0]["Status"]
            print(f"{label}: version create status {st}")
            if st in ("Success", "Error") or time.time() > deadline:
                break
            time.sleep(30)
        save_private(f"{label}-create-report.json", rep)
        publish(f"{label}-create-report.json", rep)
        if st != "Success":
            raise RuntimeError(f"{label}: version create {st}: see evidence/SMF-5/reports/{label}-create-report.json")
        subprocess.run(["git", "worktree", "remove", "--force", str(wt)], cwd=ROOT, capture_output=True)
        versions = sf("package", "version", "list", "--packages", pid, "--verbose", "--target-dev-hub", DEVHUB)["result"]
        hit = pick_version(versions, label, tag)
        if not hit:
            raise RuntimeError(f"{label}: created version not listed yet; rerun stage")
    vid = hit["SubscriberPackageVersionId"]
    ledger(lambda d: d.setdefault("versions", {}).setdefault(label, {}).update(id=vid, number=hit["Version"], tag=tag))
    rep = sf("package", "version", "report", "--package", vid, "--target-dev-hub", DEVHUB)
    save_private(f"{label}-version-report.json", rep)
    publish(f"{label}-version-report.json", rep)


def install(label: str) -> None:
    vid = ledger().get("versions", {}).get(label, {}).get("id")
    if not vid:
        raise Blocked(f"no {label} version recorded: run the version stage first")
    cur = installed_version(sf("package", "installed", "list", "--target-org", SUB)["result"])
    if cur and same_id(cur.get("SubscriberPackageVersionId", ""), vid):
        print(f"{label} already installed ({cur.get('SubscriberPackageVersionNumber')})")
    else:
        if label == "v2" and not cur:
            raise Blocked("v1 is not installed in smf-install-test: PKG-02 needs an upgrade over v1 (stage 61)")
        args = ["package", "install", "--package", vid, "--target-org", SUB, "--security-type", "AdminsOnly",
                "--wait", "20", "--publish-wait", "10", "--no-prompt"]
        if label == "v2":
            args += ["--upgrade-type", "Mixed"]
        out = sf(*args, check=False)
        save_private(f"install-{label}.json", out)
        publish(f"install-{label}.json", out)
        if out.get("status") != 0 and label == "v2" and is_beta_upgrade_refusal(str(out.get("message", ""))):
            if os.environ.get("SMF_PKG_PROMOTE_OK") != "yes":
                raise Blocked("upgrade refused for a beta v1 (C-SMF5-2). Promoting v1 is irreversible: set "
                              "SMF_PKG_PROMOTE_OK=yes only with the owner's recorded approval, then rerun")
            v1 = ledger()["versions"]["v1"]["id"]
            save_private("promote-v1.json", sf("package", "version", "promote", "--package", v1, "--no-prompt",
                                               "--target-dev-hub", DEVHUB))
            print("v1 promoted (owner-approved); retrying upgrade")
            out = sf(*args, check=False)
            save_private("install-v2-retry.json", out)
            publish("install-v2-retry.json", out)
        if out.get("status") != 0:
            raise RuntimeError(f"install {label} failed: see evidence/SMF-5/reports/install-{label}*.json")
        deadline = time.time() + 15 * 60  # --wait can exit 0 while IN_PROGRESS (skill)
        while True:
            cur = installed_version(sf("package", "installed", "list", "--target-org", SUB)["result"])
            if cur and same_id(cur.get("SubscriberPackageVersionId", ""), vid):
                break
            if time.time() > deadline:
                raise RuntimeError(f"{label} not listed as installed after 15 min")
            time.sleep(30)
    lst = sf("package", "installed", "list", "--target-org", SUB)
    save_private(f"installed-after-{label}.json", lst)
    publish(f"installed-after-{label}.json", lst)
    print(f"installed: {cur.get('SubscriberPackageVersionNumber')}")


def persona_alias(p: str) -> str:
    return f"{SUB}-{p}"


def access() -> None:
    missing = [persona_alias(p) for p in PERSONAS if sf("org", "display", "--target-org", persona_alias(p), check=False).get("status") != 0]
    if missing:
        raise Blocked(f"subscriber persona aliases missing: {', '.join(missing)} (SMF-3 provisioning with SMF_TARGET_ORG={SUB})")
    for p in PERSONAS:
        user = sf("org", "display", "user", "--target-org", persona_alias(p))["result"]["username"]
        out = sf("org", "assign", "permset", "--name", "FieldSupport_Access", "--on-behalf-of", user, "--target-org", SUB, check=False)
        fails = [f for f in (out.get("result") or {}).get("failures", []) if "duplicate" not in str(f.get("message", "")).lower()]
        if out.get("status") not in (0, None) and fails:
            raise RuntimeError(f"assign FieldSupport_Access to MF-{p.upper()} failed")
        print(f"FieldSupport_Access: MF-{p.upper()} assigned")


def access_count() -> int:
    q = sf("data", "query", "--query", "SELECT COUNT() FROM PermissionSetAssignment "
           "WHERE PermissionSet.Name = 'FieldSupport_Access'", "--target-org", SUB)
    return int(q["result"]["totalSize"])


def state(label: str) -> None:
    fx = PRIVATE / "fixtures.json"
    if not fx.exists():
        raise Blocked("private/fixtures.json missing: SMF-3 seed has not run against smf-install-test")
    r = subprocess.run([sys.executable, "scripts/smf5/state_snapshot.py", "snapshot", "--target-org", SUB,
                        "--label", label], cwd=ROOT, capture_output=True, text=True)
    if r.returncode != 0:
        raise Blocked(f"state snapshot failed: {r.stderr.strip()[-300:]}")
    summary = json.loads(r.stdout)
    summary["field_support_access_assignments"] = access_count()
    save_private(f"summary-{label}.json", summary)
    print(json.dumps(summary, indent=2))


def verify_state(before: str, after: str) -> None:
    r = subprocess.run([sys.executable, "scripts/smf5/state_snapshot.py", "compare", before, after],
                       cwd=ROOT, capture_output=True, text=True)
    result = json.loads(r.stdout)
    sb = json.loads((PDIR / f"summary-{before}.json").read_text(encoding="utf-8"))
    sa = json.loads((PDIR / f"summary-{after}.json").read_text(encoding="utf-8"))
    result["access_assignments"] = {"before": sb["field_support_access_assignments"],
                                    "after": sa["field_support_access_assignments"]}
    cid = state_snapshot.resolve_case_id(json.loads((PRIVATE / "fixtures.json").read_text(encoding="utf-8")), "install-test")
    seen = {}
    for p in ("tech", "support"):  # each persona's own session, not the admin's
        c = sf("data", "query", "--query", state_snapshot.case_query(cid), "--target-org", persona_alias(p), check=False)
        f = sf("data", "query", "--query", state_snapshot.files_query(cid), "--target-org", persona_alias(p), check=False)
        seen[f"MF-{p.upper()}"] = {"case_rows": (c.get("result") or {}).get("totalSize", "error"),
                                   "file_links": (f.get("result") or {}).get("totalSize", "error")}
    result["persona_visibility_after"] = seen
    REPORTS.mkdir(parents=True, exist_ok=True)
    (REPORTS / f"state-{before}-vs-{after}.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=2))
    ok = (result["identical"] and result["access_assignments"]["before"] == result["access_assignments"]["after"]
          and all(v["case_rows"] == 1 and isinstance(v["file_links"], int) and v["file_links"] >= 1 for v in seen.values()))
    if not ok:
        raise RuntimeError("PKG-02 state check: differences found (see report)")


def main() -> int:
    a = sys.argv[1:]
    try:
        if a == ["preflight"]:
            preflight()
        elif len(a) == 2 and a[0] in ("version", "install") and a[1] in VERSION_PREFIX:
            preflight()
            (version if a[0] == "version" else install)(a[1])
        elif a == ["access"]:
            access()
        elif len(a) == 2 and a[0] == "state":
            state(a[1])
        elif len(a) == 3 and a[0] == "verify-state":
            verify_state(a[1], a[2])
        else:
            print(__doc__)
            return 64
    except Blocked as e:
        print(f"BLOCKED: {e}")
        return 2
    return 0


if __name__ == "__main__":
    sys.exit(main())
