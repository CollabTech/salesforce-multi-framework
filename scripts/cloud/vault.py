#!/usr/bin/env python3
"""Org-auth vault for ephemeral cloud containers (ADR-0004). Never prints secrets.

The only human-provided secret is SF_AUTH_URL_DEVHUB. Auth URLs for the scratch orgs and
persona users the agent creates are kept in ONE encrypted file stored as a private
Salesforce File ("smf-cloud-vault") in the Dev Hub, encrypted with AES-256 (openssl,
PBKDF2) using a key derived from SF_AUTH_URL_DEVHUB. Anyone able to read it already holds
Dev Hub admin access. Delete the File (or rotate the Dev Hub auth) to revoke everything.

  vault.py save    collect sfdxAuthUrl for every local alias starting 'smf-' except
                   smf-devhub, encrypt, upload as a new version of the vault File
  vault.py restore download, decrypt, `sf org login sfdx-url` each entry with its alias
"""
import json, os, subprocess, sys, tempfile
from pathlib import Path

DEVHUB = "smf-devhub"
TITLE = "smf-cloud-vault"
ROOT = Path(__file__).resolve().parents[2]

if os.environ.get("SMF_VAULT_APPROVED") != "yes" or os.environ.get("SMF_VAULT_ENABLE") != "yes":
    sys.exit("vault.py is disabled (ADR-0004 rev 2): cross-session recovery uses JWT Dev Hub auth "
             "via scripts/cloud/orgs.py. Not used for the first run.")


def sf(*args, stdin=None):
    r = subprocess.run(["sf", *args, "--json"], input=stdin, capture_output=True, text=True,
                       env={**os.environ, "SF_DISABLE_TELEMETRY": "true"})
    try:
        return json.loads(r.stdout or "{}")
    except json.JSONDecodeError:
        return {"status": r.returncode}


def openssl(mode, data: bytes) -> bytes:
    args = ["openssl", "enc", "-aes-256-cbc", "-pbkdf2", "-iter", "200000", "-salt",
            "-pass", "env:SF_AUTH_URL_DEVHUB"] + (["-d"] if mode == "dec" else [])
    return subprocess.run(args, input=data, capture_output=True, check=True).stdout


def aliases():
    res = sf("alias", "list").get("result", [])
    return {r["alias"]: r["value"] for r in res if r["alias"].startswith("smf-") and r["alias"] != DEVHUB}


def save() -> int:
    entries = {}
    for alias in sorted(aliases()):
        url = sf("org", "display", "--verbose", "--target-org", alias).get("result", {}).get("sfdxAuthUrl")
        if url:
            entries[alias] = url
    blob = openssl("enc", json.dumps(entries).encode())
    old = vault_doc_ids()
    with tempfile.TemporaryDirectory() as d:
        p = Path(d) / f"{TITLE}.bin"
        p.write_bytes(blob)
        out = sf("data", "create", "file", "--file", str(p), "--title", TITLE, "--target-org", DEVHUB)
    ok = out.get("status") == 0
    if ok:  # keep exactly one vault File
        for doc in old:
            sf("data", "delete", "record", "--sobject", "ContentDocument", "--record-id", doc, "--target-org", DEVHUB)
    print(f"[smf-vault] {'saved' if ok else 'FAILED to save'} {len(entries)} alias(es): {', '.join(sorted(entries))}", file=sys.stderr)
    return 0 if ok else 1


def vault_doc_ids():
    r = sf("data", "query", "--query", f"SELECT ContentDocumentId FROM ContentVersion WHERE Title = '{TITLE}' "
                                        "AND IsLatest = true", "--target-org", DEVHUB)
    return [x["ContentDocumentId"] for x in r.get("result", {}).get("records", [])]


def restore() -> int:
    r = sf("data", "query", "--query", f"SELECT Id FROM ContentVersion WHERE Title = '{TITLE}' AND IsLatest = true "
                                        "ORDER BY CreatedDate DESC LIMIT 1", "--target-org", DEVHUB)
    recs = r.get("result", {}).get("records", [])
    if not recs:
        print("[smf-vault] no vault yet (first run): create orgs, then `vault.py save`", file=sys.stderr)
        return 0
    api = sf("org", "display", "--target-org", DEVHUB).get("result", {})
    url = f"{api['instanceUrl']}/services/data/v{api['apiVersion']}/sobjects/ContentVersion/{recs[0]['Id']}/VersionData"
    raw = subprocess.run(["curl", "-fsS", "-H", f"Authorization: Bearer {api['accessToken']}", url],
                         capture_output=True, check=True).stdout
    entries = json.loads(openssl("dec", raw))
    for alias, auth in entries.items():
        out = sf("org", "login", "sfdx-url", "--sfdx-url-stdin", "-", "--alias", alias, stdin=auth)
        print(f"[smf-vault] {'OK ' if out.get('status') == 0 else 'BLOCKED'} {alias}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    if not os.environ.get("SF_AUTH_URL_DEVHUB"):
        sys.exit("[smf-vault] SF_AUTH_URL_DEVHUB not set")
    sys.exit({"save": save, "restore": restore}[sys.argv[1]]())
