#!/usr/bin/env python3
"""SMF-3 access baseline check (DATA-03; automated org-level part of DATA-02). READ-ONLY.

  python3 testing/provisioning/baseline.py --target-org <alias> [--report <sanitized.md>]

Compares the org with testing/provisioning/baseline.json and prints a sanitized table
(logical persona/fixture IDs, profile/permission-set names, booleans; never usernames or IDs):
 1. Org-wide defaults for Account/Case/Asset (EntityDefinition, Tooling API).
 2. Per persona: profile, licence, role, active, non-profile permission-set assignments,
    public group/queue membership, no View All Data / Modify All Data, and effective object
    permissions on Case/Account/Asset (no View All / Modify All).
 3. Share rows on every fixture record: only the owner (MF-ADMIN) and the baseline manual
    shares; any rule/group/other-user row is a deviation (this is what proves no sharing rule
    exposes MF-CASE-002). Sharing-rule metadata counts are retrieved privately for context.
 4. UserRecordAccess for each persona x fixture record/File (record-level access as the
    platform computes it). Files are checked again by MF_AccessBaselineTest (runAs).
Exit: 0 all match, 2 deviations, 3 BLOCKED (personas or fixtures missing), 1 error.
"""
import argparse, json, re, shutil, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sfkit as K  # noqa: E402
import fixtures as F  # noqa: E402

BASE = json.loads((K.PROV / "baseline.json").read_text(encoding="utf-8"))
SHARE = {"Account": ("AccountShare", "AccountId", "AccountAccessLevel"),
         "Case": ("CaseShare", "CaseId", "CaseAccessLevel"),
         "Asset": ("AssetShare", "AssetId", "AssetAccessLevel")}
FIXTURE_OBJ = {"MF-ACCOUNT-001": "Account", "MF-CASE-001": "Case", "MF-CASE-002": "Case",
               "MF-ASSET-001": "Asset", "MF-ASSET-002": "Asset"}


class Checks:
    def __init__(self):
        self.rows = []

    def add(self, area, item, expected, actual):
        ok = expected == actual
        self.rows.append((area, item, str(expected), str(actual), "match" if ok else "DEVIATION"))
        return ok

    def ok(self):
        return all(r[4] == "match" for r in self.rows)

    def markdown(self, meta):
        L = ["# SMF-3 access baseline (sanitized)", "",
             f"Generated {meta['ts']} by `testing/provisioning/baseline.py` at commit `{meta['commit']}`; "
             f"org edition {meta['edition']}, scratch={meta['scratch']}, api {meta['api']}. Logical IDs only.", "",
             "| Area | Item | Expected | Actual | Result |", "|---|---|---|---|---|"]
        L += [f"| {' | '.join(c.replace('|', '/') for c in r)} |" for r in self.rows]
        return "\n".join(L) + "\n"


def personas(org):
    recs = K.query(org, "SELECT Id, IsActive, UserRoleId, Profile.Name, Profile.UserLicense.Name, FederationIdentifier "
                        "FROM User WHERE FederationIdentifier IN ('MF-TECH','MF-SUPPORT','MF-RESTRICTED')")
    return {r["FederationIdentifier"]: r for r in recs}


