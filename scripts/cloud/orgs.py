#!/usr/bin/env python3
"""Dev Hub login, org identity checks, and duplicate-safe scratch-org recovery. Never prints secrets.

Replaces the ADR-0004 vault for cross-session recovery (ADR-0004 rev 2, vault disabled).

Dev Hub auth, chosen from environment secrets:
  JWT (preferred):  SF_DEVHUB_USERNAME, SF_DEVHUB_CLIENT_ID, SF_DEVHUB_JWT_KEY (PEM text),
                    optional SF_DEVHUB_INSTANCE_URL (default https://login.salesforce.com)
  auth URL:         SF_AUTH_URL_DEVHUB

Recovery: scratch orgs are found on the server side through the Dev Hub's ScratchOrgInfo
records (matched on the definition file's OrgName), never by the local alias. That has two
consequences:
  - a missing local alias never leads to a second scratch org;
  - with JWT Dev Hub auth, the scratch-org admin and persona users are re-authorized with
    `sf org login jwt` using the Dev Hub connected app and key. @salesforce/core does the same
    when it creates a scratch org or user from a JWT-authorized hub (scratchOrgInfoApi.js
    buildOAuth2Options; user.js createUser copies the admin's privateKey).
Recovery is impossible with auth-URL Dev Hub auth (no private key). The role is then BLOCKED
with the existing org's expiry. It is never silently recreated: creating a replacement needs
SMF_RECREATE_<ROLE>=yes, and that deletes the old org first.

  orgs.py devhub                 log in as smf-devhub; verify identity (writes private/identity.json)
  orgs.py ensure ROLE [--create] recover or (with --create, none active) create ROLE
  orgs.py personas ROLE          recover persona aliases ROLE-tech|support|restricted (JWT only)
ROLE is smf-dev or smf-install-test. Exit codes: 0 OK, 2 BLOCKED, 1 error.
"""
import json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "private"
DEVHUB = "smf-devhub"
DEFS = {"smf-dev": "config/smf-dev-scratch-def.json",
        "smf-install-test": "config/smf-install-test-scratch-def.json"}
PERSONAS = {"MF-TECH": "tech", "MF-SUPPORT": "support", "MF-RESTRICTED": "restricted"}
KEY_FILE = PRIVATE / "devhub-jwt.key"


class Blocked(Exception):
    pass


def say(msg):
    print(f"[orgs] {msg}", file=sys.stderr)


def run_sf(args, stdin=None):
    """Run `sf ... --json`; returns parsed JSON (never echoes stdin or secrets)."""
    r = subprocess.run(["sf", *args, "--json"], input=stdin, capture_output=True, text=True,
                       env={**os.environ, "SF_DISABLE_TELEMETRY": "true"})
    try:
        out = json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        out = {}
    out.setdefault("status", r.returncode)
    return out


