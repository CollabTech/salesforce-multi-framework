#!/usr/bin/env python3
"""SMF-5 PKG-03: turn `sf package ... --json` output into a publishable report.

  sf package version create report -i "$REQ" --target-dev-hub smf-devhub --json \
    | tee private/smf5/v1-create-report.json | python3 scripts/smf5/sanitize_report.py

Keeps status, version numbers, flags, timings, coverage and error text; replaces
Salesforce IDs (package 0Ho/04t/05i, requests 08c/0Hf, users, orgs, records), usernames,
e-mail addresses, instance/login URLs and any token-like field with placeholders. The raw
JSON stays in private/ (git-ignored). Review the output by eye before committing it.
"""
import json, re, sys

SECRET_KEYS = re.compile(r"(?i)token|secret|password|auth|session|sfdxauthurl|refresh")
DROP_KEYS = re.compile(r"(?i)^(username|createdby|lastmodifiedby|orgid|organizationid|instanceurl|loginurl|"
                       r"createdbyid|lastmodifiedbyid|installationkey)$")
ID_RX = re.compile(r"\b(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{3}[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?\b")
EMAIL_RX = re.compile(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
URL_RX = re.compile(r"https://[A-Za-z0-9.-]+\.(?:salesforce|force|salesforce-setup|my\.salesforce)\.(?:com|app)[^\s\"']*")
VERSION_RX = re.compile(r"^\d+(?:\.\d+){1,3}$")


def scrub_text(s: str) -> str:
    s = URL_RX.sub("<salesforce-url>", s)
    s = EMAIL_RX.sub("<email>", s)
    return ID_RX.sub(lambda m: m.group(0) if VERSION_RX.match(m.group(0)) else f"<{m.group(0)[:3]}-id>", s)


def sanitize(obj, key: str = ""):
    if key and SECRET_KEYS.search(key):
        return "<redacted>"
    if key and DROP_KEYS.match(key):
        return "<redacted>"
    if isinstance(obj, dict):
        return {k: sanitize(v, k) for k, v in obj.items() if k != "warnings"}
    if isinstance(obj, list):
        return [sanitize(v) for v in obj]
    if isinstance(obj, str):
        return scrub_text(obj)
    return obj


def main() -> int:
    data = json.load(sys.stdin)
    json.dump(sanitize(data), sys.stdout, indent=2, sort_keys=True)
    sys.stdout.write("\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
