# 3D-02 — ENV-DESKTOP-EDGE — 60 s interaction: load time and frame rate

| Field | Value |
|---|---|
| Case ID | 3D-02 |
| Story | SMF-13 |
| Persona pair | MF-TECH |
| Fixture IDs / hash / version | MF-MODEL-SMALL sha256:b57acb02d969499687f238a866af84b16753fec7a4651854504670b6b1d84d85 (317,796 B, 8,676 tris, 0 textures); MF-MODEL-MISSING (absent by design); MF-MODEL-FALLBACK.png sha256 per testing/fixtures/models/manifest.json; fixture manifest v1.0.0 |
| Build / commit | branch claude/smf-13-3d (probe commit; see PR head) — not deployed |
| Host / device / OS / app / browser | Microsoft Edge (Linux, cloud) via scripts/cloud/stages/56-smf13-3d.sh — not run |
| Environment row | ENV-DESKTOP-EDGE |
| Timestamp | 2026-10-03T22:20:00Z |
| Preconditions | SMF-2 ENV-01..03 BLOCKED: no org credential; environment egress to Salesforce denied. Therefore the SMF-4 app is not deployed and SMF-3 personas (MF-TECH, MF-SUPPORT) do not exist. |
| Steps | docs/test-scripts/SMF-13-3D.md 3D-02 steps 1-4 |
| Expected result | Measure 60 seconds of repeatable interaction; initial target is usable within 10 seconds and median >=30 fps on the recorded device/network. Report measured values even when below target. |
| Actual result | Not executed: prerequisite missing (see Preconditions). No host, persona, or device result exists for this row; localhost results are recorded separately and are not evidence for this row. |
| Outcome | BLOCKED |
| Evidence link | docs/test-scripts/SMF-13-3D.md |
| Tester | Implementing agent (Claude Code cloud session) — recorded the block only |
| Limitation / follow-up | Smallest unblocking action: Owner setup H1 (allow Salesforce hosts) + H2 (Dev Hub auth URL); then pipeline stages 20, 30, 40, 56 run the functional parts of this row automatically. Device-performance judgement (3D-02) needs a human on real desktop hardware (HUMAN-ACTIONS G3). |
