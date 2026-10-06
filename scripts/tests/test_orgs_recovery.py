"""scripts/cloud/orgs.py: a missing local alias must never cause a duplicate scratch org. No org access."""
import importlib.util, tempfile, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("orgs", SCRIPTS / "cloud" / "orgs.py")
O = importlib.util.module_from_spec(spec)
spec.loader.exec_module(O)

JWT = {"SF_DEVHUB_USERNAME": "hub@example.com", "SF_DEVHUB_CLIENT_ID": "cid", "SF_DEVHUB_JWT_KEY": "k"}
URL = {"SF_AUTH_URL_DEVHUB": "force://x"}
ACTIVE = {"Id": "2SR", "SignupUsername": "admin.scratch@example.com", "LoginUrl": "https://test.salesforce.com",
          "ScratchOrg": "00D" + "A" * 12, "ExpirationDate": "2026-11-01"}


class FakeSf:
    def __init__(self, active=(), local=None, jwt_ok=True):
        self.active, self.local, self.jwt_ok, self.calls = list(active), local, jwt_ok, []

    def __call__(self, args, stdin=None):
        self.calls.append(args)
        if args[:3] == ["data", "delete", "record"] and hasattr(self, "after_delete_active"):
            self.active = self.after_delete_active
        if args[:2] == ["data", "query"]:
            q = args[3]
            if "FROM ScratchOrgInfo" in q:
                return {"status": 0, "result": {"records": self.active}}
            if "FROM ActiveScratchOrg" in q:
                return {"status": 0, "result": {"records": [{"Id": "0Ex", "ScratchOrg": ACTIVE["ScratchOrg"]}]}}
            return {"status": 0, "result": {"records": []}}
        if args[:2] == ["org", "display"]:
            return {"status": 0, "result": {"username": self.local}} if self.local else {"status": 1}
        if args[:3] == ["org", "login", "jwt"]:
            return {"status": 0 if self.jwt_ok else 1}
        return {"status": 0}

    def did(self, *prefix):
        return [c for c in self.calls if c[:len(prefix)] == list(prefix)]


