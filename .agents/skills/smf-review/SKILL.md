---
name: smf-review
description: "Use when reviewing an SMF pull request, evidence record, or story handoff before moving a Jira story to Done."
metadata:
  project: salesforce-multi-framework
  owner: SMF-1
---

# Review checklist

- [ ] Every case ID of the story (per `testing/test-plan-index.json`) has a record; none
      silently dropped, merged, or added.
- [ ] Outcomes follow `smf-evidence` definitions; no PASS without an executed, evidenced run.
- [ ] Mobile claims rest on physical Salesforce mobile runs (`smf-physical-mobile-testing`).
- [ ] Denial cases (MF-RESTRICTED, MF-CASE-002, MF-FILE-DENIED, MF-ROOM-002) were run, not
      skipped.
- [ ] Targets unchanged, or changed by a decision recorded *before* the run.
- [ ] Org-touching commands targeted an explicit org; Dev Hub not used as the test org.
- [ ] Probe stays within the story's scope; no later-story work.
- [ ] Official skills used for platform mechanics; selected skills listed in the PR.
- [ ] `python3 scripts/scan-public-content.py` clean; diff manually reviewed for
      credentials, real usernames, org/record/room IDs, private conversations.
- [ ] Limitations and outstanding work are stated; contradictions logged in
      `docs/contradictions.md`.
- [ ] `python3 scripts/verify-skills.py` and `python3 scripts/check-test-plan.py` pass.
