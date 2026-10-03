#!/usr/bin/env python3
"""SMF-3 fixture driver (DATA-01, DATA-04): preflight, idempotent seed, counts, seed-twice, reset.

  python3 testing/provisioning/fixtures.py preflight  --target-org <alias>
  python3 testing/provisioning/fixtures.py seed       --target-org <alias>
  python3 testing/provisioning/fixtures.py counts     --target-org <alias>
  python3 testing/provisioning/fixtures.py seed-twice --target-org <alias> [--report <sanitized.json>]   # DATA-01
  python3 testing/provisioning/fixtures.py reset      --target-org <alias> [--reseed]

Common flag: --allow-devhub-as-dev (only with a recorded SMF-2 fallback decision).

seed = verify org identity -> preflight (describe: fields exist, required fields covered;
EntityDefinition sharing models) -> apex/seed.apex (records + grants) -> upload any missing
image File with `sf data create file --title <logical id>` (no parent, so the File is private
to MF-ADMIN until the seed links it with ShareType V) -> apex/seed.apex again (links Files)
-> counts. Printed output carries logical IDs, counts and booleans only; record IDs are kept
in private/fixtures.json and private/smf3/.
"""
import argparse, hashlib, json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sfkit as K  # noqa: E402

APEX = K.PROV / "apex"
MANIFEST = K.ROOT / "testing" / "fixtures" / "manifest.json"
ACCOUNT_NAME = "CollabTech PoC Test Customer"
CASE_SUBJECT = {"MF-CASE-001": "Pump overheating — remote diagnosis",
                "MF-CASE-002": "MF-CASE-002 restricted negative control (synthetic)"}
FILES = {"MF-IMAGE-001": "MF-CASE-001", "MF-FILE-DENIED": "MF-CASE-002"}
# fields the seed writes or filters on (standard fields only; verified by describe in preflight)
USES = {"Account": ["Name", "Description"],
        "Asset": ["Name", "SerialNumber", "AccountId", "Description"],
        "Case": ["Subject", "AccountId", "AssetId", "Description", "IsClosed", "OwnerId"],
        "ContentVersion": ["Title", "IsLatest", "Checksum", "ContentDocumentId", "OwnerId"],
        "ContentDocumentLink": ["ContentDocumentId", "LinkedEntityId", "ShareType", "Visibility"]}
SETS = {"Account": {"Name", "Description"}, "Asset": {"Name", "SerialNumber", "AccountId", "Description"},
        "Case": {"Subject", "AccountId", "AssetId", "Description"}}


def manifest_file(lid):
    m = json.loads(MANIFEST.read_text(encoding="utf-8"))
    return next(f for f in m["fixtures"] if f["logical_id"] == lid and f["media_type"] == "image/png" and f["committed"])


def preflight(org):
    problems = []
    for obj, fields in USES.items():
        d = K.sf(["sobject", "describe", "--sobject", obj], org)["result"]
        fmap = {f["name"]: f for f in d["fields"]}
        for f in fields:
            if f not in fmap:
                problems.append(f"{obj}.{f} missing")
        for f in d["fields"]:   # required on create, no default, not set by the seed
            if (f["createable"] and not f["nillable"] and not f["defaultedOnCreate"]
                    and f["type"] != "boolean" and obj in SETS and f["name"] not in SETS[obj]):
                problems.append(f"{obj}.{f['name']} is required on create but the seed does not set it")
    owd = K.query(org, "SELECT QualifiedApiName, InternalSharingModel, ExternalSharingModel FROM EntityDefinition "
                       "WHERE QualifiedApiName IN ('Account','Case','Asset')", tooling=True)
    models = {r["QualifiedApiName"]: (r["InternalSharingModel"], r["ExternalSharingModel"]) for r in owd}
    for obj in ("Account", "Case", "Asset"):
        if models.get(obj, ("?",))[0] != "Private":
            problems.append(f"{obj} internal sharing model is {models.get(obj, ('?',))[0]} (baseline: Private; "
                            "deploy testing/provisioning/metadata)")
    K.say("[preflight] sharing models: " + ", ".join(f"{k}={v[0]}/{v[1]}" for k, v in sorted(models.items())))
    for p in problems:
        K.say(f"[preflight] PROBLEM {p}")
    if not problems:
        K.say("[preflight] OK: fields exist, required fields covered, Account/Case/Asset Private")
    return problems


