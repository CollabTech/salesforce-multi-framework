"""Offline unit tests for SMF-5 packaging helpers (no org access).

Run: python3 -m unittest discover -s scripts/tests -v
"""
import copy, importlib.util, json, unittest
from pathlib import Path

SCRIPTS = Path(__file__).resolve().parent.parent
ROOT = SCRIPTS.parent


def load(name):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / "smf5" / f"{name}.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


CP, SV, SS, SR = load("check_package"), load("set_version"), load("state_snapshot"), load("sanitize_report")
PROJECT = json.loads((ROOT / "sfdx-project.json").read_text(encoding="utf-8"))
MARKER = (ROOT / CP.MARKER_FILE).read_text(encoding="utf-8")


class ProjectDefinition(unittest.TestCase):
    def test_committed_project_is_valid(self):
        self.assertEqual(CP.check_project(PROJECT), [])
        self.assertEqual(CP.check_marker(PROJECT, MARKER), [])
        self.assertEqual(CP.check_app_and_permset(ROOT), [])

    def test_unpackaged_dir_is_not_in_a_package(self):
        un = [d for d in PROJECT["packageDirectories"] if d["path"] == "unpackaged"]
        self.assertEqual(len(un), 1)
        self.assertNotIn("package", un[0])

    def test_committed_package_ids_are_rejected(self):
        p = copy.deepcopy(PROJECT)
        p["packageAliases"] = {"FieldSupportPoC": "0Ho" + "A" * 15}
        self.assertTrue(any("packageAliases" in e for e in CP.check_project(p)))

    def test_ancestor_keys_rejected_for_unlocked(self):
        p = copy.deepcopy(PROJECT)
        p["packageDirectories"][0]["ancestorVersion"] = "HIGHEST"
        self.assertTrue(any("ancestorVersion" in e for e in CP.check_project(p)))

    def test_namespace_must_be_empty(self):
        p = copy.deepcopy(PROJECT)
        p["namespace"] = "smf"
        self.assertTrue(CP.check_project(p))


class Members(unittest.TestCase):
    XML = ('<?xml version="1.0"?><Package xmlns="http://soap.sforce.com/2006/04/metadata">'
           '<types><members>FieldSupport</members><name>CustomApplication</name></types>'
           '<types><members>FieldSupport_Access</members><members>MF_Case_Worker</members><name>PermissionSet</name></types>'
           '<types><members>FieldSupport</members><name>UIBundle</name></types></Package>')

    def test_fixture_permset_in_package_dir_fails(self):
        errs = CP.check_members(CP.parse_manifest(self.XML))
        self.assertEqual(len(errs), 1)
        self.assertIn("PermissionSet:MF_Case_Worker", errs[0])

    def test_exact_set_passes(self):
        self.assertEqual(CP.check_members(set(CP.EXPECTED)), [])


class Versions(unittest.TestCase):
    def test_v2_changes_only_marker_and_version(self):
        text, proj = SV.apply("v2", MARKER, copy.deepcopy(PROJECT))
        self.assertIn("{ label: 'v2', number: '1.1.0' }", text)
        self.assertEqual(proj["packageDirectories"][0]["versionNumber"], "1.1.0.NEXT")
        self.assertEqual(CP.check_marker(proj, text), [])
        self.assertEqual(CP.check_project(proj), [])
        changed = [l for l in text.splitlines() if l not in MARKER.splitlines()]
        self.assertEqual(len(changed), 1)

    def test_v1_round_trip_is_identity(self):
        t2, p2 = SV.apply("v2", MARKER, copy.deepcopy(PROJECT))
        t1, p1 = SV.apply("v1", t2, p2)
        self.assertEqual(t1, MARKER)
        self.assertEqual(p1, PROJECT)

    def test_mismatched_marker_detected(self):
        text, _ = SV.apply("v2", MARKER, copy.deepcopy(PROJECT))
        self.assertTrue(CP.check_marker(PROJECT, text))