def level(read, edit):
    return "E" if edit else ("R" if read else "-")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--target-org", required=True)
    ap.add_argument("--allow-devhub-as-dev", action="store_true")
    ap.add_argument("--report")
    a = ap.parse_args()
    org = a.target_org
    ident, disp = K.verify_target(org, a.allow_devhub_as_dev)
    me = K.running_user(disp)[1]
    ch = Checks()

    owd = K.query(org, "SELECT QualifiedApiName, InternalSharingModel, ExternalSharingModel FROM EntityDefinition "
                       "WHERE QualifiedApiName IN ('Account','Case','Asset')", tooling=True)
    got = {r["QualifiedApiName"]: (r["InternalSharingModel"], r["ExternalSharingModel"]) for r in owd}
    for obj, want in BASE["org_wide_defaults"].items():
        ch.add("OWD", f"{obj} internal/external", f"{want}/{want}", "/".join(got.get(obj, ("?", "?"))))

    users = personas(org)
    missing = [p for p in BASE["personas"] if p not in users]
    if missing:
        K.exit_blocked(f"personas not provisioned: {missing}. Unblock: python3 testing/provisioning/personas.py --target-org {org}")
    uid = {p: users[p]["Id"] for p in users}
    label = {v: k for k, v in uid.items()}
    label[me] = "MF-ADMIN"
    app_present = bool(K.query(org, "SELECT Id FROM PermissionSet WHERE Name = 'FieldSupport_Access'"))
    ids_sql = ",".join(K.soql_str(i) for i in uid.values())
    psa = K.query(org, "SELECT AssigneeId, PermissionSet.Name, PermissionSet.IsOwnedByProfile, "
                       "PermissionSet.PermissionsViewAllData, PermissionSet.PermissionsModifyAllData "
                       f"FROM PermissionSetAssignment WHERE AssigneeId IN ({ids_sql})")
    groups = K.query(org, f"SELECT UserOrGroupId, Group.Type FROM GroupMember WHERE UserOrGroupId IN ({ids_sql})")
    for p, spec in BASE["personas"].items():
        u = users[p]
        ch.add(p, "profile", spec["profile"], u["Profile"]["Name"])
        ch.add(p, "licence", spec["licence"], u["Profile"]["UserLicense"]["Name"])
        ch.add(p, "role", "none", "none" if not u["UserRoleId"] else "has role")
        ch.add(p, "active", True, u["IsActive"])
        want = sorted(spec["permission_sets"] + (spec["permission_sets_when_present"] if app_present else []))
        mine = [r for r in psa if r["AssigneeId"] == u["Id"]]
        ch.add(p, "permission sets (non-profile)", want,
               sorted(r["PermissionSet"]["Name"] for r in mine if not r["PermissionSet"]["IsOwnedByProfile"]))
        ch.add(p, "View All Data / Modify All Data (incl. profile)", False,
               any(r["PermissionSet"]["PermissionsViewAllData"] or r["PermissionSet"]["PermissionsModifyAllData"] for r in mine))
        ch.add(p, "public group / queue memberships", spec["public_groups_or_queues"],
               sum(1 for g in groups if g["UserOrGroupId"] == u["Id"]))
        op = K.query(org, "SELECT SobjectType, PermissionsRead, PermissionsEdit, PermissionsViewAllRecords, "
                          "PermissionsModifyAllRecords FROM ObjectPermissions WHERE SobjectType IN ('Case','Account','Asset') "
                          "AND ParentId IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = "
                          f"{K.soql_str(u['Id'])})")
        for obj, want_lvl in BASE["object_permissions"][p].items():
            rows = [r for r in op if r["SobjectType"] == obj]
            eff = ("R" if any(r["PermissionsRead"] for r in rows) else "") + ("E" if any(r["PermissionsEdit"] for r in rows) else "")
            ch.add(p, f"object permission {obj}", want_lvl or "none", eff or "none")
            ch.add(p, f"{obj} View All / Modify All", False,
                   any(r["PermissionsViewAllRecords"] or r["PermissionsModifyAllRecords"] for r in rows))
    if not app_present:
        ch.rows.append(("app", "FieldSupport_Access", "SMF-4 deliverable", "not in org yet", "match"))

    c, ids = F.counts(org, disp)
    absent = [k for k in FIXTURE_OBJ if c.get(k) != 1] + [k for k in F.FILES if c.get(k) != 1]
    if absent:
        K.exit_blocked(f"fixtures missing or duplicated: {absent}. Unblock: python3 testing/provisioning/fixtures.py seed --target-org {org}")
    rec = {k: ids[k][0] for k in list(FIXTURE_OBJ) + list(F.FILES)}

    for key, obj in FIXTURE_OBJ.items():
        so, pf, lf = SHARE[obj]
        rows = K.sf(["data", "query", "--query", f"SELECT UserOrGroupId, RowCause, {lf} FROM {so} WHERE {pf} = {K.soql_str(rec[key])}"],
                    org, check=False)
        if rows.get("status") != 0:
            ch.add("shares", f"{key} ({so})", "queryable", "not queryable (sharing model not Private?)")
            continue
        actual = sorted(f"{label.get(r['UserOrGroupId'], 'group' if str(r['UserOrGroupId']).startswith('00G') else 'other-user')}:"
                        f"{r['RowCause']}:{r[lf]}" for r in rows["result"]["records"])
        want = sorted(["MF-ADMIN:Owner:All"] + [f"{p}:Manual:{lvl}" for p, lvl in BASE["manual_shares"][key].items()])
        ch.add("shares", key, want, actual)

    for key, f in BASE["files"].items():
        ch.add("files", f"{key} linked to {f['linked_to']} with ShareType {f['share_type']}", True,
               c.get(f"{key}.linked_to_{f['linked_to']}_sharetype_V"))
        ch.add("files", f"{key} links to other records", 0, c.get(f"{key}.other_record_links"))
        ch.add("files", f"{key} public links (ContentDistribution)", f["public_links"], c.get(f"{key}.public_links"))
        ch.add("files", f"{key} bytes match manifest (MD5)", True, c.get(f"{key}.md5_matches_manifest"))

    rec_sql = ",".join(K.soql_str(i) for i in rec.values())
    by_id = {v: k for k, v in rec.items()}
    for p, want in BASE["record_access"].items():
        if p.startswith("_"):
            continue
        r = K.sf(["data", "query", "--query", "SELECT RecordId, HasReadAccess, HasEditAccess FROM UserRecordAccess "
                  f"WHERE UserId = {K.soql_str(uid[p])} AND RecordId IN ({rec_sql})"], org, check=False)
        got = {}
        if r.get("status") == 0:
            got = {by_id.get(x["RecordId"]): level(x["HasReadAccess"], x["HasEditAccess"]) for x in r["result"]["records"]}
        for key, lvl in want.items():
            if key in F.FILES and key not in got:
                ch.rows.append((p, f"record access {key}", lvl, "not reported by UserRecordAccess", "see MF_AccessBaselineTest"))
                continue
            ch.add(p, f"record access {key}", lvl, got.get(key, "?"))

    tmp = Path(tempfile.mkdtemp(dir=K.PRIVATE_SMF3 if K.PRIVATE_SMF3.exists() else None))
    K.sf(["project", "retrieve", "start", "--metadata", "SharingRules:Account", "--metadata", "SharingRules:Case",
          "--metadata", "SharingRules:Asset", "--target-metadata-dir", str(tmp), "--unzip"], org, check=False)
    text = "".join(x.read_text(encoding="utf-8", errors="replace") for x in tmp.rglob("*.sharingRules"))
    shutil.rmtree(tmp, ignore_errors=True)
    n_rules = len(re.findall(r"<sharing(?:Criteria|Owner|Guest)Rules>", text))
    ch.rows.append(("sharing rules", "Account/Case/Asset rules in org (context)", "any; exposure is judged by share rows above",
                    str(n_rules), "info"))

    meta = {"ts": K.now(), "commit": K.git_commit(), "edition": ident["edition"], "scratch": ident["is_scratch"],
            "api": ident["api_version"]}
    md = ch.markdown(meta)
    print(K.redact(md))
    if a.report:
        Path(a.report).write_text(K.redact(md), encoding="utf-8", newline="\n")
    dev = [r for r in ch.rows if r[4] == "DEVIATION"]
    K.say(f"RESULT: {'baseline matches' if not dev else f'{len(dev)} deviation(s)'}")
    return 0 if not dev else 2


if __name__ == "__main__":
    try:
        sys.exit(main())
    except K.SfError as e:
        K.say(f"ERROR: {e}")
        sys.exit(1)