class Orgs:
    def __init__(self, sf=run_sf, env=None):
        self.sf = sf
        self.env = os.environ if env is None else env

    # ---- Dev Hub -------------------------------------------------------------------------
    def auth_mode(self):
        e = self.env
        if all(e.get(k) for k in ("SF_DEVHUB_USERNAME", "SF_DEVHUB_CLIENT_ID", "SF_DEVHUB_JWT_KEY")):
            return "jwt"
        if e.get("SF_AUTH_URL_DEVHUB"):
            return "authurl"
        return None

    def login_devhub(self):
        mode = self.auth_mode()
        if mode is None:
            raise Blocked("no Dev Hub credential in the environment (SF_DEVHUB_* JWT trio or SF_AUTH_URL_DEVHUB)")
        if mode == "jwt":
            PRIVATE.mkdir(exist_ok=True)
            os.chmod(PRIVATE, 0o700)
            KEY_FILE.write_text(self.env["SF_DEVHUB_JWT_KEY"].replace("\\n", "\n").strip() + "\n")
            os.chmod(KEY_FILE, 0o600)
            r = self.sf(["org", "login", "jwt", "--username", self.env["SF_DEVHUB_USERNAME"],
                         "--client-id", self.env["SF_DEVHUB_CLIENT_ID"], "--jwt-key-file", str(KEY_FILE),
                         "--instance-url", self.env.get("SF_DEVHUB_INSTANCE_URL", "https://login.salesforce.com"),
                         "--alias", DEVHUB])
        else:
            r = self.sf(["org", "login", "sfdx-url", "--sfdx-url-stdin", "-", "--alias", DEVHUB],
                        stdin=self.env["SF_AUTH_URL_DEVHUB"])
        if r.get("status") != 0:
            raise Blocked(f"Dev Hub login ({mode}) rejected, or Salesforce hosts not allowed by the network policy")
        return mode

    def query(self, alias, soql):
        r = self.sf(["data", "query", "--query", soql, "--target-org", alias])
        if r.get("status") != 0:
            raise Blocked(f"query on {alias} failed: {(r.get('message') or r.get('name') or 'unknown')[:160]}")
        return r.get("result", {}).get("records", [])

    def identity(self, alias):
        org = self.query(alias, "SELECT Id, OrganizationType, IsSandbox, InstanceName, TrialExpirationDate FROM Organization")[0]
        disp = self.sf(["org", "display", "--target-org", alias]).get("result", {})
        return {"org_id": org.get("Id", "")[:15], "edition": org.get("OrganizationType"),
                "sandbox": org.get("IsSandbox"), "instance": org.get("InstanceName"),
                "trial_expiration": org.get("TrialExpirationDate"), "username": disp.get("username"),
                "instance_url": disp.get("instanceUrl")}

    def verify_devhub(self):
        ident = self.identity(DEVHUB)
        try:
            self.query(DEVHUB, "SELECT Id FROM ScratchOrgInfo LIMIT 1")
            ident["devhub_enabled"] = True
        except Blocked:
            ident["devhub_enabled"] = False
        save_private("identity.json", {DEVHUB: ident})
        return ident

    # ---- scratch orgs --------------------------------------------------------------------
    @staticmethod
    def org_name(role):
        return json.loads((ROOT / DEFS[role]).read_text(encoding="utf-8"))["orgName"]

    def active_scratch(self, role):
        name = self.org_name(role).replace("\\", "\\\\").replace("'", "\\'")
        return self.query(DEVHUB, "SELECT Id, SignupUsername, LoginUrl, ScratchOrg, ExpirationDate, CreatedDate "
                                  f"FROM ScratchOrgInfo WHERE Status = 'Active' AND OrgName = '{name}' "
                                  "ORDER BY CreatedDate DESC")

    def alias_username(self, alias):
        r = self.sf(["org", "display", "--target-org", alias])
        return r.get("result", {}).get("username") if r.get("status") == 0 else None

    def jwt_login(self, username, instance_url, alias):
        r = self.sf(["org", "login", "jwt", "--username", username, "--client-id", self.env["SF_DEVHUB_CLIENT_ID"],
                     "--jwt-key-file", str(KEY_FILE), "--instance-url", instance_url, "--alias", alias])
        return r.get("status") == 0

    def ensure(self, role, create=False):
        """Returns 'present' | 'recovered' | 'created'; raises Blocked otherwise."""
        active = self.active_scratch(role)
        if len(active) > 1:
            raise Blocked(f"{len(active)} active scratch orgs named for {role}; resolve manually (no automatic choice)")
        local = self.alias_username(role)
        if active:
            rec = active[0]
            if local and local.lower() == rec["SignupUsername"].lower():
                return "present"
            exp = rec.get("ExpirationDate")
            if recreate_ok(self.env, role):
                # No local session to the old org is needed: the Dev Hub deletes it via its ActiveScratchOrg record.
                aso = self.query(DEVHUB, f"SELECT Id FROM ActiveScratchOrg WHERE ScratchOrg = '{rec['ScratchOrg'][:15]}'")
                r = self.sf(["data", "delete", "record", "--sobject", "ActiveScratchOrg", "--record-id", aso[0]["Id"],
                             "--target-org", DEVHUB]) if aso else {"status": 1}
                if r.get("status") != 0:
                    raise Blocked(f"{role}: SMF_RECREATE set but the existing org could not be deleted via the Dev Hub")
            elif self.auth_mode() == "jwt" and self.jwt_login(rec["SignupUsername"], rec.get("LoginUrl") or "https://test.salesforce.com", role):
                return "recovered"
            else:
                why = ("JWT login to the existing scratch org was rejected" if self.auth_mode() == "jwt"
                       else "the Dev Hub uses an auth URL, so the existing org cannot be re-authorized")
                raise Blocked(f"{role} exists (active until {exp}) but has no session here: {why}. "
                              "Not creating a duplicate. Remedy: JWT Dev Hub auth (HUMAN-SETUP H2), or "
                              f"SMF_RECREATE_{role_key(role)}=yes to delete and recreate it")
        elif local:
            raise Blocked(f"local alias {role} points to an org the Dev Hub does not list as active; "
                          "remove the stale alias (`sf alias unset`) and rerun")
        if not create:
            raise Blocked(f"{role} does not exist (no active ScratchOrgInfo); creation not requested")
        r = self.sf(["org", "create", "scratch", "--definition-file", DEFS[role], "--alias", role,
                     "--target-dev-hub", DEVHUB, "--duration-days", "30", "--wait", "30"])
        if r.get("status") != 0:
            raise Blocked(f"{role} creation failed: {(r.get('message') or '')[:160]}")
        return "created"

    def verify_scratch(self, role):
        """The org behind ROLE is a scratch org, is not the Dev Hub, and matches its ScratchOrgInfo."""
        ident = self.identity(role)
        hub = json.loads((PRIVATE / "identity.json").read_text()).get(DEVHUB, {}) if (PRIVATE / "identity.json").exists() else {}
        rec = self.active_scratch(role)
        problems = []
        if hub.get("org_id") and hub["org_id"] == ident["org_id"]:
            problems.append("is the Dev Hub itself")
        if not rec or rec[0].get("ScratchOrg", "")[:15] != ident["org_id"]:
            problems.append("does not match the Dev Hub's active ScratchOrgInfo for this role")
        data = json.loads((PRIVATE / "identity.json").read_text()) if (PRIVATE / "identity.json").exists() else {}
        data[role] = ident
        save_private("identity.json", data)
        if problems:
            raise Blocked(f"{role} identity check failed: " + "; ".join(problems))
        return ident

    def personas(self, role):
        if self.auth_mode() != "jwt":
            raise Blocked("persona aliases can be re-authorized only with JWT Dev Hub auth; "
                          "with an auth URL they exist only in the container that created them")
        users = self.query(role, "SELECT Username, FederationIdentifier FROM User WHERE IsActive = true AND "
                                 "FederationIdentifier IN ('MF-TECH','MF-SUPPORT','MF-RESTRICTED')")
        url = self.sf(["org", "display", "--target-org", role]).get("result", {}).get("instanceUrl")
        done, missing = [], []
        for u in users:
            alias = f"{role}-{PERSONAS[u['FederationIdentifier']]}"
            if (self.alias_username(alias) or "").lower() == u["Username"].lower() or self.jwt_login(u["Username"], url, alias):
                done.append(alias)
            else:
                missing.append(alias)
        absent = sorted(set(PERSONAS) - {u["FederationIdentifier"] for u in users})
        return done, missing, absent


