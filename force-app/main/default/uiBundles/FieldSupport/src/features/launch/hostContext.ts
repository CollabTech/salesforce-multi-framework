/**
 * Host context captured for HOST-01..03 evidence. Values are what the runtime reports;
 * the tester still records device model, OS and Salesforce app versions by hand.
 * Nothing here identifies a user beyond the display name shown on screen.
 */
export interface HostContext {
  origin: string;
  path: string;
  inIframe: boolean;
  userAgent: string;
  viewport: string;
  devicePixelRatio: number;
  online: boolean;
  secureContext: boolean;
  mediaDevicesApi: boolean;
  build: string;
  capturedAt: string;
}

export function readHostContext(win: Window = window): HostContext {
  let inIframe = true;
  try {
    inIframe = win.self !== win.top;
  } catch {
    inIframe = true; // cross-origin parent: we are framed
  }
  return {
    origin: win.location.origin,
    path: win.location.pathname,
    inIframe,
    userAgent: win.navigator.userAgent,
    viewport: `${win.innerWidth}x${win.innerHeight}`,
    devicePixelRatio: win.devicePixelRatio,
    online: win.navigator.onLine,
    secureContext: win.isSecureContext,
    mediaDevicesApi: typeof win.navigator.mediaDevices?.getUserMedia === 'function',
    build: import.meta.env.VITE_BUILD_COMMIT ?? 'local',
    capturedAt: new Date().toISOString(),
  };
}

/** Plain-text block a tester pastes into the evidence record. */
export function formatHostContext(ctx: HostContext, user: string | null): string {
  return [
    `build: ${ctx.build}`,
    `captured: ${ctx.capturedAt}`,
    `user (display name): ${user ?? 'unknown'}`,
    `origin: ${ctx.origin}`,
    `path: ${ctx.path}`,
    `framed: ${ctx.inIframe}`,
    `secure context: ${ctx.secureContext}`,
    `viewport: ${ctx.viewport} @${ctx.devicePixelRatio}x`,
    `online: ${ctx.online}`,
    `getUserMedia API present: ${ctx.mediaDevicesApi}`,
    `user agent: ${ctx.userAgent}`,
  ].join('\n');
}
