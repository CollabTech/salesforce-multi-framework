# 3D-01 — ENV-SFMOBILE-IOS — load, orbit, zoom, select, reset, rotate, touch/resize

| Field | Value |
|---|---|
| Case ID | 3D-01 |
| Story | SMF-13 |
| Persona pair | MF-TECH (+ MF-SUPPORT reviews selected-part behaviour) |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-MISSING (absent by design); MF-MODEL-FALLBACK.png sha256 per testing/fixtures/models/manifest.json; fixture manifest v1.0.0 |
| Build / commit | branch claude/smf-13-3d (probe commit; see PR head) — not deployed |
| Host / device / OS / app / browser | physical iPhone in the Salesforce mobile app — no device available |
| Environment row | ENV-SFMOBILE-IOS |
| Timestamp | 2026-10-03T22:20:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. Therefore the SMF-4 app is not deployed and SMF-3 personas (MF-TECH, MF-SUPPORT) do not exist. |
| Steps | docs/test-scripts/SMF-13-3D.md 3D-01 steps 1-9 (desktop functional parts: testing/cloud-e2e/tests/smf-13-3d.spec.ts) |
| Expected result | Load the small model, orbit/zoom/select/reset, rotate the device, and verify touch/resize behavior in each required host. |
| Actual result | Not executed: prerequisite missing (see Preconditions). No host, persona, or device result exists for this row; localhost results are recorded separately and are not evidence for this row. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-13-3D.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the block only |
| Limitation / follow-up | Smallest unblocking action: After H1/H2 + stages 20/30/40: device tester runs docs/test-scripts/SMF-13-3D.md (HUMAN-ACTIONS G1, G2, G4) on a physical iPhone in the Salesforce app as MF-TECH (MF-SUPPORT for 3D-01 step 9). |
