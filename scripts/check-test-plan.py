#!/usr/bin/env python3
"""GOV-03 test-plan integrity checks (no network, no org access).

- The committed index matches the dated Jira snapshot it was built from.
- Exactly 16 stories (SMF-1..SMF-16) and 54 case IDs.
- Every case ID resolves to exactly one owning story; none omitted or duplicated
  (cross-checked against a raw scan of every snapshot file).
- Every dependency names an indexed story.
- Every story carries its verbatim test users, test data and required-evidence text.
- Logical persona/fixture IDs referenced by stories and cases exist in testing/contract.json.
- Any evidence record under evidence/ names an indexed case ID and a valid outcome.
"""
import json, re, subprocess, sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXPECTED_STORIES = 16
EXPECTED_CASES = 54

errors = []
def check(cond, msg):
    if not cond:
        errors.append(msg)

r = subprocess.run([sys.executable, str(ROOT / "scripts/build-test-plan-index.py"), "--check"], capture_output=True, text=True)
check(r.returncode == 0, r.stdout.strip() or r.stderr.strip())

index = json.loads((ROOT / "testing/test-plan-index.json").read_text())
contract = json.loads((ROOT / "testing/contract.json").read_text())
stories = index["stories"]
keys = [s["key"] for s in stories]
check(keys == [f"SMF-{i}" for i in range(1, EXPECTED_STORIES + 1)], f"story keys not SMF-1..SMF-{EXPECTED_STORIES}: {keys}")

owners = {}
all_ids = []
for s in stories:
    check(len(s["cases"]) > 0, f"{s['key']} has no case IDs")
    for c in s["cases"]:
        all_ids.append(c["id"])
        owners.setdefault(c["id"], []).append(s["key"])
    for d in s["dependencies"]:
        check(d in keys, f"{s['key']} depends on unknown story {d}")
dups = {k: v for k, v in owners.items() if len(v) > 1}
check(not dups, f"case IDs owned by more than one story: {dups}")
check(len(all_ids) == EXPECTED_CASES, f"expected {EXPECTED_CASES} case IDs, found {len(all_ids)}")
check(index["case_count"] == len(all_ids), "case_count field disagrees with case list")

# Independent raw scan: every "* XXX-NN:" checklist bullet in the snapshot must be indexed.
snap = ROOT / index["snapshot_dir"]
raw = Counter()
for p in snap.glob("SMF-*.md"):
    for cid in re.findall(r"^\* ([A-Z0-9]+-\d{2}):", p.read_text(), re.M):
        raw[cid] += 1
        check(p.stem in owners.get(cid, []), f"{cid} appears in {p.name} but is not indexed under {p.stem}")
check(set(raw) == set(owners), f"raw scan/index mismatch: {sorted(set(raw) ^ set(owners))}")

# Logical IDs referenced in case specs must exist in the shared contract.
known = set()
for item in contract["personas"] + contract["fixtures"]:
    known.update(x.strip() for x in item["id"].split("/"))
short = {"TECH", "SUPPORT", "RESTRICTED", "ADMIN"}
for s in stories:
    for fld in ("test_users", "test_data"):
        check(s.get(fld), f"{s['key']} is missing {fld}")
        for ref in re.findall(r"\bMF-[A-Z]+(?:-[A-Z0-9]+)*\b", s.get(fld, "")):
            check(ref in known, f"{s['key']} {fld} references {ref}, which is not defined in testing/contract.json")
    ev = s.get("required_evidence", {})
    check(ev.get("completion") and ev.get("record"), f"{s['key']} is missing its required-evidence text")
    for ref in s.get("persona_refs", []) + s.get("fixture_refs", []):
        check(ref in known, f"{s['key']} lists {ref}, which is not defined in testing/contract.json")
    for c in s["cases"]:
        for ref in re.findall(r"\bMF-[A-Z]+(?:-[A-Z0-9]+)*\b", c["spec"]):
            check(ref in known, f"{c['id']} references {ref}, which is not defined in testing/contract.json")

# Evidence records, if any, must point at indexed cases and use defined outcomes.
outcomes = set(contract["outcomes"]["values"])
for ev in (ROOT / "evidence").rglob("*.md"):
    if ev.name in ("README.md", "TEMPLATE.md"):
        continue
    text = ev.read_text()
    m = re.search(r"^\| Case ID \| (\S+) \|", text, re.M)
    if not m:
        continue
    check(m.group(1) in owners, f"{ev.relative_to(ROOT)} names unknown case {m.group(1)}")
    check(ev.parent.name in owners.get(m.group(1), []), f"{ev.relative_to(ROOT)} is filed under the wrong story")
    o = re.search(r"^\| Outcome \| (.+?) \|", text, re.M)
    check(o and o.group(1).strip() in outcomes, f"{ev.relative_to(ROOT)} has missing/invalid outcome")

if errors:
    print("FAIL")
    for e in errors:
        print(" -", e)
    sys.exit(1)
print(f"OK: {len(stories)} stories, {len(all_ids)} case IDs, each owned by exactly one story; "
      f"raw snapshot scan agrees; persona/fixture references resolve.")
