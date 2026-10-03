"""Offline unit tests for the SMF-3 deliverables (matrix, fixtures, provisioning kit).

Run: python3 -m unittest discover -s scripts/tests -v
No org access: these check repository content and script logic only.
"""
import copy, hashlib, importlib.util, json, re, sys, unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PROV = ROOT / "testing" / "provisioning"
sys.path.insert(0, str(PROV))
import sfkit  # noqa: E402


def load_module(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


BM = load_module("build_matrix", ROOT / "scripts" / "build-matrix.py")
INDEX = json.loads((ROOT / "testing" / "test-plan-index.json").read_text(encoding="utf-8"))
CONTRACT = json.loads((ROOT / "testing" / "contract.json").read_text(encoding="utf-8"))
MATRIX = json.loads((ROOT / "testing" / "matrix.json").read_text(encoding="utf-8"))
CASE1 = next(f for f in CONTRACT["fixtures"] if f["id"] == "MF-CASE-001")["definition"]


class Matrix(unittest.TestCase):
    def test_committed_matrix_is_valid(self):
        self.assertEqual(BM.validate(MATRIX, INDEX, CONTRACT), [])

    def test_every_row_starts_or_stays_truthful(self):
        for r in MATRIX["rows"]:
            if r["outcome"] != "NOT TESTED":
                self.assertTrue(r["evidence"], r["row_id"])

    def test_missing_case_is_reported(self):
        m = copy.deepcopy(MATRIX)
        m["rows"] = [r for r in m["rows"] if r["case"] != "DATA-04"]
        self.assertTrue(any("DATA-04" in e for e in BM.validate(m, INDEX, CONTRACT)))

    def test_outcome_without_evidence_is_rejected(self):
        m = copy.deepcopy(MATRIX)
        row = next(r for r in m["rows"] if r["outcome"] == "NOT TESTED")
        row["outcome"] = "PASS"
        errs = BM.validate(m, INDEX, CONTRACT)
        self.assertTrue(any(row["row_id"] in e and "evidence" in e for e in errs), errs)

    def test_outcome_must_match_linked_record(self):
        m = copy.deepcopy(MATRIX)
        row = next(r for r in m["rows"] if r["case"] == "GOV-01")
        row["outcome"] = "FAIL"
        self.assertTrue(any("records PASS" in e for e in BM.validate(m, INDEX, CONTRACT)))

    def test_mobile_rows_are_human_and_never_derived(self):
        for r in MATRIX["rows"]:
            if r["environment"].startswith("ENV-SFMOBILE"):
                self.assertTrue(r["executor"].startswith("human"), r["row_id"])

    def test_capability_areas_enumerated(self):
        self.assertEqual(sorted(CONTRACT["outcomes"]["capability_areas"]),
                         sorted(CONTRACT["outcomes"]["capability_area_cases"]))
        self.assertNotIn("draft", CONTRACT["outcomes"]["definitions_note"].lower())


class Fixtures(unittest.TestCase):
    def test_generator_matches_manifest(self):
        gen = load_module("gen", ROOT / "testing" / "fixtures" / "generate.py")
        man = json.loads((ROOT / "testing" / "fixtures" / "manifest.json").read_text(encoding="utf-8"))
        for (lid, rel, build, committed, _), e in zip(gen.FIXTURES, man["fixtures"]):
            data = build()
            self.assertEqual(hashlib.sha256(data).hexdigest(), e["sha256"], rel)
            if committed:
                self.assertEqual((ROOT / rel).read_bytes(), data, rel)

    def test_limits(self):
        man = json.loads((ROOT / "testing" / "fixtures" / "manifest.json").read_text(encoding="utf-8"))
        by = {(f["logical_id"], f["media_type"]): f for f in man["fixtures"]}
        self.assertLessEqual(by[("MF-IMAGE-001", "image/png")]["bytes"], 2 * 1024 * 1024)
        self.assertGreater(by[("MF-UPLOAD-INVALID", "image/png")]["bytes"], 5 * 1024 * 1024)
        self.assertIn(("MF-UPLOAD-INVALID", "text/plain"), by)

    def test_png_has_no_metadata_chunks_beyond_comment(self):
        data = (ROOT / "testing" / "fixtures" / "files" / "MF-IMAGE-001.png").read_bytes()
        kinds = [m.group(1) for m in re.finditer(rb"[\x00-\xff]{4}(IHDR|PLTE|tEXt|IDAT|IEND|eXIf|iTXt|zTXt|tIME)", data[8:200])]
        self.assertNotIn(b"eXIf", kinds)
        self.assertNotIn(b"tIME", kinds)


class ProvisioningKit(unittest.TestCase):
    def test_case_subject_matches_contract_everywhere(self):
        subject = "Pump overheating — remote diagnosis"
        self.assertIn(subject, CASE1)
        for p in ("apex/seed.apex", "apex/reset.apex", "fixtures.py", "apex-tests/classes/MF_AccessBaselineTest.cls"):
            self.assertIn(subject, (PROV / p).read_text(encoding="utf-8"), p)

    def test_persona_key_is_federation_identifier(self):
        for p in ("apex/seed.apex", "baseline.py", "personas.py", "apex-tests/classes/MF_AccessBaselineTest.cls"):
            text = (PROV / p).read_text(encoding="utf-8")
            self.assertIn("FederationIdentifier", text, p)
            self.assertNotIn("CommunityNickname", text, p)

    def test_permission_set_has_no_view_or_modify_all(self):
        xml = (PROV / "metadata" / "permissionsets" / "MF_Case_Worker.permissionset").read_text(encoding="utf-8")
        self.assertNotIn("<viewAllRecords>true", xml)
        self.assertNotIn("<modifyAllRecords>true", xml)
        self.assertNotIn("<userPermissions>", xml)   # no system permissions (no MFA waivers etc.)

    def test_no_public_links_or_restricted_grants_in_seed(self):
        seed = (PROV / "apex" / "seed.apex").read_text(encoding="utf-8")
        self.assertNotIn("insert new ContentDistribution", seed)
        grants = re.findall(r"new List<Object>\{ '(\w+)', '\w+', '\w+', [^,]+, '(MF-[A-Z]+)', '(\w+)' \}", seed)
        self.assertTrue(grants)
        self.assertFalse([g for g in grants if g[1] == "MF-RESTRICTED"])

    def test_redact_masks_ids_and_usernames(self):
        fake_id = "005" + "Hs00000ABCDEFGH"   # built at runtime so the public-content scan stays clean
        out = sfkit.redact(f"user mftech.abc@example.com id {fake_id} ok MF-CASE-001")
        self.assertNotIn("example.com", out)
        self.assertNotIn(fake_id, out)
        self.assertIn("MF-CASE-001", out)

    def test_stage_files_declare_needs_and_explicit_orgs(self):
        for p in sorted((ROOT / "scripts" / "cloud" / "stages").glob("*-smf3-*.sh")):
            text = p.read_text(encoding="utf-8")
            self.assertRegex(text, r"(?m)^# needs:", p.name)
            for line in text.splitlines():
                if not line.lstrip().startswith("#") and re.search(r"\bsf (project|data|apex|org) ", line):
                    self.assertIn("--target-org", line, f"{p.name}: {line}")


if __name__ == "__main__":
    unittest.main()