def admin_id(disp):
    return K.running_user(disp)[1]


def counts(org, disp):
    """Count every logical key; return (sanitized counts, private ids)."""
    me = admin_id(disp)
    c, ids = {}, {}
    acc = K.query(org, f"SELECT Id, OwnerId FROM Account WHERE Name = {K.soql_str(ACCOUNT_NAME)}")
    c["MF-ACCOUNT-001"], ids["MF-ACCOUNT-001"] = len(acc), [r["Id"] for r in acc]
    for s in ("MF-ASSET-001", "MF-ASSET-002"):
        r = K.query(org, f"SELECT Id, AccountId FROM Asset WHERE SerialNumber = {K.soql_str(s)}")
        c[s], ids[s] = len(r), [x["Id"] for x in r]
    acc_ids = ",".join(K.soql_str(i) for i in ids["MF-ACCOUNT-001"]) or "''"
    for key, subj in CASE_SUBJECT.items():
        r = K.query(org, f"SELECT Id, OwnerId, IsClosed FROM Case WHERE Subject = {K.soql_str(subj)} AND AccountId IN ({acc_ids})")
        c[key], ids[key] = len(r), [x["Id"] for x in r]
        c[f"{key}.owner_is_MF-ADMIN"] = all(x["OwnerId"] == me for x in r) if r else None
        if key == "MF-CASE-001":
            c[f"{key}.open"] = all(not x["IsClosed"] for x in r) if r else None
    for lid, case_key in FILES.items():
        r = K.query(org, f"SELECT Id, ContentDocumentId, Checksum FROM ContentVersion WHERE Title = {K.soql_str(lid)} "
                         f"AND IsLatest = true AND OwnerId = {K.soql_str(me)}")
        c[lid], ids[lid] = len(r), [x["ContentDocumentId"] for x in r]
        c[f"{lid}.md5_matches_manifest"] = all(x["Checksum"] == manifest_file(lid)["md5"] for x in r) if r else None
        if r:
            links = K.query(org, "SELECT LinkedEntityId, ShareType FROM ContentDocumentLink WHERE ContentDocumentId = "
                                 + K.soql_str(r[0]["ContentDocumentId"]))
            case_ids = set(ids.get(case_key, []))
            c[f"{lid}.linked_to_{case_key}_sharetype_V"] = any(l["LinkedEntityId"] in case_ids and l["ShareType"] == "V" for l in links)
            c[f"{lid}.other_record_links"] = sum(1 for l in links if l["LinkedEntityId"] not in case_ids and l["LinkedEntityId"] != me)
            dist = K.query(org, "SELECT Id FROM ContentDistribution WHERE ContentDocumentId = " + K.soql_str(r[0]["ContentDocumentId"]))
            c[f"{lid}.public_links"] = len(dist)
    return c, ids


def counts_ok(c):
    singles = [k for k in c if "." not in k]
    return all(c[k] == 1 for k in singles) and all(v in (True, 0) for k, v in c.items() if "." in k)


def print_counts(label, c):
    K.say(f"[{label}] " + "; ".join(f"{k}={v}" for k, v in c.items()))


def run_seed(org, disp):
    for i, step in enumerate(("records and grants", "link Files"), 1):
        if i == 2:
            upload_missing(org, disp)
        ok, lines = K.apex(org, APEX / "seed.apex")
        for l in lines:
            K.say(f"[seed pass {i}: {step}] {l}")
        if not ok:
            raise K.SfError("seed.apex failed (raw log in private/smf3/)")
    return lines


def upload_missing(org, disp):
    me = admin_id(disp)
    for lid in FILES:
        r = K.query(org, f"SELECT Id FROM ContentVersion WHERE Title = {K.soql_str(lid)} AND IsLatest = true "
                         f"AND OwnerId = {K.soql_str(me)}")
        if r:
            K.say(f"[upload] {lid} existing (not uploaded again)")
            continue
        f = manifest_file(lid)
        p = K.ROOT / f["path"]
        if hashlib.sha256(p.read_bytes()).hexdigest() != f["sha256"]:
            raise K.SfError(f"{f['path']} does not match manifest.json; run python3 testing/fixtures/generate.py --check")
        K.sf(["data", "create", "file", "--file", str(p), "--title", lid], org)
        K.say(f"[upload] {lid} uploaded (sha256 {f['sha256'][:16]}…)")


