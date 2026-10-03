# HOST-02 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID — RESTRICTED without app permission cannot open the app; baseline restored

| Field | Value |
|---|---|
| Case ID | HOST-02 |
| Story | SMF-4 |
| Persona pair | MF-RESTRICTED (app permission temporarily removed); MF-ADMIN toggles |
| Fixture IDs / hash / version | verified app permission baseline (SMF-3/SMF-4, not established) |
| Build / commit | 7d6b5ea |
| Host / device / OS / app / browser | none |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID |
| Timestamp | 2026-10-03T21:52Z |
| Preconditions | HOST-01 preconditions; FieldSupport_Access removed from MF-RESTRICTED |
| Steps | docs/test-scripts/SMF-4-HOST.md § HOST-02 steps 1–3; toggle commands in docs/smf-4/deploy.md |
| Expected result | RESTRICTED without the app permission cannot open the app; restore baseline after the test. |
| Actual result | Not executed: no deployed app, no personas, no org access. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-4-HOST.md; docs/smf-4/deploy.md |
| Tester | Not performed |
| Limitation / follow-up | Same unblock chain as HOST-01. The denial path is specified, not optional. |
