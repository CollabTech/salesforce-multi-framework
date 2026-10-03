# SMF-4 — build, deploy and access setup (runbook)

Skills: `experience-ui-bundle-deploy`, `platform-metadata-deploy`,
`dx-org-permission-set-assign`, `smf-salesforce-boundaries`. Every org command names its
target. Target: `smf-dev` (never the Dev Hub). Preconditions: SMF-2 ENV-01..03 observed,
SMF-3 personas and fixtures provisioned (DATA-01..03).

```sh
B=force-app/main/default/uiBundles/FieldSupport
# 1. Build and static checks (recorded as AC1 evidence)
(cd $B && npm ci && npm run lint && npx vitest run && VITE_BUILD_COMMIT=$(git rev-parse --short HEAD) npm run build)
# 2. Deploy the bundle, CustomApplication and FieldSupport_Access permission set
sf project deploy start --source-dir force-app --target-org smf-dev --wait 30
# 3. App access: personas only (scripts/org-setup.config.json assigns nothing by default)
python3 testing/provisioning/create_personas.py --target-org smf-dev   # SMF-3; assigns FieldSupport_Access to TECH, SUPPORT, RESTRICTED once deployed
# 4. Confirm the app is listed for the personas (sanitized output: logical IDs only)
python3 testing/provisioning/check_baseline.py --target-org smf-dev
```

The scaffold's one-command `npm run setup` (`scripts/org-setup.mjs`) is **not** used: it can
log in interactively, assign permission sets to the current (admin) user and seed data,
which would blur the persona baseline. Each step above is the explicit equivalent.

## HOST-02 denial toggle (and restore)

```sh
sf org assign permset --name FieldSupport_Access --on-behalf-of <MF-RESTRICTED username from private/personas.json> --target-org smf-dev   # baseline (already true)
# remove for the test (Setup > Users > MF-RESTRICTED > Permission Set Assignments > Edit, or):
sf data delete record --sobject PermissionSetAssignment --where "AssigneeId='<id>' AND PermissionSet.Name='FieldSupport_Access'" --target-org smf-dev
# ... run HOST-02 ... then restore with the assign command above and re-run check_baseline.py
```

(`sf data delete record --where` accepts simple field filters only; if the relationship
filter is rejected, query the assignment Id first with `sf data query` and delete by Id.)