def save_ids(org, ids):
    m = K.read_private("fixtures.json", {}) or {}
    m[org] = {"updated": K.now(), "records": ids}
    K.write_private("fixtures.json", m)


def main():
    ap = argparse.ArgumentParser(description="SMF-3 fixtures")
    ap.add_argument("command", choices=["preflight", "seed", "counts", "seed-twice", "reset"])
    ap.add_argument("--target-org", required=True)
    ap.add_argument("--allow-devhub-as-dev", action="store_true")
    ap.add_argument("--reseed", action="store_true")
    ap.add_argument("--report", help="write a sanitized JSON result (counts/booleans only)")
    a = ap.parse_args()
    org = a.target_org
    ident, disp = K.verify_target(org, a.allow_devhub_as_dev)
    K.say(f"[org] edition={ident['edition']} sandbox={ident['sandbox']} scratch={ident['is_scratch']} api={ident['api_version']}")
    result = {"command": a.command, "timestamp": K.now(), "commit": K.git_commit(),
              "org": {k: ident[k] for k in ("edition", "sandbox", "is_scratch", "api_version")}}
    rc = 0
    if a.command == "preflight":
        rc = 2 if preflight(org) else 0
    elif a.command == "counts":
        c, ids = counts(org, disp)
        print_counts("counts", c)
        save_ids(org, ids)
        result["counts"] = c
        rc = 0 if counts_ok(c) else 2
    elif a.command in ("seed", "seed-twice"):
        if preflight(org):
            K.exit_blocked("preflight problems above; fix them before seeding")
        before, _ = counts(org, disp)
        print_counts("before", before)
        runs = []
        for n in range(2 if a.command == "seed-twice" else 1):
            lines = run_seed(org, disp)
            c, ids = counts(org, disp)
            print_counts(f"after seed {n + 1}", c)
            runs.append({"counts": c, "ids": ids, "summary": lines[-1] if lines else ""})
        save_ids(org, runs[-1]["ids"])
        result.update({"before": before, "runs": [{"counts": r["counts"], "summary": r["summary"]} for r in runs]})
        ok = all(counts_ok(r["counts"]) for r in runs)
        if a.command == "seed-twice":
            stable_counts = runs[0]["counts"] == runs[1]["counts"]
            stable_ids = runs[0]["ids"] == runs[1]["ids"]   # compared privately; only the boolean is printed
            result.update({"counts_stable": stable_counts, "logical_identities_stable": stable_ids, "no_duplicates": ok})
            K.say(f"[DATA-01] counts stable={stable_counts}; logical identities (same record per key) stable={stable_ids}; "
                  f"exactly one record per key={ok}")
            ok = ok and stable_counts and stable_ids
        rc = 0 if ok else 2
    elif a.command == "reset":
        ok, lines = K.apex(org, APEX / "reset.apex")
        for l in lines:
            K.say(f"[reset] {l}")
        c, _ = counts(org, disp)
        print_counts("after reset", c)
        left = {k: v for k, v in c.items() if "." not in k and v}
        result.update({"reset_ok": ok and not left, "after_reset": c})
        rc = 0 if ok and not left else 2
        if a.reseed and rc == 0:
            run_seed(org, disp)
            c, ids = counts(org, disp)
            print_counts("after reseed", c)
            save_ids(org, ids)
            result["after_reseed"] = c
            rc = 0 if counts_ok(c) else 2
    if a.report:
        Path(a.report).write_text(K.redact(json.dumps(result, indent=2, ensure_ascii=False)) + "\n", encoding="utf-8")
    K.say(f"RESULT: {'OK' if rc == 0 else 'NOT OK'} ({a.command})")
    return rc


if __name__ == "__main__":
    try:
        sys.exit(main())
    except K.SfError as e:
        K.say(f"ERROR: {e}")
        sys.exit(1)
