#!/usr/bin/env python3
"""Set an External Credential principal's authentication parameter through the Connect REST API.

Replaces the manual Setup steps O-SMF7-1 and SMF-12 S2. The value is never printed, logged or
passed on a command line. This script reads it from an environment variable or stdin and hands
it to `sf api request rest --body -` on stdin.

Connect REST "Named Credentials" resources (API v56.0+), version taken from sfdx-project.json:
  GET  /named-credentials/credential?externalCredential=X&principalName=P&principalType=NamedPrincipal
  POST /named-credentials/credential        create the principal's credential
  PUT  /named-credentials/credential        update it
  GET  /named-credentials/external-credentials/X   principals[].authenticationStatus
The request body follows the documented CredentialInput shape
(externalCredential, principalName, principalType, authenticationProtocol, credentials{name:{value,encrypted}}).
The shape has not yet been exercised against an org from this environment. The first real run
verifies it: any non-2xx response is reported as BLOCKED with the platform's errorCode only.

  sf_credential.py --target-org ORG --external-credential X --principal P \
                   --parameter NAME (--from-env VAR | --from-stdin)
Exit: 0 configured and verified, 2 BLOCKED, 1 usage error.
"""
import argparse, json, os, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def api_version():
    try:
        return json.loads((ROOT / "sfdx-project.json").read_text())["sourceApiVersion"]
    except Exception:
        return "67.0"


def request(org, method, path, body=None, runner=subprocess.run):
    """Returns (http_status, body). `sf api request rest --json` returns {statusCode, headers, body}
    for every response, 4xx included (@salesforce/plugin-api shared.js sendAndPrintRequest)."""
    args = ["sf", "api", "request", "rest", path, "--method", method, "--target-org", org, "--json"]
    if body is not None:
        args += ["--body", "-", "--header", "Content-Type:application/json"]
    r = runner(args, input=None if body is None else json.dumps(body), capture_output=True, text=True,
               env={**os.environ, "SF_DISABLE_TELEMETRY": "true"})
    try:
        res = json.loads(r.stdout or "{}").get("result") or {}
    except json.JSONDecodeError:
        res = {}
    return int(res.get("statusCode") or 0), res.get("body", {})


def error_code(data):
    if isinstance(data, list) and data:
        return data[0].get("errorCode", "unknown")
    if isinstance(data, dict):
        return data.get("errorCode") or data.get("message", "unknown")[:80]
    return "unknown"


def set_parameter(org, ext, principal, param, value, runner=subprocess.run):
    v = api_version()
    base = f"/services/data/v{v}/named-credentials"
    q = f"{base}/credential?externalCredential={ext}&principalName={principal}&principalType=NamedPrincipal"
    status, current = request(org, "GET", q, runner=runner)
    exists = status == 200 and isinstance(current, dict) and bool(current.get("credentials"))
    body = {"externalCredential": ext, "principalName": principal, "principalType": "NamedPrincipal",
            "authenticationProtocol": "Custom", "credentials": {param: {"value": value, "encrypted": True}}}
    status, data = request(org, "PUT" if exists else "POST", f"{base}/credential", body, runner=runner)
    if status not in (200, 201):
        return False, f"{'PUT' if exists else 'POST'} credential returned HTTP {status} ({error_code(data)})"
    status, info = request(org, "GET", f"{base}/external-credentials/{ext}", runner=runner)
    principals = info.get("principals", []) if isinstance(info, dict) else []
    st = next((p.get("authenticationStatus") for p in principals if p.get("principalName") == principal), None)
    if st != "Configured":
        return False, f"principal {principal} authenticationStatus={st!r} after write"
    return True, f"{ext}/{principal}.{param} configured (value not shown)"


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--target-org", required=True)
    ap.add_argument("--external-credential", required=True)
    ap.add_argument("--principal", required=True)
    ap.add_argument("--parameter", required=True)
    src = ap.add_mutually_exclusive_group(required=True)
    src.add_argument("--from-env")
    src.add_argument("--from-stdin", action="store_true")
    a = ap.parse_args(argv)
    value = sys.stdin.read().strip() if a.from_stdin else os.environ.get(a.from_env, "")
    if not value:
        print(f"BLOCKED: no value for {a.external_credential}/{a.principal}.{a.parameter} "
              f"({'stdin empty' if a.from_stdin else a.from_env + ' unset'})")
        return 2
    ok, msg = set_parameter(a.target_org, a.external_credential, a.principal, a.parameter, value)
    print(("OK  " if ok else "BLOCKED: ") + msg)
    return 0 if ok else 2


if __name__ == "__main__":
    sys.exit(main())
