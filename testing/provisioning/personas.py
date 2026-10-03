#!/usr/bin/env python3
"""SMF-3 persona users (AC1; prerequisite of DATA-01..03): create or reconcile MF-TECH,
MF-SUPPORT and MF-RESTRICTED in one explicit target org. MF-ADMIN is the authenticated admin
running this script; it is recorded, never created.

  python3 testing/provisioning/personas.py --target-org smf-dev
        [--reconcile] [--allow-devhub-as-dev] [--timezone America/New_York]

Cloud-first (docs/cloud/WORKFLOW.md, ADR-0004). Order; stops at the first blocker and writes
nothing to the org before step 4:
 1. Verify org identity (read-only). Refuse the Dev Hub unless --allow-devhub-as-dev.
 2. Licences FIRST: free 'Salesforce' UserLicense must cover every persona still to be created
    (all three on a first run). Short => BLOCKED (exit 3); no persona is dropped or downgraded.
 3. Profile 'Minimum Access - Salesforce' must exist and use the 'Salesforce' licence; permission
    set MF_Case_Worker must be deployed (stage 30).
 4. Create missing users with `sf org create user --definition-file <private temp file>
    --set-alias smf-dev-<tech|support|restricted> --target-org <dev>` (scratch orgs only; the CLI
    generates the password and keeps it, with the persona's auth, in the local credential
    store; scripts/cloud/vault.py carries it across sessions). In-org logical key:
    User.FederationIdentifier = MF-TECH / MF-SUPPORT / MF-RESTRICTED. Username: random, at
    example.com; no real names; no role. Email: $SMF_TESTER_EMAIL when set (so the device tester
    receives verification/reset mail), otherwise <alias>@example.com.
 5. Permission sets (official dx-org-permission-set-assign: `sf org assign permset
    --on-behalf-of`): MF_Case_Worker -> TECH, SUPPORT; FieldSupport_Access (SMF-4) -> all three
    once it exists, otherwise skipped with a message. Nothing else; no MFA waiver or other
    security-relaxing permission is ever assigned.
 6. Reconcile (always reported; fixed with --reconcile): profile, no role, active, no extra
    non-profile permission-set assignments, and the persona alias resolves to that user.
 7. Write the real mapping to private/personas.json (docs/private-mapping-format.md).

Exit codes: 0 ok, 2 deviations remain, 3 BLOCKED, 1 error.
"""
import argparse, json, os, secrets, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import sfkit as K  # noqa: E402

PROFILE = "Minimum Access - Salesforce"
LICENSE = "Salesforce"
CASE_WORKER = "MF_Case_Worker"
APP_PERMSET = "FieldSupport_Access"   # SMF-4 deliverable
SPEC = {
    "MF-TECH": {"key": "tech", "alias": "mftech", "last": "Tech Persona", "permsets": [CASE_WORKER]},
    "MF-SUPPORT": {"key": "support", "alias": "mfsupp", "last": "Support Persona", "permsets": [CASE_WORKER]},
    "MF-RESTRICTED": {"key": "restricted", "alias": "mfrestr", "last": "Restricted Persona", "permsets": []},
}


def cli_alias(org, persona):
    """smf-dev -> smf-dev-tech; another dev alias -> <alias>-tech."""
    return f"{org}-{SPEC[persona]['key']}"


def existing_users(org):
    keys = ",".join(K.soql_str(p) for p in SPEC)
    recs = K.query(org, "SELECT Id, Username, IsActive, UserRoleId, Profile.Name, FederationIdentifier "
                        f"FROM User WHERE FederationIdentifier IN ({keys})")
    return {r["FederationIdentifier"]: r for r in recs}


def free_licences(org):
    recs = K.query(org, f"SELECT TotalLicenses, UsedLicenses FROM UserLicense WHERE Name = {K.soql_str(LICENSE)}")
    return (recs[0]["TotalLicenses"] - recs[0]["UsedLicenses"]) if recs else 0


def email_for(spec):
    return os.environ.get("SMF_TESTER_EMAIL") or f"{spec['alias']}@example.com"


