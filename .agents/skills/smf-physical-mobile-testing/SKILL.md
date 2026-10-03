---
name: smf-physical-mobile-testing
description: "Use when planning, running, or recording any test that makes a claim about Salesforce mobile, device hardware (camera, mic, speaker), A/V quality, or desktop browser hosts. Separates physical-device evidence from emulators, mobile browsers, and localhost."
metadata:
  project: salesforce-multi-framework
  owner: SMF-1
---

# Physical-mobile and host testing

**Environment rows are separate evidence** (SMF-3):
- Desktop Chrome and Edge — record exact versions.
- **Physical** Salesforce mobile app on iOS and on Android — record device model, OS
  version, Salesforce app version.
- Mobile Safari / mobile Chrome — separate *exploratory* rows.
- Emulator/simulator and localhost — separate rows, never substitutes.

**Rules**
- A Salesforce-mobile claim requires a physical-device run inside the Salesforce mobile app.
  No desktop-, browser-, emulator-, or localhost-derived PASS.
- Missing device ⇒ that row is BLOCKED / NOT TESTED, with the device needed named.
- State the runtime origin/hosting context and build/commit for every run.
- Use separate simultaneous sessions for TECH and SUPPORT; never reuse a business session
  as ADMIN.

**Who does what**: the implementing agent writes the probe, automation, and a step-by-step
manual script. Brandon or a designated tester performs physical-device actions, OS
permission/passkey prompts, and subjective audio/video judgements. The evidence record
names who actually performed each step. Ask for a specific interaction, e.g.
"On the physical iPhone, open MF-CASE-001 in the Salesforce app, tap Start camera, accept
the OS camera prompt, and report whether the preview appears."
