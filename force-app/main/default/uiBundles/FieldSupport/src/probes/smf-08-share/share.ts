import { mapMediaError, readPolicyReport } from '../smf-06-capture/capture';

/**
 * SMF-8 screen-share capability detection and outcome mapping. Detection is an observation of
 * the host, never proof that sharing works (SHARE-03: a visible button is not success).
 */

export type ShareVerdict = 'api-present' | 'unsupported-api' | 'blocked-by-policy' | 'insecure-context';

export interface ShareSupport {
  verdict: ShareVerdict;
  getDisplayMedia: boolean;
  displayCapturePolicy: string;
  secureContext: boolean;
  framed: boolean | 'unknown';
  mobileUserAgent: boolean;
  explanation: string;
}

const EXPLAIN: Record<ShareVerdict, string> = {
  'api-present': 'This host exposes getDisplayMedia. Whether sharing actually works is only known after a real attempt.',
  'unsupported-api': 'This host does not offer screen sharing (no getDisplayMedia — typical for iOS/Android in-app web views and mobile browsers). The call continues; use the approved static image instead.',
  'blocked-by-policy': 'The host page blocks screen capture for this app (Permissions-Policy display-capture). The call continues; use the approved static image instead.',
  'insecure-context': 'Screen capture requires a secure (https) context.',
};

export function detectShareSupport(win: Window = window): ShareSupport {
  const p = readPolicyReport(win);
  const mobileUserAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(win.navigator.userAgent);
  let verdict: ShareVerdict = 'api-present';
  if (!p.secureContext) verdict = 'insecure-context';
  else if (!p.displayMediaApi) verdict = 'unsupported-api';
  else if (p.displayCapture === 'blocked') verdict = 'blocked-by-policy';
  return {
    verdict,
    getDisplayMedia: p.displayMediaApi,
    displayCapturePolicy: p.displayCapture,
    secureContext: p.secureContext,
    framed: p.framed,
    mobileUserAgent,
    explanation: EXPLAIN[verdict],
  };
}

export type ShareOutcomeCode = 'CANCELLED_OR_DENIED' | 'NOT_SUPPORTED' | 'NOT_A_GESTURE' | 'ABORTED' | 'CAPTURE_FAILED' | 'OTHER';

export interface ShareFailure {
  code: ShareOutcomeCode;
  raw: string;
  explanation: string;
}

/** Map getDisplayMedia / SDK screen-share failures. Cancel and deny both arrive as NotAllowedError. */
export function mapShareError(e: unknown): ShareFailure {
  const name = typeof e === 'object' && e !== null && 'name' in e ? String((e as { name: unknown }).name) : '';
  const message = e instanceof Error ? e.message : String(e);
  const raw = `${name || 'Error'}: ${message}`;
  switch (name) {
    case 'NotAllowedError':
      return { code: 'CANCELLED_OR_DENIED', raw, explanation: 'Sharing was cancelled in the picker or denied by the browser/OS/host. The call is unaffected; try again or use the static image.' };
    case 'NotSupportedError':
      return { code: 'NOT_SUPPORTED', raw, explanation: EXPLAIN['unsupported-api'] };
    case 'InvalidStateError':
      return { code: 'NOT_A_GESTURE', raw, explanation: 'The browser requires screen sharing to start directly from a tap/click.' };
    case 'AbortError':
      return { code: 'ABORTED', raw, explanation: 'The capture was aborted by the browser.' };
    case 'NotReadableError':
    case 'NotFoundError':
      return { code: 'CAPTURE_FAILED', raw, explanation: mapMediaError(e).explanation };
    default:
      return { code: 'OTHER', raw, explanation: 'Unexpected failure; see the raw error. The call is unaffected.' };
  }
}

/** Describe a screen track without identifiers (displaySurface, size, frame rate). */
export function describeScreenTrack(t: MediaStreamTrack | undefined): string {
  if (!t) return 'none';
  const s = (typeof t.getSettings === 'function' ? t.getSettings() : {}) as Record<string, unknown>;
  const parts = ['displaySurface', 'width', 'height', 'frameRate', 'logicalSurface', 'cursor']
    .filter(k => s[k] !== undefined)
    .map(k => `${k}=${String(s[k])}`);
  return `${t.kind} ${t.readyState}${parts.length ? ` [${parts.join(', ')}]` : ''}`;
}
