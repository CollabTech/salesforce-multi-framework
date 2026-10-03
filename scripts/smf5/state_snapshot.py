#!/usr/bin/env python3
"""SMF-5 PKG-02: read-only snapshot of the seeded MF-CASE-001 / MF-IMAGE-001 state in the
install-test org, taken before and after the v1 -> v2 upgrade, and compared.

  python3 scripts/smf5/state_snapshot.py snapshot --target-org smf-install-test --label before-v2
  python3 scripts/smf5/state_snapshot.py snapshot --target-org smf-install-test --label after-v2
  python3 scripts/smf5/state_snapshot.py compare before-v2 after-v2

Record IDs come from private/fixtures.json (written by SMF-3; format
{"smf-install-test": {"records": {"MF-CASE-001": ["<Case Id>"]}}, ...}, see docs/private-mapping-format.md).
Raw query results are written to private/smf5/state-<label>.json (git-ignored). Standard
output is publishable: record counts, field names and short SHA-256 fingerprints only —
no record, user, org or package IDs. Only SELECT queries are issued.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "private"
ID_RX = re.compile(r"^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$")
CASE_FIELDS = ["Id", "Subject", "Status", "Priority", "OwnerId", "AssetId", "LastModifiedDate", "SystemModstamp"]
FILE_FIELDS = ["ContentDocumentId", "ShareType", "Visibility", "ContentDocument.Title",
               "ContentDocument.LatestPublishedVersion.Checksum", "ContentDocument.LatestPublishedVersion.ContentSize",
               "ContentDocument.LastModifiedDate"]


def case_query(case_id: str) -> str:
    return f"SELECT {', '.join(CASE_FIELDS)} FROM Case WHERE Id = '{case_id}'"


def files_query(case_id: str) -> str:
    return (f"SELECT {', '.join(FILE_FIELDS)} FROM ContentDocumentLink WHERE LinkedEntityId = '{case_id}' "
            "ORDER BY ContentDocumentId")


def flatten(rec: dict, prefix: str = "") -> dict:
    out = {}
    for k, v in rec.items():
        if k == "attributes":
            continue
        key = f"{prefix}{k}"
        if isinstance(v, dict):
            out.update(flatten(v, key + "."))
        else:
            out[key] = v
    return out


def fingerprint(value) -> str:
    return hashlib.sha256(json.dumps(value, sort_keys=True).encode()).hexdigest()[:12]


def resolve_case_id(fixtures: dict, org_key: str) -> str:
    # SMF-3 shape: {"<org alias>": {"updated": ..., "records": {"MF-CASE-001": ["<Id>"], ...}}}
    try:
        ids = fixtures[org_key]["records"]["MF-CASE-001"]
        cid = ids[0] if len(ids) == 1 else None
    except (KeyError, TypeError, IndexError):
        sys.exit(f"private/fixtures.json has no MF-CASE-001 entry for '{org_key}' (SMF-3 seed not run there?)")
    if not isinstance(cid, str) or not ID_RX.match(cid):
        sys.exit("MF-CASE-001 record ID in private/fixtures.json is not a Salesforce ID")
    return cid


def summarize(snap: dict) -> dict:
    return {
        "case_count": len(snap["case"]),
        "file_link_count": len(snap["files"]),
        "case_fingerprint": fingerprint(snap["case"]),
        "files_fingerprint": fingerprint(snap["files"]),
    }


def compare(a: dict, b: dict) -> list:
    """Field-level differences, described by field name only (values never printed)."""
    diffs = []
    for part in ("case", "files"):
        ra, rb = a[part], b[part]
        if len(ra) != len(rb):
            diffs.append(f"{part}: record count {len(ra)} -> {len(rb)}")
            continue
        for i, (x, y) in enumerate(zip(ra, rb)):
            for f in sorted(set(x) | set(y)):
                if x.get(f) != y.get(f):
                    diffs.append(f"{part}[{i}].{f} changed")
    return diffs


def run_query(exe: str, org: str, soql: str) -> list:
    env = dict(os.environ, SF_DISABLE_TELEMETRY="true")
    r = subprocess.run([exe, "data", "query", "--query", soql, "--target-org", org, "--json"],
                       capture_output=True, text=True, env=env)
    try:
        data = json.loads(r.stdout)
    except json.JSONDecodeError:
        sys.exit("sf data query returned no JSON (is the org alias authenticated?)")
    if r.returncode != 0 or data.get("status") != 0:
        sys.exit(f"query failed: {data.get('name', 'error')}: {data.get('message', '')[:300]}")
    return [flatten(x) for x in data["result"]["records"]]


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    s = sub.add_parser("snapshot")
    s.add_argument("--target-org", required=True, help="explicit sf alias of the install-test org")
    s.add_argument("--org-key", default="smf-install-test", help="org alias key in private/fixtures.json (default smf-install-test)")
    s.add_argument("--label", required=True)
    s.add_argument("--sf", help="path to the sf executable")
    c = sub.add_parser("compare")
    c.add_argument("before")
    c.add_argument("after")
    a = ap.parse_args()

    out_dir = PRIVATE / "smf5"
    if a.cmd == "snapshot":
        if not re.fullmatch(r"[A-Za-z0-9_-]+", a.label):
            sys.exit("label: letters, digits, - and _ only")
        exe = a.sf or os.environ.get("SF_BIN") or shutil.which("sf") or shutil.which("sf.cmd")
        if not exe:
            sys.exit("sf CLI not found")
        fixtures = json.loads((PRIVATE / "fixtures.json").read_text(encoding="utf-8"))
        cid = resolve_case_id(fixtures, a.org_key)
        snap = {"case": run_query(exe, a.target_org, case_query(cid)),
                "files": run_query(exe, a.target_org, files_query(cid))}
        out_dir.mkdir(parents=True, exist_ok=True)
        (out_dir / f"state-{a.label}.json").write_text(json.dumps(snap, indent=2, sort_keys=True), encoding="utf-8")
        print(json.dumps({"label": a.label, **summarize(snap)}, indent=2))
        return 0

    snaps = [json.loads((out_dir / f"state-{x}.json").read_text(encoding="utf-8")) for x in (a.before, a.after)]
    diffs = compare(*snaps)
    print(json.dumps({"before": summarize(snaps[0]), "after": summarize(snaps[1]),
                      "identical": not diffs, "differences": diffs}, indent=2))
    return 0 if not diffs else 1


if __name__ == "__main__":
    sys.exit(main())
