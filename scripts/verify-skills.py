#!/usr/bin/env python3
"""GOV-01 skill discovery and integrity check (offline; reads only this repository).

- Every official skill in docs/provenance/official-skills.json is installed in
  .agents/skills/<name> and matches the pinned upstream revision file-by-file (Git blob IDs,
  CRLF/LF tolerant, any other byte change, extra file or missing file fails).
- skills-lock.json pins the same skills, source and revision.
- Every skill folder in .agents/skills has SKILL.md front matter whose `name` equals the
  folder and a `description`; non-official skills must be project skills (smf-*).
- Every skill has a .claude/skills/<name> entry that exposes the canonical, readable
  SKILL.md: a symlink/junction resolving to .agents/skills/<name>, or an identical copy.
  Text-file symlink placeholders, wrong targets and stray entries fail.

Install/repair with: python3 scripts/bootstrap-skills.py
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import smfskills as S  # noqa: E402


def main() -> int:
    errors = []
    m = S.load_manifest()
    official = m["skills"]
    lock = json.loads(S.LOCK.read_text(encoding="utf-8"))["skills"]
    if sorted(lock) != sorted(official):
        errors.append(f"skills-lock.json and official-skills.json list different skills: "
                      f"{sorted(set(lock) ^ set(official))}")
    for n, entry in lock.items():
        if entry.get("source") != m["upstream_repo_slug"] or entry.get("ref") != m["revision"]:
            errors.append(f"{n}: skills-lock.json source/ref is not the pinned upstream revision")

    for n, entry in official.items():
        errors += S.verify_official(n, entry["files"])

    names = sorted(p.name for p in S.AGENTS_DIR.iterdir() if p.is_dir()) if S.AGENTS_DIR.is_dir() else []
    project = [n for n in names if n not in official]
    for n in names:
        skill = S.AGENTS_DIR / n / "SKILL.md"
        fm = S.front_matter(skill) if skill.is_file() else {}
        if not fm:
            errors.append(f"{n}: missing SKILL.md or front matter")
            continue
        if fm.get("name") != n:
            errors.append(f"{n}: front-matter name is {fm.get('name')!r}")
        if not fm.get("description"):
            errors.append(f"{n}: no description")
        if n not in official and not n.startswith("smf-"):
            errors.append(f"{n}: not a pinned official skill and not a project (smf-*) skill")
        errors += S.verify_claude_entry(n)
    if not project:
        errors.append("no project (smf-*) skills found in .agents/skills")
    if S.CLAUDE_DIR.is_dir():
        for p in S.CLAUDE_DIR.iterdir():
            if p.name not in names:
                errors.append(f".claude/skills/{p.name} has no canonical copy in .agents/skills")

    if errors:
        print("FAIL")
        for e in errors:
            print(" -", e)
        return 1
    print(f"OK: {len(official)} official skills (pinned {m['revision'][:12]}, every file matches upstream) "
          f"+ {len(project)} project skills; all {len(names)} exposed via .claude/skills")
    return 0


if __name__ == "__main__":
    sys.exit(main())
