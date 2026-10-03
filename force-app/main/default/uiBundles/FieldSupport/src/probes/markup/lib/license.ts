/**
 * tldraw licensing (SMF-11 AC5). The SDK needs a license key in "production": HTTPS on a
 * non-loopback host with a production build — which is how the app runs inside Salesforce.
 * Without a valid key covering the host, tldraw logs errors and stops rendering the editor
 * after ~5 s. The key is read at BUILD time from VITE_TLDRAW_LICENSE_KEY (the cloud deploy
 * sets it from the owner's TLDRAW_LICENSE_KEY env var). The key itself is never committed.
 */
export const LICENSE_ENV_NAME = 'VITE_TLDRAW_LICENSE_KEY';

export function licenseKeyFromBuild(): string | undefined {
  const key: unknown = import.meta.env.VITE_TLDRAW_LICENSE_KEY;
  return typeof key === 'string' && key.trim() !== '' ? key.trim() : undefined;
}

export type TldrawEnvironment = 'development' | 'production';

/** Mirrors tldraw's documented rule for when a license is enforced. */
export function tldrawEnvironment(loc: Pick<Location, 'protocol' | 'hostname'>, prodBuild: boolean): TldrawEnvironment {
  const loopback = loc.hostname === 'localhost' || loc.hostname === '::1' || loc.hostname === '[::1]' || /^127\./.test(loc.hostname);
  return loc.protocol === 'https:' && !loopback && prodBuild ? 'production' : 'development';
}

export interface LicenseStatus {
  environment: TldrawEnvironment;
  keyConfigured: boolean;
  /** Production use is gated: allowed only with a key (validity/host coverage is checked by tldraw). */
  productionGate: 'not-required' | 'key-present' | 'BLOCKED-no-key';
}

export function licenseStatus(loc: Pick<Location, 'protocol' | 'hostname'>, prodBuild: boolean, key: string | undefined): LicenseStatus {
  const environment = tldrawEnvironment(loc, prodBuild);
  const keyConfigured = !!key;
  return {
    environment,
    keyConfigured,
    productionGate: environment === 'development' ? 'not-required' : keyConfigured ? 'key-present' : 'BLOCKED-no-key',
  };
}