class StateSnapshot(unittest.TestCase):
    CASE = [{"Id": "x", "Subject": "Pump overheating", "Status": "New"}]
    FILES = [{"ContentDocumentId": "y", "ContentDocument.LatestPublishedVersion.Checksum": "abc"}]

    def test_queries_are_read_only(self):
        for q in (SS.case_query("0XX000000000001"), SS.files_query("0XX000000000001")):
            self.assertTrue(q.startswith("SELECT "))
            self.assertNotRegex(q.upper(), r"\b(INSERT|UPDATE|DELETE|UPSERT)\b")

    def test_flatten_drops_attributes(self):
        rec = {"attributes": {"type": "X"}, "ContentDocument": {"attributes": {}, "Title": "t",
               "LatestPublishedVersion": {"attributes": {}, "Checksum": "c"}}}
        self.assertEqual(SS.flatten(rec), {"ContentDocument.Title": "t",
                                           "ContentDocument.LatestPublishedVersion.Checksum": "c"})

    def test_identical_and_changed(self):
        a = {"case": self.CASE, "files": self.FILES}
        self.assertEqual(SS.compare(a, copy.deepcopy(a)), [])
        b = copy.deepcopy(a)
        b["case"][0]["Status"] = "Closed"
        b["files"] = []
        diffs = SS.compare(a, b)
        self.assertIn("case[0].Status changed", diffs)
        self.assertIn("files: record count 1 -> 0", diffs)
        self.assertFalse(any("Closed" in d or "New" in d for d in diffs))

    def test_summary_prints_no_values(self):
        s = json.dumps(SS.summarize({"case": self.CASE, "files": self.FILES}))
        self.assertNotIn("Pump", s)
        self.assertNotIn("abc", s)

    def test_case_id_validation(self):
        with self.assertRaises(SystemExit):
            SS.resolve_case_id({}, "install-test")
        with self.assertRaises(SystemExit):
            SS.resolve_case_id({"MF-CASE-001": {"install-test": "x'; DELETE"}}, "install-test")
        self.assertEqual(SS.resolve_case_id({"MF-CASE-001": {"install-test": "0XX000000000001"}}, "install-test"),
                         "0XX000000000001")


class SanitizeReport(unittest.TestCase):
    def test_ids_users_urls_and_tokens_removed(self):
        pkg = "04t" + "Ab1" * 4 + "XYZ"
        raw = {"status": 0, "warnings": ["w"], "result": [{
            "Status": "Success", "SubscriberPackageVersionId": pkg, "Version": "1.0.0.1",
            "CreatedBy": "someone", "Username": "admin@example.com",
            "Error": [f"Install of {pkg} failed at https://x.my.salesforce.com/p for admin@example.com"],
            "accessToken": "abc", "CodeCoverage": 100, "IsOrgDependent": True}]}
        out = SR.sanitize(raw)
        text = json.dumps(out)
        self.assertNotIn(pkg, text)
        self.assertNotIn("example.com", text)
        self.assertNotIn("salesforce.com", text)
        self.assertNotIn("abc", text)
        self.assertNotIn("warnings", out)
        r = out["result"][0]
        self.assertEqual((r["Status"], r["Version"], r["CodeCoverage"], r["IsOrgDependent"]),
                         ("Success", "1.0.0.1", 100, True))
        self.assertEqual(r["SubscriberPackageVersionId"], "<04t-id>")


class PkgFlow(unittest.TestCase):
    PF = load("pkgflow")

    def test_pick_version_matches_label_tag_and_validation(self):
        tag = self.PF.version_tag("v1", "a" * 40)
        vs = [{"Version": "1.0.0.1", "Tag": tag, "ValidationSkipped": False, "SubscriberPackageVersionId": "A"},
              {"Version": "1.0.0.3", "Tag": tag, "ValidationSkipped": False, "SubscriberPackageVersionId": "C"},
              {"Version": "1.0.0.4", "Tag": tag, "ValidationSkipped": True, "SubscriberPackageVersionId": "D"},
              {"Version": "1.0.0.5", "Tag": "other", "ValidationSkipped": False, "SubscriberPackageVersionId": "E"},
              {"Version": "1.1.0.1", "Tag": tag, "ValidationSkipped": False, "SubscriberPackageVersionId": "F"}]
        self.assertEqual(self.PF.pick_version(vs, "v1", tag)["SubscriberPackageVersionId"], "C")
        self.assertEqual(self.PF.pick_version(vs, "v2", tag)["SubscriberPackageVersionId"], "F")
        self.assertIsNone(self.PF.pick_version(vs, "v1", "nope"))

    def test_installed_and_ids(self):
        inst = [{"SubscriberPackageName": "Other"}, {"SubscriberPackageName": "FieldSupportPoC", "SubscriberPackageVersionId": "x" * 18}]
        self.assertEqual(self.PF.installed_version(inst)["SubscriberPackageName"], "FieldSupportPoC")
        self.assertTrue(self.PF.same_id("x" * 18, "x" * 15))
        self.assertFalse(self.PF.same_id("", ""))

    def test_beta_refusal_detection(self):
        self.assertTrue(self.PF.is_beta_upgrade_refusal("Cannot upgrade beta package"))
        self.assertFalse(self.PF.is_beta_upgrade_refusal("Installation key required"))

    def test_stage_files_target_explicit_orgs(self):
        stages = sorted((ROOT / "scripts/cloud/stages").glob("6[0-4]-smf5-*.sh"))
        self.assertEqual([p.name[:2] for p in stages], ["60", "61", "62", "63", "64"])
        for p in stages:
            text = p.read_text(encoding="utf-8")
            self.assertRegex(text, r"(?m)^# needs: [0-9 ]+$")
            self.assertNotRegex(text, r"--target-org[ =]smf-dev\b(?!-)")  # never the dev org


if __name__ == "__main__":
    unittest.main()
