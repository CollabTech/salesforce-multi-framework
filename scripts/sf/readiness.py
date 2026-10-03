#!/usr/bin/env python3
"""SMF-2 environment readiness check (ENV-01, ENV-02, ENV-03). READ-ONLY.

Every org command passes an explicit --target-org. Nothing is written to any org. The
full raw output (usernames, org IDs) goes to private/smf2/ (git-ignored); stdout and
--report receive only sanitized values that may be published as evidence.

Usage:
  python3 scripts/sf/readiness.py --devhub <alias> --dev <alias> --install-test <alias> \
      [--report evidence/SMF-2/readiness-<date>.md]

Aliases come from the local credential store (`sf org login web --alias <alias>`); the
alias -> org mapping lives in private/orgs.json (docs/private-mapping-format.md).

Each readiness item is reported OBSERVED-PASS / OBSERVED-FAIL / BLOCKED / MANUAL (needs a
named Setup observation by Brandon). Nothing is inferred from a browser login.
"""
import argparse, datetime, json, os, shutil, subprocess, sys, tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "private" / "smf2"
# Official requirements (see docs/smf-2/platform-requirements.md for sources)
MFW_EDITIONS = {"Enterprise Edition", "Performance Edition", "Unlimited Edition",
                "Developer Edition", "Partner Developer Edition"}
PERSONAS_NEEDING_FULL_LICENSE = 3   # MF-TECH, MF-SUPPORT, MF-RESTRICTED (Case access)
CASE002_OWNER = 0                   # MF-CASE-002 is owned by MF-ADMIN (not a business persona)


def sf(*args, alias=None):
    exe = shutil.which("sf") or shutil.which("sf.cmd")
    if not exe:
        return {"status": 127, "message": "sf CLI not found"}
    os.environ.setdefault("SF_DISABLE_TELEMETRY", "true")
    cmd = [exe, *args, "--json"]
    if alias:
        cmd += ["--target-org", alias]
    r = subprocess.run(cmd, capture_output=True, text=True)
    try:
        return json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        return {"status": r.returncode, "message": (r.stderr or r.stdout)[-300:]}


def query(alias, soql, tooling=False):
    args = ["data", "query", "--query", soql] + (["--use-tooling-api"] if tooling else [])
    out = sf(*args, alias=alias)
    if out.get("status") == 0:
        return out["result"]["records"], None
    return None, out.get("name") or out.get("message", "error")


class Report:
    def __init__(self):
        self.items, self.raw = [], {}

    def add(self, case, item, outcome, observed, action=""):
        self.items.append({"case": case, "item": item, "outcome": outcome,
                           "observed": observed, "action": action})

    def markdown(self, meta):
        lines = ["# SMF-2 readiness report (sanitized)", "",
                 f"Generated {meta['ts']} by `scripts/sf/readiness.py` at commit `{meta['commit']}`; "
                 f"sf {meta['sf']}; node {meta['node']}; host {meta['host']}.", "",
                 "Org identifiers and usernames are kept in `private/smf2/` only.", "",
                 "| Case | Item | Outcome | Observed (sanitized) | Unblocking action |",
                 "|---|---|---|---|---|"]
        for i in self.items:
            lines.append(f"| {i['case']} | {i['item']} | {i['outcome']} | {i['observed']} | {i['action']} |")
        return "\n".join(lines) + "\n"


