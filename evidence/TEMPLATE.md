# <CASE-ID> — <environment row> — <short title>

<!-- Copy to evidence/SMF-<n>/<CASE-ID>.md (add -<ENV-ROW> when one case runs in several
environments). Fields are the SMF-3 evidence fields. Sanitize everything: no tokens,
real usernames, org/record/room IDs, faces, or customer data. -->

| Field | Value |
|---|---|
| Case ID | <CASE-ID> |
| Story | SMF-n |
| Persona pair | e.g. MF-TECH + MF-SUPPORT (logical IDs only) |
| Fixture IDs / hash / version | e.g. MF-CASE-001, MF-IMAGE-001 sha256:… , fixture v1 |
| Build / commit | git SHA, package version |
| Host / device / OS / app / browser | exact versions; runtime origin / hosting context |
| Environment row | e.g. ENV-SFMOBILE-IOS (see testing/contract.json) |
| Timestamp | ISO-8601 with timezone |
| Preconditions | |
| Steps | numbered |
| Expected result | quoted from the case specification |
| Actual result | what was observed, including measured values |
| Outcome | NOT TESTED |
| Evidence link | sanitized screenshot / log / recording path |
| Tester | who performed each step (agent, Brandon, designated tester) |
| Limitation / follow-up | |