def create_user(org, persona, timezone, permsets):
    s = SPEC[persona]
    username = f"{s['alias']}.{secrets.token_hex(5)}@example.com"
    definition = {"Username": username, "FirstName": "MF", "LastName": s["last"], "Email": email_for(s),
                  "Alias": s["alias"], "FederationIdentifier": persona, "TimeZoneSidKey": timezone,
                  "LocaleSidKey": "en_US", "EmailEncodingKey": "UTF-8", "LanguageLocaleKey": "en_US",
                  "profileName": PROFILE, "permsets": permsets, "generatePassword": True}
    path = K.write_private(f"smf3/user-def-{s['key']}.json", definition)
    try:
        out = K.sf(["org", "create", "user", "--definition-file", str(path), "--set-alias", cli_alias(org, persona)], org)
    finally:
        path.unlink(missing_ok=True)
    K.write_private(f"smf3/create-user-{s['key']}-{K.now().replace(':', '')}.json", out)  # may hold the password: private only
    return username


def alias_user_id(alias):
    out = K.sf(["org", "display", "user"], alias, check=False)
    return (out.get("result") or {}).get("id") if out.get("status") == 0 else None


def assignments(org, user_ids):
    ids = ",".join(K.soql_str(i) for i in user_ids)
    recs = K.query(org, "SELECT Id, AssigneeId, PermissionSet.Name FROM PermissionSetAssignment "
                        f"WHERE AssigneeId IN ({ids}) AND PermissionSet.IsOwnedByProfile = false")
    out = {}
    for r in recs:
        out.setdefault(r["AssigneeId"], []).append(r)
    return out


