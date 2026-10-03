# ADR-0005: Package composition: the app shell is packaged; probe back-ends are not

- **Status:** Accepted for the PoC (implementing agent). SMF-16 revisits it for the composed app.
- **Date:** 2026-10-03
- **Story / case IDs:** SMF-5 (PKG-01..03), SMF-7 (CALL-*), SMF-10..12 (FILE-*, MARK-*, SYNC-*), SMF-14 (BUDGET-03)
- **Deciders:** implementing agent (integration); project owner reviews at SMF-15 GATE-03

## Context
SMF-5 packages `force-app` as the unlocked package `FieldSupportPoC`.
`scripts/smf5/check_package.py` asserts that the package holds exactly these members:
- UIBundle `FieldSupport`
- CustomApplication `FieldSupport`
- PermissionSet `FieldSupport_Access`

PKG-01..03 test installing and upgrading that app shell.

Later probes add server-side metadata: SMF-7 Apex, objects, CMDT, Named/External Credentials,
CSP Trusted Sites, a custom permission and `SMF7_Access`. SMF-10..12 add similar metadata. While
these probe stories developed on their own branches, that metadata sat in `force-app`. Once the
branches were integrated, the SMF-5 member check failed: the package would carry probe back-ends
that PKG-01..03 never designed or tested.

## Options considered
1. **Widen the package to every probe back-end.**
   - This changes SMF-5's tested scope after the fact.
   - Every subscriber install would need Cloudflare credentials, CMDT and tldraw configuration.
   - The PKG evidence would no longer describe what is actually packaged.
2. **Keep probe back-ends in a non-packaged `probes/` package directory (chosen).**
   - The package stays the app shell that PKG-01..03 test.
   - Each probe story's own stage deploys its back-end to `smf-dev` with an explicit `--target-org`.
3. **One package per probe.**
   - This is premature. It is a decision for SMF-16 composition, not for capability probes.

## Decision
`sfdx-project.json` gains the entry `{"path": "probes", "default": false}`, with no `package` key.

- **What goes in `probes/main/default/`:** every probe's server-side metadata — Apex, custom
  objects and CMDT, credentials, CSP Trusted Sites, custom permissions and story permission
  sets.
- **What stays in `force-app/`:**
  - the UI bundle;
  - the CustomApplication;
  - `FieldSupport_Access`.
- **Deployment:**
  - Stage 40 deploys `force-app` only.
  - Each story stage (45, 46, …) deploys its own `probes/…` components.
- **Probe pages without their back-end** must say "not configured" and must not crash. This
  applies, for example, in the SMF-5 subscriber org.

## Consequences
- PKG-01..03 evidence stays valid for what is packaged.
- The `smf-install-test` subscriber org does not run calls, Files or markup. Those cases are
  tested in `smf-dev` only.
- SMF-15 GATE-03 lists this boundary.
- SMF-16 decides the production package composition, which may be a base package plus
  dependent packages. That needs a recorded owner decision before execution.
