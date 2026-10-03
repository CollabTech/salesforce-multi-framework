# SMF-2 — repeatable setup path (ENV-03)

**Primary path: cloud.** After the one-time `docs/cloud/HUMAN-SETUP.md` (H1 network, H2
Dev Hub auth URL, H3 consent), run `bash scripts/cloud/session-setup.sh` then stages
`10-readiness` and `20-orgs` of `scripts/cloud/pipeline.sh` in the cloud session. The manual
steps below are the reference sequence.

Three logical targets. Aliases are local names; the alias → org mapping lives only in
`private/orgs.json` (`docs/private-mapping-format.md`).

| Alias | Role | Create or reuse | Used by |
|---|---|---|---|
| `smf-devhub` | Dev Hub + package owner. **Not** an application test org. | Reuse the existing Developer org (if ENV-01 confirms edition/Hyperforce/Dev Hub) | SMF-5 package create; scratch-org creation |
| `smf-dev` | Development / application test org: SMF-3 personas and fixtures, SMF-4..14 probes | Scratch org from `smf-devhub` (`config/smf-dev-scratch-def.json`) — or the Developer org itself **only if** ENV-02 shows a scratch org cannot hold the personas; record that decision | SMF-3..14 |
| `smf-install-test` | Separate subscriber org for package install/upgrade | Scratch org from `smf-devhub` (`config/smf-install-test-scratch-def.json`) | SMF-5 |

A Developer-Edition Dev Hub allows **3 active / 6 per day** scratch orgs. Two are used here.

## Steps (each org command names its target)

1. **Tools** (contributor machine): Node ≥ 22 (the generated bundle requires it), Salesforce
   CLI v2 (`npm install -g @salesforce/cli` or the installer), Python 3.8+, then
   `python3 scripts/bootstrap-skills.py`.
2. **Authenticate the Dev Hub** in the local credential store:
   `sf org login web --alias smf-devhub --set-default-dev-hub` is **not** used (no implicit
   defaults). Use `sf org login web --alias smf-devhub`. Brandon completes any passkey/MFA
   prompt. Headless hosts (cloud agents) instead receive an SFDX auth URL through a secret
   environment variable and run `sf org login sfdx-url --alias smf-devhub --sfdx-url-stdin`
   with the variable piped in; the URL is never written to the repository or logs.
3. **Read-only readiness** (ENV-01/02):
   `python3 scripts/sf/readiness.py --devhub smf-devhub --dev smf-dev --install-test smf-install-test --report evidence/SMF-2/readiness-<date>.md`.
   Stop if any identity item is not OBSERVED-PASS.
4. **Create the two scratch orgs** (approval needed; consumes allocation) with
   `dx-org-manage`, always with explicit `--target-dev-hub smf-devhub`:
   `sf org create scratch --definition-file config/smf-dev-scratch-def.json --alias smf-dev --target-dev-hub smf-devhub --duration-days 30`
   `sf org create scratch --definition-file config/smf-install-test-scratch-def.json --alias smf-install-test --target-dev-hub smf-devhub --duration-days 30`
5. **Manual Setup observations** that have no documented API (the readiness report lists
   them as MANUAL): Brandon reports, for each of `smf-dev` and `smf-install-test`:
   (a) Setup → Salesforce Multi-Framework Apps: is *Enable Domain* shown? (enable it if so);
   (b) Setup → My Domain → Routing and Policies: Salesforce Edge Network enabled?;
   (c) Setup → Company Information: Hyperforce instance?
6. Rerun step 3; all items OBSERVED-PASS ⇒ ENV-01..03 PASS. Record blockers otherwise.
7. Save the mapping to `private/orgs.json`. Never commit it.

Packaging is **not** tested here; SMF-5 owns PKG-01..03.