def main():
    ap = argparse.ArgumentParser(description="Create/reconcile SMF-3 persona users")
    ap.add_argument("--target-org", required=True)
    ap.add_argument("--org-role", default="dev", choices=["dev", "install-test"])
    ap.add_argument("--reconcile", action="store_true")
    ap.add_argument("--allow-devhub-as-dev", action="store_true")
    ap.add_argument("--timezone", default="America/New_York")
    a = ap.parse_args()
    org = a.target_org
    K.PRIVATE_SMF3.mkdir(parents=True, exist_ok=True)

    ident, disp = K.verify_target(org, a.allow_devhub_as_dev)
    K.say(f"[1] org identity: edition={ident['edition']} sandbox={ident['sandbox']} scratch={ident['is_scratch']} "
          f"api={ident['api_version']} language={ident['language']}")

    have = existing_users(org)
    missing = [p for p in SPEC if p not in have]
    free = free_licences(org)
    K.say(f"[2] licences: '{LICENSE}' free={free}; personas to create={len(missing)} ({', '.join(missing) or 'none'}); "
          f"baseline needs 3 ({', '.join(SPEC)})")
    if free < len(missing):
        K.exit_blocked(f"only {free} free '{LICENSE}' licence(s) for {len(missing)} persona(s) {missing}. Affected: "
                       "DATA-01..03 (and every case using those personas). Unblock: free or add Salesforce licences, "
                       "or use an org shape with more (SMF-2 ENV-02); never drop MF-RESTRICTED.")

    prof = K.query(org, f"SELECT Id, UserLicense.Name FROM Profile WHERE Name = {K.soql_str(PROFILE)}")
    if len(prof) != 1 or prof[0]["UserLicense"]["Name"] != LICENSE:
        K.exit_blocked(f"profile '{PROFILE}' with licence '{LICENSE}' not found (got {len(prof)}). Unblock: use an org "
                       "where the standard profile exists; a broader profile needs a recorded owner decision.")
    K.say(f"[3] profile '{PROFILE}' present (licence {LICENSE})")
    if not K.query(org, f"SELECT Id FROM PermissionSet WHERE Name = {K.soql_str(CASE_WORKER)}"):
        K.exit_blocked(f"permission set {CASE_WORKER} not deployed. Unblock: sf project deploy start --metadata-dir "
                       f"testing/provisioning/metadata --target-org {org} (pipeline stage 30)")
    app_present = bool(K.query(org, f"SELECT Id FROM PermissionSet WHERE Name = {K.soql_str(APP_PERMSET)}"))
    if not app_present:
        K.say(f"[3] {APP_PERMSET} not in org yet (SMF-4 deliverable): app access is not assigned; rerun after SMF-4")

    if missing and not ident["is_scratch"]:
        K.exit_blocked("persona users are created with `sf org create user`, which supports scratch orgs only; the "
                       "target is not a scratch org. Unblock: use smf-dev (SMF-2 stage 20) or record an owner decision "
                       "for the non-scratch fallback in docs/smf-2/setup-path.md.")
    for p in missing:
        want = SPEC[p]["permsets"] + ([APP_PERMSET] if app_present else [])
        create_user(org, p, a.timezone, want)
        K.say(f"[4] created {p} with alias {cli_alias(org, p)} (username/ID/password stay private)")
    if missing:
        have = existing_users(org)

    mapping = K.read_private("personas.json", {}) or {}
    admin_user, admin_id = K.running_user(disp)
    mapping["MF-ADMIN"] = {"org": a.org_role, "org_alias": org, "username": admin_user, "user_id": admin_id,
                           "note": "authenticated admin running the SMF-3 scripts"}
    asg = assignments(org, [have[p]["Id"] for p in SPEC])
    deviations = []
    for p, s in SPEC.items():
        u = have[p]
        want = s["permsets"] + ([APP_PERMSET] if app_present else [])
        got = {r["PermissionSet"]["Name"]: r for r in asg.get(u["Id"], [])}
        for name in want:
            if name not in got:
                K.sf(["org", "assign", "permset", "--name", name, "--on-behalf-of", u["Username"]], org)
                K.say(f"[5] assigned {name} -> {p}")
        for n in [n for n in got if n not in want]:
            deviations.append((p, "extra permission set", n))
            if a.reconcile:
                K.sf(["data", "delete", "record", "--sobject", "PermissionSetAssignment", "--record-id", got[n]["Id"]], org)
                K.say(f"[6] removed extra permission set {n} from {p}")
        bad_user = u["Profile"]["Name"] != PROFILE or u["UserRoleId"] or not u["IsActive"]
        if bad_user:
            deviations.append((p, "profile/role/active", "differs from baseline"))
            if a.reconcile:
                prof_id = prof[0]["Id"]
                body = K.PRIVATE_SMF3 / "reconcile-user.apex"
                body.write_text(f"User u = [SELECT Id FROM User WHERE Id = '{u['Id']}'];\n"
                                f"u.ProfileId = '{prof_id}'; u.UserRoleId = null; u.IsActive = true;\nupdate u;\n", encoding="utf-8")
                ok, lines = K.apex(org, body)
                body.unlink()
                K.say(f"[6] reconciled profile/role/active for {p}: {'ok' if ok else lines}")
        alias = cli_alias(org, p)
        if alias_user_id(alias) != u["Id"]:
            deviations.append((p, "CLI alias", f"{alias} missing or not this user (restore the vault, ADR-0004)"))
        mapping[p] = {"org": a.org_role, "org_alias": org, "cli_alias": alias, "username": u["Username"],
                      "user_id": u["Id"], "profile": PROFILE, "role": None, "permission_sets": want}
    K.write_private("personas.json", mapping)
    K.say("[7] wrote private/personas.json (real usernames/IDs; git-ignored)")
    fixable = {"extra permission set", "profile/role/active"}
    open_dev = [d for d in deviations if not (a.reconcile and d[1] in fixable)]
    for p, kind, detail in open_dev:
        K.say(f"DEVIATION {p}: {kind}: {detail}")
    K.say("RESULT: personas match the baseline" if not open_dev else f"RESULT: {len(open_dev)} deviation(s) remain")
    return 2 if open_dev else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except K.SfError as e:
        K.say(f"ERROR: {e}")
        sys.exit(1)
