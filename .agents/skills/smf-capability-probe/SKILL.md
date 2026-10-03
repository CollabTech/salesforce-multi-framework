---
name: smf-capability-probe
description: "Use when building a PoC probe for an SMF story (camera/mic, RealtimeKit A/V, screen share, recovery, Files, tldraw markup/sync, 3D, packaging). Keeps each probe bounded to its story's case IDs and makes failure a reportable result."
metadata:
  project: salesforce-multi-framework
  owner: SMF-1
---

# Bounded capability probes

A probe answers one story's question with the least code that can produce evidence.

- **Scope = the story's case IDs.** No features beyond them, no work from later stories.
  Reuse earlier probes' verified setup; don't rebuild it.
- **Platform mechanics come from official skills** (UIBundle scaffolding, data access,
  deploy, packaging). Use them instead of hand-rolled equivalents.
- **Instrument for evidence**: log versions, timestamps, and measured values (latency, fps,
  sizes) to sanitized output. Report measured values even when below target.
- **Design for negative results**: each case must be able to end PASS, FAIL, PARTIAL, or
  BLOCKED. Detect and surface unsupported behaviour (e.g. permission denied, API missing in
  the host) instead of hiding it with fallbacks — a graceful fallback is itself a finding.
- **Never change a target** (size limits, latency, fps) after seeing a result; that needs
  a prior recorded project-owner decision.
- **Denial tests are mandatory** where the contract defines them (MF-RESTRICTED,
  MF-CASE-002, MF-FILE-DENIED, MF-ROOM-002).
- Keep the probe removable: isolated folder/component, documented in the story's PoC brief.
