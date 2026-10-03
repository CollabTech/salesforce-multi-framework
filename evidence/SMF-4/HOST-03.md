# HOST-03 — ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID — repeat on desktop Chrome/Edge and physical Salesforce mobile iOS/Android

| Field | Value |
|---|---|
| Case ID | HOST-03 |
| Story | SMF-4 |
| Persona pair | MF-TECH, MF-SUPPORT, MF-RESTRICTED |
| Fixture IDs / hash / version | MF-CASE-001 |
| Build / commit | 7d6b5ea |
| Host / device / OS / app / browser | none; required: desktop Chrome, desktop Microsoft Edge, iPhone with Salesforce app (iOS 18+), Android 12+ phone with Salesforce app and WebView 90+ |
| Environment row | ENV-DESKTOP-CHROME, ENV-DESKTOP-EDGE, ENV-SFMOBILE-IOS, ENV-SFMOBILE-ANDROID |
| Timestamp | 2026-10-03T21:52Z |
| Preconditions | HOST-01/02 preconditions; physical devices |
| Steps | docs/test-scripts/SMF-4-HOST.md § HOST-03 |
| Expected result | Repeat on desktop Chrome/Edge and physical Salesforce mobile iOS/Android; capture host/version and failed launch behavior separately. |
| Actual result | Not executed in any row. No device or host access from this environment; no mobile result is implied by the localhost run. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-4-HOST.md |
| Tester | Not performed |
| Limitation / follow-up | Host limitation decision (SMF-4 handoff) cannot be made until device rows exist. Brandon/device tester: run the script on each of the four rows and record versions. |
