/**
 * SMF-5 PKG-02 visible upgrade marker. This constant is the ONLY intended difference
 * between package v1 and v2 (docs/smf-5/subscriber-runbook.md, step V2-1):
 *   v1: { label: 'v1', number: '1.0.0' }
 *   v2: { label: 'v2', number: '1.1.0' }
 * `number` must equal the major.minor.patch of sfdx-project.json `versionNumber`
 * (checked by scripts/smf5/check_package.py).
 */
export interface PackageMarker {
  label: string;
  number: string;
}

export const PACKAGE_MARKER: PackageMarker = { label: 'v1', number: '1.0.0' };

export const PACKAGE_NAME = 'FieldSupportPoC';

/** Plain-text block a tester pastes into the PKG-01/PKG-02 evidence record. */
export function formatPackageMarker(marker: PackageMarker, build: string, capturedAt: string): string {
  return [
    `package: ${PACKAGE_NAME}`,
    `package marker: ${marker.label} (${marker.number})`,
    `bundle build: ${build}`,
    `captured: ${capturedAt}`,
  ].join('\n');
}
