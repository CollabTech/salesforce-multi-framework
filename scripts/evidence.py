#!/usr/bin/env python3
"""Render evidence records (evidence/TEMPLATE.md fields) from a JSON list.

Usage: python3 scripts/evidence.py <records.json>
Each item: {"file": "evidence/SMF-n/<CASE>[-<ROW>].md", "title": "...", and the template
fields as keys: case, story, personas, fixtures, build, host, env, timestamp, pre, steps,
expected, actual, outcome, link, tester, limitation}. Existing files are not overwritten
unless "replace": true (earlier runs stay as separate records).
"""
import json, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
FIELDS = [("Case ID", "case"), ("Story", "story"), ("Persona pair", "personas"),
          ("Fixture IDs / hash / version", "fixtures"), ("Build / commit", "build"),
          ("Host / device / OS / app / browser", "host"), ("Environment row", "env"),
          ("Timestamp", "timestamp"), ("Preconditions", "pre"), ("Steps", "steps"),
          ("Expected result", "expected"), ("Actual result", "actual"), ("Outcome", "outcome"),
          ("Evidence link", "link"), ("Tester", "tester"), ("Limitation / follow-up", "limitation")]
OUTCOMES = {"NOT TESTED", "PASS", "FAIL", "PARTIAL", "BLOCKED"}


def cell(v):
    if isinstance(v, list):
        v = " ".join(f"{i}. {s}" for i, s in enumerate(v, 1))
    return str(v).replace("|", "\\|").replace("\n", " ")


def main():
    recs = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    for r in recs:
        assert r["outcome"] in OUTCOMES, r["outcome"]
        out = ROOT / r["file"]
        if out.exists() and not r.get("replace"):
            print(f"skip (exists): {r['file']}")
            continue
        out.parent.mkdir(parents=True, exist_ok=True)
        lines = [f"# {r['case']} — {r.get('env', 'n/a')} — {r['title']}", "", "| Field | Value |", "|---|---|"]
        lines += [f"| {label} | {cell(r.get(key, ''))} |" for label, key in FIELDS]
        if r.get("notes"):
            lines += ["", r["notes"]]
        out.write_text("\n".join(lines) + "\n", encoding="utf-8", newline="\n")
        print(f"wrote {r['file']}")


if __name__ == "__main__":
    main()
