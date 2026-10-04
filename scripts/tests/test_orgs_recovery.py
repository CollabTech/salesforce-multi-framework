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
        if args[:2] == ["data", "query"]:
            q = args[3]
            if "FROM ScratchOrgInfo" in q:
                return {"status": 0, "result": {"records": self.active}}
            if "FROM ActiveScratchOrg" in q:
                return {"status": 0, "result": {"records": [{"Id": "0Ex"}]}}
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

    def test_explicit_recreate_deletes_via_devhub_then_creates(self):
        f = FakeSf(active=[ACTIVE])
        self.assertEqual(self.ensure(f, dict(URL, SMF_RECREATE_DEV="yes")), "created")
        self.assertEqual(len(f.did("data", "delete", "record")), 1)

    def test_authurl_login_passes_secret_on_stdin_only(self):
        seen = []
        def sf(args, stdin=None):
            seen.append((args, stdin))
            return {"status": 0}
        O.Orgs(sf=sf, env=URL).login_devhub()
        args, stdin = seen[0]
        self.assertEqual(stdin, "force://x")
        self.assertNotIn("force://x", " ".join(args))

    def test_no_credential_blocks(self):
        with self.assertRaises(O.Blocked):
            O.Orgs(sf=FakeSf(), env={}).login_devhub()


if __name__ == "__main__":
    unittest.main()
