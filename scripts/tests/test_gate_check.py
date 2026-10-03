"""Negative and positive tests for scripts/gate-check.py (SMF-15 GATE-01). No org access."""
import importlib.util, tempfile, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent
spec = importlib.util.spec_from_file_location("gate_check", SCRIPTS / "gate-check.py")
GC = importlib.util.module_from_spec(spec)
spec.loader.exec_module(GC)

REQUIRED = {"ENV-DESKTOP-CHROME", "ENV-DESKTOP-EDGE", "ENV-SFMOBILE-IOS", "ENV-SFMOBILE-ANDROID", "n/a"}
GOOD = {"Persona pair": "MF-TECH", "Build / commit": "abc1234", "Timestamp": "2026-10-03T10:00:00Z",
        "Host / device / OS / app / browser": "Microsoft Edge 154 on Windows 11", "Tester": "Brandon",
        "Steps": "1. open the app", "Outcome": "PASS"}


class GateCheck(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.saved = GC.ROOT
        GC.ROOT = self.root

    def tearDown(self):
        GC.ROOT = self.saved
        self.tmp.cleanup()

    def row(self, env, executor="agent", outcome="PASS", **fields):
        rec = dict(GOOD, **fields)
        p = self.root / "evidence" / "SMF-X" / "CASE.md"
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text("| Field | Value |\n|---|---|\n" + "".join(f"| {k} | {v} |\n" for k, v in rec.items()))
        return {"row_id": f"CASE@{env}", "environment": env, "outcome": outcome,
                "executor": executor, "evidence": "evidence/SMF-X/CASE.md"}

    def reasons(self, r):
        return [e[:2] for e in GC.check_row(r, REQUIRED)]

    def test_valid_desktop_pass_accepted(self):
        self.assertEqual(self.reasons(self.row("ENV-DESKTOP-EDGE", executor="human")), [])

    def test_valid_mobile_pass_accepted(self):
        r = self.row("ENV-SFMOBILE-IOS", executor="human",
                     **{"Host / device / OS / app / browser": "iPhone 15, iOS 18.4, Salesforce app 252.010"})
        self.assertEqual(self.reasons(r), [])

    def test_missing_evidence_rejected(self):
        r = {"row_id": "X", "environment": "ENV-DESKTOP-EDGE", "outcome": "PASS", "evidence": "evidence/nope.md"}
        self.assertEqual(self.reasons(r), ["E1"])

    def test_missing_field_rejected(self):
        self.assertIn("E1", self.reasons(self.row("ENV-DESKTOP-EDGE", **{"Build / commit": ""})))

    def test_localhost_for_required_row_rejected(self):
        r = self.row("ENV-DESKTOP-EDGE", **{"Host / device / OS / app / browser": "localhost:5173 vite preview"})
        self.assertIn("E2", self.reasons(r))

    def test_chromium_for_chrome_rejected(self):
        r = self.row("ENV-DESKTOP-CHROME", **{"Host / device / OS / app / browser": "Playwright Chromium 141"})
        self.assertIn("E2", self.reasons(r))

    def test_emulator_for_mobile_rejected(self):
        r = self.row("ENV-SFMOBILE-ANDROID", executor="human",
                     **{"Host / device / OS / app / browser": "Android emulator, Salesforce app"})
        self.assertIn("E2", self.reasons(r))

    def test_mobile_without_salesforce_app_rejected(self):
        r = self.row("ENV-SFMOBILE-IOS", executor="human",
                     **{"Host / device / OS / app / browser": "iPhone 15, Safari"})
        self.assertIn("E3", self.reasons(r))

    def test_agent_only_for_human_row_rejected(self):
        r = self.row("ENV-SFMOBILE-IOS", executor="human", Tester="Implementing agent",
                     **{"Host / device / OS / app / browser": "iPhone 15, iOS 18, Salesforce app 252"})
        self.assertIn("E4", self.reasons(r))

    def test_admin_session_rejected(self):
        self.assertIn("E5", self.reasons(self.row("ENV-DESKTOP-EDGE", **{"Persona pair": "admin session"})))

    def test_supplementary_localhost_pass_allowed(self):
        r = self.row("ENV-EMULATION-LOCALHOST", **{"Host / device / OS / app / browser": "localhost"})
        self.assertEqual(self.reasons(r), [])

    def test_blocked_rows_not_judged(self):
        self.assertEqual(self.reasons(self.row("ENV-DESKTOP-EDGE", outcome="BLOCKED", Tester="")), [])


if __name__ == "__main__":
    unittest.main()
