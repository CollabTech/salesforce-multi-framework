# Evidence

One record per case ID (per environment row where a case spans several) at
`evidence/SMF-<n>/<CASE-ID>.md`, created from [`TEMPLATE.md`](TEMPLATE.md). Outcomes and
rules: the `smf-evidence` skill and `testing/contract.json`.

- Records hold **executed** results only; a specification is never a result.
- `python3 scripts/check-test-plan.py` rejects records naming an unknown case ID, filed
  under the wrong story, or using an undefined outcome.
- Large binaries (recordings) are stored outside Git; link the sanitized artifact.
