#!/usr/bin/env python3
"""GOV-03 public-content scan: flags likely credentials and private Salesforce identifiers
in files that would be published (tracked + untracked, honouring .gitignore).

Heuristic, not a guarantee: a clean scan does not replace reviewing the diff by eye.
Allowed exceptions live in scripts/scan-allowlist.txt as `path:regex` lines, each with a reason.
Official skills listed in skills-lock.json are skipped: they are upstream public content whose
bytes scripts/verify-skills.py checks against the pinned revision (their examples use
placeholder org IDs and emails).
"""
import json, re, subprocess, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

PATTERNS = {
    "sfdx auth URL": r"force://[^\s@'\"]+@[^\s'\"]+",
    "Salesforce session/access token": r"\b00D[A-Za-z0-9]{12,15}![A-Za-z0-9._-]{20,}",
    "Salesforce org ID": r"\b00D[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?\b",
    "Salesforce user/record ID": r"\b(?:005|500|02i|001|069|068|0PS)[A-Za-z0-9]{12}(?:[A-Za-z0-9]{3})?\b",
    "private key": r"-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----",
    "JWT": r"\beyJ[A-Za-z0-9_-]{10,}\.eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
    "AWS access key": r"\bAKIA[0-9A-Z]{16}\b",
    "GitHub token": r"\bgh[pousr]_[A-Za-z0-9]{36,}\b",
    "Cloudflare/API token assignment": r"(?i)\b(?:api[_-]?key|api[_-]?token|secret|client[_-]?secret|password|passwd)\b\s*[:=]\s*['\"][^'\"\s]{12,}['\"]",
    "Bearer token": r"(?i)\bauthorization:\s*bearer\s+[A-Za-z0-9._-]{20,}",
    "email address": r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
}
EMAIL_OK = re.compile(r"@(?:example\.(?:com|org|net)|anthropic\.com|users\.noreply\.github\.com)$|^noreply@", re.I)


def files():
    official = tuple(f".agents/skills/{n}/" for n in json.loads((ROOT / "skills-lock.json").read_text())["skills"])
    out = subprocess.run(["git", "ls-files", "-co", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True, check=True)
    for rel in out.stdout.splitlines():
        p = ROOT / rel
        if rel.startswith(official):
            continue
        if p.is_file() and not p.is_symlink():
            yield rel, p


def allowlist():
    f = ROOT / "scripts" / "scan-allowlist.txt"
    rules = []
    if f.exists():
        for line in f.read_text().splitlines():
            line = line.split("  #", 1)[0].strip()
            if line and not line.startswith("#"):
                path, rx = line.split(":", 1)
                rules.append((path, re.compile(rx)))
    return rules


def main() -> int:
    rules = allowlist()
    hits = []
    for rel, p in files():
        try:
            text = p.read_text(encoding="utf-8")
        except (UnicodeDecodeError, OSError):
            continue
        for label, rx in PATTERNS.items():
            for m in re.finditer(rx, text):
                s = m.group(0)
                if label == "email address" and EMAIL_OK.search(s):
                    continue
                if any(rel.startswith(path) and r.search(s) for path, r in rules):
                    continue
                line = text.count("\n", 0, m.start()) + 1
                hits.append(f"{rel}:{line}: {label}: {s[:60]}")
    if hits:
        print("FAIL: review each hit; remove it or allowlist it with a reason")
        print("\n".join(hits))
        return 1
    print("OK: no credential or private-identifier patterns found")
    return 0


if __name__ == "__main__":
    sys.exit(main())
