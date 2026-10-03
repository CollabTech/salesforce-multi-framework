#!/usr/bin/env bash
# SMF-14 fixture provisioning (SMF-3 assigns 3D fixtures to SMF-13/14): uploads MF-MODEL-SMALL
# and MF-MODEL-REP as Salesforce Files linked to MF-CASE-001, and denied-control copies
# (MF-MODEL-SMALL-DENIED, MF-MODEL-REP-DENIED) linked only to MF-CASE-002. Runs as MF-ADMIN on
# smf-dev (setup only). Idempotent: a File whose Title and MD5 checksum already match is reused.
# Links mirror SMF-3 baseline Files (ShareType V, Visibility AllUsers); no public links.
# Record Ids go to private/smf14-model-files.json (git-ignored), never to stdout.
# needs: 30 40
set -uo pipefail
ROOT="${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel)}"; cd "$ROOT"
sf org display --target-org smf-dev --json >/dev/null 2>&1 || { echo "BLOCKED: smf-dev not authenticated (stage 20 / owner setup H1-H2)"; exit 2; }
mkdir -p private
python3 - <<'EOF'
import hashlib, json, subprocess, sys
from pathlib import Path

ORG = "smf-dev"
MODELS = Path("testing/fixtures/models")
CASES = {"MF-CASE-001": "Pump overheating — remote diagnosis",
         "MF-CASE-002": "MF-CASE-002 restricted negative control (synthetic)"}
PLAN = [("MF-MODEL-SMALL", "MF-MODEL-SMALL.glb", "MF-CASE-001"), ("MF-MODEL-REP", "MF-MODEL-REP.glb", "MF-CASE-001"),
        ("MF-MODEL-SMALL-DENIED", "MF-MODEL-SMALL.glb", "MF-CASE-002"), ("MF-MODEL-REP-DENIED", "MF-MODEL-REP.glb", "MF-CASE-002")]

def sf(*args):
    out = subprocess.run(["sf", *args, "--target-org", ORG, "--json"], capture_output=True, text=True)
    data = json.loads(out.stdout or "{}")
    if data.get("status", 1) != 0:
        raise SystemExit(f"sf {args[0]} {args[1]} failed: {data.get('name')} {str(data.get('message'))[:200]}")
    return data["result"]

def query(soql):
    return sf("data", "query", "--query", soql)["records"]

def esc(s):
    return s.replace("\\", "\\\\").replace("'", "\\'")

manifest = json.loads((MODELS / "manifest.json").read_text())
sha = {m["path"].split("/")[-1]: m["sha256"] for m in manifest["models"]}
case_ids = {}
for key, subject in CASES.items():
    rows = query(f"SELECT Id FROM Case WHERE Subject = '{esc(subject)}' ORDER BY CreatedDate LIMIT 2")
    if len(rows) != 1:
        print(f"BLOCKED: {key} not found exactly once (SMF-3 stage 32 seed)"); sys.exit(2)
    case_ids[key] = rows[0]["Id"]

private = {"MF-CASE-001": case_ids["MF-CASE-001"], "MF-CASE-002": case_ids["MF-CASE-002"], "files": {}}
for title, file, case in PLAN:
    path = MODELS / file
    data = path.read_bytes()
    if hashlib.sha256(data).hexdigest() != sha[file]:
        raise SystemExit(f"{file} does not match manifest sha256; run testing/fixtures/models npm run verify")
    md5 = hashlib.md5(data).hexdigest()
    rows = query(f"SELECT Id, ContentDocumentId, Checksum FROM ContentVersion WHERE Title = '{title}' AND IsLatest = true")
    match = [r for r in rows if (r.get("Checksum") or "").lower() == md5]
    if match:
        ver, doc = match[0]["Id"], match[0]["ContentDocumentId"]
        status = "reused"
    else:
        doc = sf("data", "create", "file", "--file", str(path), "--title", title)["Id"]
        ver = query(f"SELECT Id FROM ContentVersion WHERE ContentDocumentId = '{doc}' AND IsLatest = true")[0]["Id"]
        status = "uploaded"
    links = query(f"SELECT Id, LinkedEntityId FROM ContentDocumentLink WHERE ContentDocumentId = '{doc}'")
    linked = {l["LinkedEntityId"] for l in links}
    if case_ids[case] not in linked:
        sf("data", "create", "record", "--sobject", "ContentDocumentLink", "--values",
           f"ContentDocumentId={doc} LinkedEntityId={case_ids[case]} ShareType=V Visibility=AllUsers")
    wrong = [c for k, c in case_ids.items() if k != case and c in linked]
    if wrong:
        raise SystemExit(f"{title} is linked to the other case; fix by hand (never relink automatically)")
    dist = query(f"SELECT Id FROM ContentDistribution WHERE ContentDocumentId = '{doc}'")
    if dist:
        raise SystemExit(f"{title} has a public link (ContentDistribution); remove it before testing")
    private["files"][title] = {"contentDocumentId": doc, "contentVersionId": ver, "case": case}
    print(f"{title}: {status}, {len(data)} B, linked to {case} only, no public link")
Path("private/smf14-model-files.json").write_text(json.dumps(private, indent=2))
print("ids written to private/smf14-model-files.json")
EOF
