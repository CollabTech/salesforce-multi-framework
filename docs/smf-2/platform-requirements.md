# SMF-2 — current platform requirements (from official documentation)

Retrieved 2026-10-03. **How retrieved:** this cloud session's network policy blocks
`developer.salesforce.com` and `help.salesforce.com` for direct fetches (and therefore the
`platform-docs-get` skill), so the text below comes from a web-search tool restricted to
those two official domains, which returns excerpts of the pages. Each row names the
page. These are **documented requirements**, not observations of the project's org; the
org-side values are observed only by `scripts/sf/readiness.py` (ENV-01..03).

## Two different "Edge" items (SMF-2 AC3, C-05)

| Term | Meaning in this project | Where it is tested |
|---|---|---|
| **Salesforce Edge Network** | Salesforce's network routing layer for My Domain. Required for the Salesforce app domain that Multi-Framework employee apps are served from. An **org setting**. | SMF-2 ENV-01 (this story) |
| **Microsoft Edge** | Desktop browser, one of the two required desktop rows (`ENV-DESKTOP-EDGE`). A **test environment**, not an org prerequisite. | SMF-4 HOST-03 and every later desktop case |

SMF-2's "Edge requirements" is the Salesforce Edge Network. Microsoft Edge browser support
is not claimed or tested by SMF-2.

## Multi-Framework (UIBundle) prerequisites

| # | Requirement | Source (official page) | How SMF-2 verifies it on the org |
|---|---|---|---|
| R1 | Generally available; enabled on all **Hyperforce** orgs (production, sandbox, Developer Edition, scratch) on **Summer '26 or later** | developer.salesforce.com/blogs/2026/07/build-with-react-on-salesforce-multi-framework-is-now-ga | Instance/Hyperforce: manual Setup observation (Company Information). Release: org API version ≥ the Summer '26 version (observed `apiVersion`) |
| R2 | Editions: Enterprise, Performance, Unlimited, Developer, Partner Developer, on Hyperforce, **English default language**; not Alibaba Cloud or Government Cloud | developer.salesforce.com/docs/platform/multiframework/guide/reactdev-setup.html; …/blogs/2026/04/build-with-react-run-on-salesforce-introducing-salesforce-multi-framework | `Organization.OrganizationType`, `LanguageLocaleKey` |
| R3 | **Salesforce app domain** (`*.my.salesforce.app`) must be enabled: Setup → *Salesforce Multi-Framework Apps* → *Enable Domain* (needs Customize Application) | developer.salesforce.com/docs/platform/multiframework/guide/mfw-setup.html | Manual Setup observation (no documented API found) |
| R4 | **Salesforce Edge Network** required for the app domain: Setup → My Domain → Routing and Policies → Salesforce Edge Network | mfw-setup.html; help.salesforce.com articleView?id=sf.domain_name_edge_network_considerations.htm | Retrieve `Settings:MyDomain`; otherwise manual observation |
| R5 | Employee apps use a `CustomApplication` target (beta `AppLauncher` target deprecated); visibility via permission set or profile | GA blog; …/multiframework/guide/mfw-manage.html | Deployed metadata (SMF-4) |
| R6 | Users open the internal app from the App Launcher on desktop or in the **Salesforce mobile app** | developer.salesforce.com/docs/platform/multiframework/overview | Physical-device tests (SMF-4 HOST-03); not provable by SMF-2 |
| R7 | Salesforce mobile app minimums: **iOS 18.0+**, **Android 12.0+ with Android WebView 90+** | help.salesforce.com articleView?id=salesforce_app_requirements.htm | Device rows record OS/app/WebView versions |
| R8 | Tooling: Salesforce CLI and **Node.js ≥ 18** (docs); the generated `reactinternalapp` bundle declares `node >= 22` | reactdev-setup.html; generated `package.json` | `sf version`, `node --version` |
| R9 | `UIBundle` is supported in **managed and unlocked packages** for internal (B2E) apps only, packaged with its `CustomApplication` and access permission set | developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_uibundle.htm | SMF-5 |
| R10 | API version for UIBundle packaging: the docs excerpt does not state a minimum. The official template generated on 2026-10-03 sets `sourceApiVersion` **67.0**; that is the version SMF-4/5 use and SMF-2 checks the org supports (`apiVersion ≥ 67.0`) | generated `sfdx-project.json`; meta_uibundle.htm | Observed `apiVersion` from `sf org display` |

## Dev Hub and unlocked 2GP prerequisites

| # | Requirement | Source | Verification |
|---|---|---|---|
| D1 | Dev Hub enabled (irreversible; System Administrator) | …/sfdx-dev/guide/sfdx-setup-enable-devhub.html | `ScratchOrgInfo` queryable |
| D2 | "Enable Unlocked Packages and Second-Generation Managed Packages" in Dev Hub settings | …/sfdx-dev/guide/sfdx-setup-enable-secondgen-pkg.html | `Package2` queryable via Tooling API |
| D3 | Package developers need System Administrator or **Create and Update Second-Generation Packages** | …/sfdx-dev/guide/sfdx-dev-unlocked-pkg-before.html | Admin persona permission check |
| D4 | **Developer Edition Dev Hub: max 3 active scratch orgs and 6 scratch orgs per day; package versions per day = daily scratch allocation**, counted separately; a DE org can expire from inactivity, losing its packages | …/pkg2-dev/guide/… (Developer Edition limits), sfdx-dev-considerations.html | `sf org list limits` (`ActiveScratchOrgs`, `DailyScratchOrgs`, `Package2VersionCreates`) |
| D5 | The Dev Hub is **not** the application test org; dev org and install-test org are separate (SMF-2 AC4) | SMF-2 | Org IDs compared privately |

## Risks the documentation raises for later stories (not SMF-2 results)

- **Licences:** MF-TECH, MF-SUPPORT and MF-RESTRICTED need Case access, which requires a full
  *Salesforce* user licence (Salesforce Platform licences exclude Case). Developer Edition
  orgs ship with very few Salesforce licences; ENV-02 counts them. A shortage blocks the
  affected SMF-3 cases; MF-RESTRICTED is never dropped. MF-CASE-002 is owned by MF-ADMIN
  (not a business persona), so it needs no extra licence.
- **tldraw (SMF-11/12):** production use (HTTPS, non-localhost, production build) needs a
  tldraw licence key (tldraw.dev/sdk-features/license-key). A Salesforce-hosted bundle is
  production by that definition. tldraw sync must be self-hosted (tldraw.dev/docs/sync).
- **RealtimeKit (SMF-7):** needs a Cloudflare account, a RealtimeKit app, and a server-side
  API token. Meetings/participant tokens are free to create; usage is billed per participant
  minute (developers.cloudflare.com/realtime/realtimekit/faq/).