def role_key(role):
    return role.replace("smf-", "").replace("-", "_").upper()


def recreate_ok(env, role):
    return env.get(f"SMF_RECREATE_{role_key(role)}") == "yes"


def save_private(name, data):
    PRIVATE.mkdir(exist_ok=True)
    p = PRIVATE / name
    p.write_text(json.dumps(data, indent=2) + "\n")
    os.chmod(p, 0o600)


def main(argv):
    if not argv:
        print(__doc__)
        return 1
    o = Orgs()
    cmd = argv[0]
    try:
        if cmd == "devhub":
            mode = o.login_devhub()
            ident = o.verify_devhub()
            say(f"OK  smf-devhub ({mode}); edition={ident['edition']} sandbox={ident['sandbox']} "
                f"instance={ident['instance']} devhub_enabled={ident['devhub_enabled']}")
            return 0 if ident["devhub_enabled"] else 2
        if cmd == "ensure":
            role = argv[1]
            state = o.ensure(role, create="--create" in argv)
            ident = o.verify_scratch(role)
            say(f"OK  {role} {state}; edition={ident['edition']} instance={ident['instance']} (not the Dev Hub)")
            return 0
        if cmd == "personas":
            done, missing, absent = o.personas(argv[1])
            say(f"personas {argv[1]}: ready={done} jwt_rejected={missing} not_provisioned={absent}")
            return 0 if not missing else 2
    except Blocked as b:
        say(f"BLOCKED {b}")
        return 2
    print(__doc__)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
