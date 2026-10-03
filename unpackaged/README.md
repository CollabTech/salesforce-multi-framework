# unpackaged/ — deployable but never packaged (SMF-5)

A Salesforce package directory with no `package` key: `sf project deploy start --source-dir
unpackaged --target-org <alias>` deploys it, but `sf package version create` never includes
it. Put **test fixtures** here — SMF-3 persona permission sets (e.g. `MF_Case_Worker`),
fixture-only metadata — under `unpackaged/main/default/<type>/`.

Only the app ships in the unlocked package (`force-app`, package `FieldSupportPoC`): the
`FieldSupport` UI bundle, its `CustomApplication` and `FieldSupport_Access`.
`python3 scripts/smf5/check_package.py` fails if anything else appears under `force-app`.
See `docs/smf-5/subscriber-runbook.md`.
