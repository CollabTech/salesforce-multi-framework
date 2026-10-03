/**
 * SMF-12 room tickets. In Salesforce, the SMF-12 Apex endpoint checks the user's case
 * access and asks the sync service to mint a short-lived token (user + case + room + expiry).
 * On localhost with ?transport=mock only, a test harness may provide tickets through
 * window.__smf12Mint (Playwright), minted with a local test secret.
 */
import { createDataSDK } from '@salesforce/platform-sdk';
import { NotConfiguredError, NotFoundOrDeniedError, isLocalhostOrigin, isSalesforceId, platformErrorCode } from '../../files/lib';

export interface RoomTicket {
  token: string;
  room: string;
  /** Epoch seconds. */
  expiresAt: number;
  /** ws(s):// base of the sync service. */
  wsUrl: string;
}

export interface TokenSource {
  readonly kind: 'salesforce' | 'localhost-test';
  mint(caseId: string): Promise<RoomTicket>;
}

declare global {
  interface Window {
    __smf12Mint?: (caseId: string) => Promise<RoomTicket | { error: string; status: number }>;
  }
}

function isTicket(v: unknown): v is RoomTicket {
  return !!v && typeof v === 'object' && 'token' in v && 'room' in v && 'wsUrl' in v;
}

export const salesforceTokenSource: TokenSource = {
  kind: 'salesforce',
  async mint(caseId: string): Promise<RoomTicket> {
    if (!isSalesforceId(caseId)) throw new Error('Case Id is not a valid Salesforce Id.');
    const sdk = await createDataSDK();
    if (!sdk.fetch) throw new Error('The Salesforce data SDK has no fetch on this surface.');
    const res = await sdk.fetch(`/services/apexrest/smf12/v1/cases/${caseId}/room-token`, {
      method: 'POST',
      headers: { Accept: 'application/json' },
    });
    const body: unknown = await res.json().catch(() => null);
    const code = platformErrorCode(body);
    if (code) throw new NotConfiguredError(code, res.status);
    if (res.status === 404) throw new NotFoundOrDeniedError();
    if (!res.ok || !isTicket(body)) {
      const message = body && typeof body === 'object' && 'message' in body ? String((body as { message: unknown }).message) : `HTTP ${res.status}`;
      throw new Error(`Room token refused: ${message}`);
    }
    return body;
  },
};

const localTestTokenSource: TokenSource = {
  kind: 'localhost-test',
  async mint(caseId: string): Promise<RoomTicket> {
    const fn = window.__smf12Mint;
    if (!fn) throw new Error('No localhost test token minter is attached.');
    const r = await fn(caseId);
    if ('error' in r) throw r.status === 404 ? new NotFoundOrDeniedError(r.error) : new Error(r.error);
    return r;
  },
};

export function selectTokenSource(win: Window = window): TokenSource {
  const params = new URLSearchParams(win.location.search);
  return params.get('transport') === 'mock' && isLocalhostOrigin(win.location.hostname) ? localTestTokenSource : salesforceTokenSource;
}

export function connectUri(ticket: RoomTicket): string {
  return `${ticket.wsUrl.replace(/\/$/, '')}/connect/${ticket.room}?token=${encodeURIComponent(ticket.token)}`;
}
