"""scripts/cloud/sf_credential.py: secret only on stdin, verified status, no value in output. No org access."""
import importlib.util, io, json, unittest
from contextlib import redirect_stdout
from pathlib import Path
from types import SimpleNamespace

SCRIPTS = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("sf_credential", SCRIPTS / "cloud" / "sf_credential.py")
C = importlib.util.module_from_spec(spec)
spec.loader.exec_module(C)
SECRET = "s3cr3t-" + "x" * 30


class Runner:
    def __init__(self, exists=False, write_status=201, stores=True):
        self.exists, self.write_status, self.stores, self.calls = exists, write_status, stores, []
        self.written = False

    def __call__(self, args, input=None, **kw):
        self.calls.append((args, input))
        method, path = args[args.index("--method") + 1], args[4]
        if method == "GET" and "/credential?" in path:
            if self.written and self.stores:   # Salesforce returns the entry without its value
                body = {"authenticationStatus": "Unknown", "credentials": {"ApiToken": {"encrypted": True, "id": "0pw", "revision": 1}}}
            else:
                body = {"credentials": {"ApiToken": {}}} if self.exists else {}
            res = {"statusCode": 200, "body": body}
        elif method in ("POST", "PUT"):
            self.written = self.write_status < 400
            res = {"statusCode": self.write_status, "body": {} if self.write_status < 400 else [{"errorCode": "INVALID_INPUT"}]}
        else:
            res = {"statusCode": 404, "body": {}}
        return SimpleNamespace(stdout=json.dumps({"status": 0, "result": res}), returncode=0)


class Credential(unittest.TestCase):
    def test_creates_when_absent_and_secret_only_on_stdin(self):
        r = Runner()
        ok, msg = C.set_parameter("org", "X", "P", "ApiToken", SECRET, runner=r)
        self.assertTrue(ok)
        writes = [c for c in r.calls if "POST" in c[0]]
        self.assertEqual(len(writes), 1)
        self.assertNotIn(SECRET, " ".join(writes[0][0]))
        self.assertIn(SECRET, writes[0][1])
        self.assertNotIn(SECRET, msg)

    def test_updates_when_present(self):
        r = Runner(exists=True)
        self.assertTrue(C.set_parameter("org", "X", "P", "ApiToken", SECRET, runner=r)[0])
        self.assertTrue(any("PUT" in c[0] for c in r.calls))

    def test_write_error_reports_code_not_value(self):
        ok, msg = C.set_parameter("org", "X", "P", "ApiToken", SECRET, runner=Runner(write_status=400))
        self.assertFalse(ok)
        self.assertIn("INVALID_INPUT", msg)
        self.assertNotIn(SECRET, msg)

    def test_unverified_write_is_not_success(self):
        ok, msg = C.set_parameter("org", "X", "P", "ApiToken", SECRET, runner=Runner(stores=False))
        self.assertFalse(ok)
        self.assertNotIn(SECRET, msg)

    def test_custom_protocol_unknown_status_with_stored_parameter_is_success(self):
        ok, msg = C.set_parameter("org", "X", "P", "ApiToken", SECRET, runner=Runner())
        self.assertTrue(ok)
        self.assertIn("revision 1", msg)

    def test_missing_env_value_blocks(self):
        buf = io.StringIO()
        with redirect_stdout(buf):
            rc = C.main(["--target-org", "o", "--external-credential", "X", "--principal", "P",
                         "--parameter", "ApiToken", "--from-env", "SMF_TEST_UNSET_VAR"])
        self.assertEqual(rc, 2)
        self.assertIn("BLOCKED", buf.getvalue())


if __name__ == "__main__":
    unittest.main()
