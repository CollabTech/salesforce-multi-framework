import { describe, expect, it } from 'vitest';
import { PACKAGE_MARKER, PACKAGE_NAME, formatPackageMarker } from '../packageVersion';

describe('SMF-5 package marker', () => {
  it('is a vN label with a semantic version', () => {
    expect(PACKAGE_MARKER.label).toMatch(/^v\d+$/);
    expect(PACKAGE_MARKER.number).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('formats an evidence block with package, marker, build and time', () => {
    const text = formatPackageMarker({ label: 'v2', number: '1.1.0' }, 'abc1234', '2026-10-03T00:00:00.000Z');
    expect(text.split('\n')).toEqual([
      `package: ${PACKAGE_NAME}`,
      'package marker: v2 (1.1.0)',
      'bundle build: abc1234',
      'captured: 2026-10-03T00:00:00.000Z',
    ]);
  });
});
