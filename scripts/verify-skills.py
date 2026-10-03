#!/usr/bin/env python3
"""GOV-01 skill discovery check (offline; reads only this repository).

Verifies that every skill an agent needs is discoverable at project scope:
- .agents/skills/<name>/SKILL.md exists with YAML front matter whose `name` equals the
  folder and which has a `description` (Agent Skills spec; Codex & other tools read here).
- .claude/skills/<name> exists for each, resolving inside the repo (Claude Code reads here).
- Official skills match skills-lock.json, are pinned to the single upstream revision in
  docs/provenance/official-skills.json, and are byte-identical to the recorded content hash.
- Project skills (smf-*) are not in the lock file (they are owned here, not upstream).

--write-hashes  refresh the recorded content hashes after a deliberate reinstall.
"""
import hashlib, json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
AGENTS_DIR = ROOT / ".agents" / "skills"
CLAUDE_DIR = ROOT / ".claude" / "skills"
LOCK = ROOT / "skills-lock.json"
PROV = ROOT / "docs" / "provenance" / "official-skills.json"


def front_matter(p: Path) -> dict:
    text = p.read_text(encoding="utf-8")
    if not text.startswith("---\n"):
        return {}
    block = text[4:text.index("\n---", 4)]
    out = {}
    for line in block.splitlines():
        if line and not line.startswith((" ", "\t", "-")) and ":" in line:
            k, v = line.split(":", 1)
            out[k.strip()] = v.strip().strip('"')
    return out


def tree_hash(d: Path) -> str:
    h = hashlib.sha256()
    for f in sorted(p for p in d.rglob("*") if p.is_file()):
        h.update(str(f.relative_to(d)).encode() + b"\0" + f.read_bytes() + b"\0")
    return h.hexdigest()


def main() -> int:
    errors = []
    lock = json.loads(LOCK.read_text())["skills"]
    prov = json.loads(PROV.read_text()) if PROV.exists() else {"skills": {}}
    if "--write-hashes" in sys.argv:
        prov["skills"] = {n: tree_hash(AGENTS_DIR / n) for n in sorted(lock)}
        PROV.write_text(json.dumps(prov, indent=2) + "\n")
        print(f"recorded hashes for {len(lock)} official skills")
        return 0

    names = sorted(p.name for p in AGENTS_DIR.iterdir() if p.is_dir())
    for n in names:
        skill = AGENTS_DIR / n / "SKILL.md"
        fm = front_matter(skill) if skill.exists() else {}
        if not fm:
            errors.append(f"{n}: missing SKILL.md or front matter")
            continue
        if fm.get("name") != n:
            errors.append(f"{n}: front-matter name is {fm.get('name')!r}")
        if not fm.get("description"):
            errors.append(f"{n}: no description")
        link = CLAUDE_DIR / n
        if not link.exists():
            errors.append(f"{n}: not visible to Claude Code (.claude/skills/{n} missing)")
        elif ROOT not in link.resolve().parents:
            errors.append(f"{n}: .claude/skills/{n} resolves outside the repository")

    for p in CLAUDE_DIR.iterdir():
        if p.name not in names:
            errors.append(f".claude/skills/{p.name} has no canonical copy in .agents/skills")

    official = sorted(lock)
    project = [n for n in names if n not in lock]
    for n in project:
        if not n.startswith("smf-"):
            errors.append(f"{n}: not in skills-lock.json and not a project (smf-*) skill")
    for n, entry in lock.items():
        if n not in names:
            errors.append(f"{n}: in skills-lock.json but not installed")
            continue
        if entry.get("source") != prov.get("upstream_repo_slug"):
            errors.append(f"{n}: source {entry.get('source')!r} is not the recorded upstream")
        if entry.get("ref") != prov.get("revision"):
            errors.append(f"{n}: ref {entry.get('ref')!r} is not the pinned revision")
        want = prov["skills"].get(n)
        if want != tree_hash(AGENTS_DIR / n):
            errors.append(f"{n}: content differs from the recorded upstream hash (modified or reinstalled?)")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(f"OK: {len(official)} official skills (pinned {prov['revision'][:12]}, content verified) "
          f"+ {len(project)} project skills discoverable in .agents/skills and .claude/skills")
    return 0


if __name__ == "__main__":
    sys.exit(main())
