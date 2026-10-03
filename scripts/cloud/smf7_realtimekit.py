#!/usr/bin/env python3
"""SMF-7 deploy helper: find or create the RealtimeKit app, check the preset, and write the
SMF7_RealtimeKit_Config__mdt 'Default' record into a git-ignored deploy project.

Reads CF_ACCOUNT_ID and CF_API_TOKEN from the environment only for these Cloudflare API calls.
The API token is never printed, written to disk, or passed on a command line. Provider ids
(app id) are written only under private/ (git-ignored). Exit 0 ok, 2 BLOCKED (reason printed).

  python3 scripts/cloud/smf7_realtimekit.py prepare   # → private/smf7-deploy/ (sfdx project with the CMDT record)
  python3 scripts/cloud/smf7_realtimekit.py revoke <meetingId> <participantId>   # CALL-03 revoked-token control
"""
import json
import os
import ssl
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
PRIVATE = ROOT / "private"
API = "https://api.cloudflare.com/client/v4"
APP_NAME = os.environ.get("SMF7_RTK_APP_NAME", "smf-field-support-poc")
PRESET = os.environ.get("SMF7_RTK_PRESET", "group_call_host")


def blocked(msg):
    print(f"BLOCKED: {msg}")
    sys.exit(2)


def call(method, path, body=None):
    token = os.environ.get("CF_API_TOKEN")
    req = urllib.request.Request(API + path, method=method, data=None if body is None else json.dumps(body).encode())
    req.add_header("Authorization", "Bearer " + token)
    req.add_header("Content-Type", "application/json")
    cafile = os.environ.get("SSL_CERT_FILE") or os.environ.get("REQUESTS_CA_BUNDLE")
    ctx = ssl.create_default_context(cafile=cafile) if cafile else ssl.create_default_context()
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, {}  # body deliberately ignored (may echo request details)
    except urllib.error.URLError as e:
        blocked(f"cannot reach api.cloudflare.com ({e.reason}); allow it in the environment network settings (HUMAN-SETUP H1)")


def prepare():
    acct = os.environ.get("CF_ACCOUNT_ID")
    if not acct or not os.environ.get("CF_API_TOKEN"):
        blocked("CF_ACCOUNT_ID / CF_API_TOKEN not set (HUMAN-SETUP H4)")
    app_id = os.environ.get("SMF7_RTK_APP_ID")
    if not app_id:
        status, body = call("GET", f"/accounts/{acct}/realtime/kit/apps?per_page=100")
        if status in (401, 403):
            blocked(f"Cloudflare API token rejected for RealtimeKit apps (HTTP {status}); token needs Realtime: Edit (HUMAN-SETUP H4)")
        if status != 200:
            blocked(f"listing RealtimeKit apps failed (HTTP {status})")
        app_id = next((a.get("id") for a in body.get("data") or [] if a.get("name") == APP_NAME), None)
        if not app_id:
            status, body = call("POST", f"/accounts/{acct}/realtime/kit/apps", {"name": APP_NAME})
            if status not in (200, 201):
                blocked(f"creating RealtimeKit app '{APP_NAME}' failed (HTTP {status})")
            app_id = ((body.get("data") or {}).get("app") or {}).get("id")
            print(f"created RealtimeKit app '{APP_NAME}'")
    status, body = call("GET", f"/accounts/{acct}/realtime/kit/{app_id}/presets?per_page=100")
    if status != 200:
        blocked(f"listing presets failed (HTTP {status})")
    names = sorted(p.get("name") for p in body.get("data") or [])
    if PRESET not in names:
        blocked(f"preset '{PRESET}' not found in app '{APP_NAME}' (found {len(names)} presets). Owner: create the app in the "
                "Cloudflare dashboard (it ships default presets) and set SMF7_RTK_APP_ID, or create a GROUP_CALL preset "
                f"named '{PRESET}' allowing audio, video and screen share; or set SMF7_RTK_PRESET to an existing name")
    out = PRIVATE / "smf7-deploy"
    md = out / "force-app/main/default/customMetadata"
    md.mkdir(parents=True, exist_ok=True)
    (out / "sfdx-project.json").write_text(json.dumps({"packageDirectories": [{"path": "force-app", "default": True}],
                                                       "sourceApiVersion": "67.0"}, indent=2))
    values = {"AccountId__c": acct, "AppId__c": app_id, "PresetName__c": PRESET}
    fields = "\n".join(
        f"    <values>\n        <field>{k}</field>\n        <value xsi:type=\"xsd:string\">{v}</value>\n    </values>" for k, v in values.items())
    (md / "SMF7_RealtimeKit_Config.Default.md-meta.xml").write_text(
        '<?xml version="1.0" encoding="UTF-8"?>\n<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata" '
        'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n'
        f"    <label>Default</label>\n    <protected>true</protected>\n{fields}\n</CustomMetadata>\n")
    (PRIVATE / "smf7").mkdir(parents=True, exist_ok=True)
    (PRIVATE / "smf7" / "realtimekit.json").write_text(json.dumps({"app_name": APP_NAME, "app_id": app_id, "preset": PRESET}, indent=2))
    print(f"OK  RealtimeKit app '{APP_NAME}' and preset '{PRESET}' ready; config record written under private/")


def revoke(meeting_id, participant_id):
    acct = os.environ.get("CF_ACCOUNT_ID")
    cfg = json.loads((PRIVATE / "smf7" / "realtimekit.json").read_text())
    status, _ = call("DELETE", f"/accounts/{acct}/realtime/kit/{cfg['app_id']}/meetings/{meeting_id}/participants/{participant_id}")
    print(f"revoke participant: HTTP {status}")
    sys.exit(0 if status in (200, 204) else 1)


if __name__ == "__main__":
    if len(sys.argv) >= 2 and sys.argv[1] == "prepare":
        prepare()
    elif len(sys.argv) == 4 and sys.argv[1] == "revoke":
        revoke(sys.argv[2], sys.argv[3])
    else:
        print(__doc__)
        sys.exit(64)
