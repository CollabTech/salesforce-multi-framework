# Curated provenance

This public repository keeps a curated record of how work was done — enough for a reviewer
to trace every change to its instruction and verification, without raw transcripts or
private data (see the `smf-public-provenance` skill).

| What | Where |
|---|---|
| Task instructions (story text, dated) | `docs/jira-snapshot/<date>/` — Jira stays authoritative |
| Third-party skills: source, revision, licence, hashes | `official-skills.md`, `official-skills.json`, `../../skills-lock.json` |
| Decisions | `docs/adr/` |
| Changes | Git history and PRs (one draft PR per story) |
| Verification results | `evidence/SMF-<n>/` |
| Agent session summaries | `sessions/<date>-<story>.md` — what was asked, done, checked, and left open |
| Contradictions / open questions | `docs/contradictions.md` |