def org_identity(rep, role, alias):
    recs, err = query(alias, "SELECT OrganizationType, IsSandbox, TrialExpirationDate, "
                             "LanguageLocaleKey, InstanceName FROM Organization")
    disp = sf("org", "display", alias=alias)
    rep.raw[f"{role}-display"] = disp
    if err or not recs:
        rep.add("ENV-01", f"{role}: authenticate + identity", "BLOCKED", f"query failed: {err}",
                f"`sf org login web --alias {alias}` (Brandon completes any passkey prompt)")
        return None
    o = recs[0]
    rep.raw[f"{role}-org"] = o
    api = disp.get("result", {}).get("apiVersion", "?")
    observed = (f"edition={o['OrganizationType']}; sandbox={o['IsSandbox']}; "
                f"language={o['LanguageLocaleKey']}; instance={o['InstanceName']}; "
                f"trialExpires={'yes' if o.get('TrialExpirationDate') else 'no'}; api={api}")
    ok = o["OrganizationType"] in MFW_EDITIONS and o["LanguageLocaleKey"].startswith("en")
    rep.add("ENV-01", f"{role}: identity, edition, default language", "OBSERVED-PASS" if ok else "OBSERVED-FAIL",
            observed, "" if ok else "Multi-Framework needs EE/PE/UE/DE/PDE on Hyperforce with English default")
    return o


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--devhub", required=True)
    ap.add_argument("--dev", required=True)
    ap.add_argument("--install-test", required=True)
    ap.add_argument("--report")
    a = ap.parse_args()
    if len({a.devhub, a.dev, a.install_test}) < 2 or a.dev == a.install_test:
        sys.exit("FAIL: dev and install-test must be different targets (ENV-03)")

    rep = Report()
    commit = subprocess.run(["git", "rev-parse", "--short", "HEAD"], cwd=ROOT,
                            capture_output=True, text=True).stdout.strip()
    ver = sf("version")
    meta = {"ts": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
            "commit": commit, "sf": str(ver.get("cliVersion") or (ver.get("result") or {}).get("cliVersion", "?")).split("/")[-1],
            "node": subprocess.run(["node", "--version"], capture_output=True, text=True).stdout.strip(),
            "host": sys.platform}

    hub = org_identity(rep, "devhub", a.devhub)
    dev = org_identity(rep, "dev", a.dev)
    inst = org_identity(rep, "install-test", a.install_test)

    # Distinct orgs (compared privately by org ID, reported only as a boolean)
    ids = {r: rep.raw.get(f"{r}-display", {}).get("result", {}).get("id") for r in ("devhub", "dev", "install-test")}
    distinct = ids["dev"] and ids["install-test"] and ids["dev"] != ids["install-test"]
    rep.add("ENV-03", "dev and install-test are different orgs", "OBSERVED-PASS" if distinct else "BLOCKED",
            f"distinct={bool(distinct)}; dev is Dev Hub={'unknown' if not ids['dev'] else ids['dev'] == ids['devhub']}",
            "" if distinct else "create the install-test scratch org (docs/smf-2/setup-path.md step 4)")

    if hub:
        recs, err = query(a.devhub, "SELECT Id FROM ScratchOrgInfo LIMIT 1")
        rep.add("ENV-01", "Dev Hub enabled", "OBSERVED-PASS" if err is None else "OBSERVED-FAIL",
                "ScratchOrgInfo queryable" if err is None else f"ScratchOrgInfo not queryable ({err})",
                "" if err is None else "Setup > Dev Hub > Enable Dev Hub (dx-org-devhub-configure; irreversible, needs approval)")
        recs, err = query(a.devhub, "SELECT Id FROM Package2 LIMIT 1", tooling=True)
        rep.add("ENV-01", "Unlocked/2GP packaging enabled", "OBSERVED-PASS" if err is None else "OBSERVED-FAIL",
                "Package2 queryable (Tooling API)" if err is None else f"Package2 not queryable ({err})",
                "" if err is None else "Setup > Dev Hub > Enable Unlocked Packages and Second-Generation Managed Packages")
        lim = sf("org", "list", "limits", alias=a.devhub)
        want = {"ActiveScratchOrgs", "DailyScratchOrgs", "Package2VersionCreates",
                "Package2VersionCreatesWithoutValidation"}
        got = {x["name"]: f"{x['remaining']}/{x['max']}" for x in lim.get("result", []) if x.get("name") in want}
        cap_ok = got and all(int(v.split("/")[0]) >= 1 for k, v in got.items() if k in ("ActiveScratchOrgs", "DailyScratchOrgs"))
        rep.add("ENV-02", "Scratch-org and package-version capacity (remaining/max)",
                "OBSERVED-PASS" if cap_ok else "BLOCKED", "; ".join(f"{k}={v}" for k, v in sorted(got.items())) or "limits unavailable",
                "" if cap_ok else "wait for daily reset or delete an active scratch org")

    for role, alias, o in (("dev", a.dev, dev), ("install-test", a.install_test, inst)):
        if not o:
            continue
        recs, err = query(alias, "SELECT Name, TotalLicenses, UsedLicenses FROM UserLicense "
                                 "WHERE Name IN ('Salesforce','Salesforce Platform')")
        if err:
            rep.add("ENV-02", f"{role}: user licences for personas", "BLOCKED", err, "re-authenticate")
            continue
        free = {r["Name"]: r["TotalLicenses"] - r["UsedLicenses"] for r in recs}
        need = PERSONAS_NEEDING_FULL_LICENSE + CASE002_OWNER
        ok = free.get("Salesforce", 0) >= need
        rep.add("ENV-02", f"{role}: free Salesforce licences >= {need} (TECH, SUPPORT, RESTRICTED)",
                "OBSERVED-PASS" if ok else "BLOCKED", "; ".join(f"{k} free={v}" for k, v in sorted(free.items())),
                "" if ok else "use an org/scratch shape with more Salesforce licences or free existing ones; never drop MF-RESTRICTED")
        # Edge Network / Salesforce app domain: settings are not reliably exposed via API at
        # the pinned CLI; retrieve My Domain settings and report what is present.
        tmp = Path(tempfile.mkdtemp())
        r = sf("project", "retrieve", "start", "--metadata", "Settings:MyDomain",
               "--target-metadata-dir", str(tmp), "--unzip", alias=alias)
        text = "".join(p.read_text(encoding="utf-8", errors="replace") for p in tmp.rglob("*.settings"))
        shutil.rmtree(tmp, ignore_errors=True)
        edge = "enableEdgeNetwork" in text and "<enableEdgeNetwork>true" in text.replace(" ", "")
        rep.add("ENV-01", f"{role}: Salesforce Edge Network (My Domain routing)",
                "OBSERVED-PASS" if edge else "MANUAL",
                "MyDomainSettings.enableEdgeNetwork=true" if edge else "not observable in retrieved MyDomainSettings",
                "" if edge else "Brandon: Setup > My Domain > Routing and Policies > 'Salesforce Edge Network' - report Enabled/Disabled")
        rep.add("ENV-01", f"{role}: Salesforce app domain (Multi-Framework)", "MANUAL",
                "not exposed via a documented API", "Brandon: Setup > Salesforce Multi-Framework Apps - report whether 'Enable Domain' is shown")
        rep.add("ENV-01", f"{role}: Hyperforce", "MANUAL", f"instance={o['InstanceName']}",
                "Brandon: Setup > Company Information - report whether the instance is Hyperforce")

    PRIVATE.mkdir(parents=True, exist_ok=True)
    (PRIVATE / f"readiness-raw-{meta['ts'].replace(':', '')}.json").write_text(
        json.dumps(rep.raw, indent=2, default=str), encoding="utf-8")
    md = rep.markdown(meta)
    if a.report:
        Path(a.report).write_text(md, encoding="utf-8", newline="\n")
    print(md)
    return 0 if all(i["outcome"] == "OBSERVED-PASS" for i in rep.items) else 2


if __name__ == "__main__":
    sys.exit(main())