class Recovery(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.saved = O.PRIVATE, O.KEY_FILE
        O.PRIVATE = Path(self.tmp.name)
        O.KEY_FILE = O.PRIVATE / "k"

    def tearDown(self):
        O.PRIVATE, O.KEY_FILE = self.saved
        self.tmp.cleanup()

    def ensure(self, fake, env, create=True):
        return O.Orgs(sf=fake, env=env).ensure("smf-dev", create=create)

    def test_missing_alias_with_existing_org_and_authurl_blocks_without_creating(self):
        f = FakeSf(active=[ACTIVE])
        with self.assertRaises(O.Blocked) as e:
            self.ensure(f, URL)
        self.assertIn("Not creating a duplicate", str(e.exception))
        self.assertEqual(f.did("org", "create"), [])

    def test_missing_alias_with_existing_org_and_jwt_recovers(self):
        f = FakeSf(active=[ACTIVE])
        self.assertEqual(self.ensure(f, JWT), "recovered")
        self.assertEqual(f.did("org", "create"), [])
        self.assertIn("admin.scratch@example.com", f.did("org", "login", "jwt")[0])

    def test_jwt_rejected_blocks_without_creating(self):
        f = FakeSf(active=[ACTIVE], jwt_ok=False)
        with self.assertRaises(O.Blocked):
            self.ensure(f, JWT)
        self.assertEqual(f.did("org", "create"), [])

    def test_matching_local_alias_is_present(self):
        f = FakeSf(active=[ACTIVE], local="Admin.Scratch@example.com")
        self.assertEqual(self.ensure(f, URL), "present")

    def test_two_active_orgs_block(self):
        f = FakeSf(active=[ACTIVE, dict(ACTIVE, SignupUsername="b@x")])
        with self.assertRaises(O.Blocked):
            self.ensure(f, JWT)
        self.assertEqual(f.did("org", "create"), [])

    def test_none_active_creates_only_when_requested(self):
        with self.assertRaises(O.Blocked):
            self.ensure(FakeSf(), URL, create=False)
        f = FakeSf()
        self.assertEqual(self.ensure(f, URL, create=True), "created")
        self.assertEqual(len(f.did("org", "create", "scratch")), 1)

    def test_stale_local_alias_blocks(self):
        f = FakeSf(local="old.scratch@example.com")
        with self.assertRaises(O.Blocked):
            self.ensure(f, URL)
        self.assertEqual(f.did("org", "create"), [])

    # ---- replacement flags must never act during recovery or startup ----------------------
    FLAGS = {"SMF_RECREATE_DEV": "yes", "SMF_RECREATE_INSTALL_TEST": "yes"}

    def test_recovery_only_with_flags_present_authurl_blocks_and_deletes_nothing(self):
        f = FakeSf(active=[ACTIVE])
        with self.assertRaises(O.Blocked):
            O.Orgs(sf=f, env=dict(URL, **self.FLAGS)).ensure("smf-dev", create=False)
        self.assertEqual(f.did("data", "delete"), [])
        self.assertEqual(f.did("org", "delete"), [])
        self.assertEqual(f.did("org", "create"), [])

    def test_recovery_only_with_flags_present_jwt_recovers_and_deletes_nothing(self):
        f = FakeSf(active=[ACTIVE])
        self.assertEqual(O.Orgs(sf=f, env=dict(JWT, **self.FLAGS)).ensure("smf-dev", create=False), "recovered")
        self.assertEqual(f.did("data", "delete"), [])
        self.assertEqual(f.did("org", "create"), [])

    def test_stage20_create_true_with_flags_present_never_replaces(self):
        f = FakeSf(active=[ACTIVE], jwt_ok=False)
        with self.assertRaises(O.Blocked):
            O.Orgs(sf=f, env=dict(JWT, **self.FLAGS)).ensure("smf-dev", create=True)
        self.assertEqual(f.did("data", "delete"), [])
        self.assertEqual(f.did("org", "create"), [])

    def test_ensure_never_deletes_in_any_state(self):
        for active, local, jwt_ok in ((ACTIVE,), None, True), ((ACTIVE,), None, False), ((), "x@example.com", True), ((), None, True):
            for env in (URL, JWT):
                f = FakeSf(active=list(active), local=local, jwt_ok=jwt_ok)
                try:
                    O.Orgs(sf=f, env=dict(env, **self.FLAGS)).ensure("smf-dev", create=True)
                except O.Blocked:
                    pass
                self.assertEqual(f.did("data", "delete"), [], (active, local, env))

    def test_connect_orgs_script_has_no_replace_path(self):
        script = (SCRIPTS / "cloud" / "connect-orgs.sh").read_text()
        stage20 = (SCRIPTS / "cloud" / "stages" / "20-orgs.sh").read_text()
        for text in (script, stage20):
            self.assertNotIn("replace", text)
            self.assertNotIn("SMF_RECREATE", text)

    # ---- explicit, bound replacement --------------------------------------------------------
    def hub_identity(self, org_id="00D" + "H" * 12):
        O.save_private("identity.json", {O.DEVHUB: {"org_id": org_id}})

    def test_replace_bound_to_matching_org_deletes_once_then_creates(self):
        self.hub_identity()
        f = FakeSf(active=[ACTIVE])
        f.after_delete_active = []
        self.assertEqual(O.Orgs(sf=f, env=URL).replace("smf-dev", ACTIVE["ScratchOrg"], ACTIVE["SignupUsername"]), "created")
        self.assertEqual(len(f.did("data", "delete", "record")), 1)
        self.assertEqual(len(f.did("org", "create", "scratch")), 1)

    def test_replace_wrong_org_id_or_username_deletes_nothing(self):
        self.hub_identity()
        for oid, user in (("00D" + "Z" * 12, ACTIVE["SignupUsername"]), (ACTIVE["ScratchOrg"], "other@example.com"), ("", "")):
            f = FakeSf(active=[ACTIVE])
            with self.assertRaises(O.Blocked):
                O.Orgs(sf=f, env=URL).replace("smf-dev", oid, user)
            self.assertEqual(f.did("data", "delete"), [])
            self.assertEqual(f.did("org", "create"), [])

    def test_replace_refuses_devhub_or_unverified_hub(self):
        f = FakeSf(active=[ACTIVE])
        with self.assertRaises(O.Blocked):   # no verified Dev Hub identity this session
            O.Orgs(sf=f, env=URL).replace("smf-dev", ACTIVE["ScratchOrg"], ACTIVE["SignupUsername"])
        self.hub_identity(org_id=ACTIVE["ScratchOrg"])
        with self.assertRaises(O.Blocked):   # target is the Dev Hub
            O.Orgs(sf=f, env=URL).replace("smf-dev", ACTIVE["ScratchOrg"], ACTIVE["SignupUsername"])
        self.assertEqual(f.did("data", "delete"), [])

    def test_replace_does_not_create_if_old_org_still_active(self):
        self.hub_identity()
        f = FakeSf(active=[ACTIVE])   # delete "succeeds" but the Dev Hub still lists the org
        with self.assertRaises(O.Blocked):
            O.Orgs(sf=f, env=URL).replace("smf-dev", ACTIVE["ScratchOrg"], ACTIVE["SignupUsername"])
        self.assertEqual(f.did("org", "create"), [])

    def test_authurl_login_passes_secret_on_stdin_only(self):
        seen = []
        def sf(args, stdin=None):
            seen.append((args, stdin))
            return {"status": 0}
        O.Orgs(sf=sf, env=URL).login_devhub()
        args, stdin = seen[0]
        self.assertEqual(stdin, "force://x")
        self.assertNotIn("force://x", " ".join(args))

    def test_authurl_preferred_over_jwt_and_no_client_id_on_create(self):
        self.assertEqual(O.Orgs(sf=FakeSf(), env=dict(JWT, **URL)).auth_mode(), "authurl")
        f = FakeSf()
        O.Orgs(sf=f, env=dict(JWT, **URL)).ensure("smf-dev", create=True)
        create = f.did("org", "create", "scratch")[0]
        self.assertNotIn("--client-id", create)
        self.assertIn("--target-dev-hub", create)

    def test_no_credential_blocks(self):
        with self.assertRaises(O.Blocked):
            O.Orgs(sf=FakeSf(), env={}).login_devhub()


if __name__ == "__main__":
    unittest.main()
