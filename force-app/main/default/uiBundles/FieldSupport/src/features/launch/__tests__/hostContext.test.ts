import { describe, expect, it } from 'vitest';
import { formatHostContext, readHostContext } from '../hostContext';

describe('readHostContext', () => {
  it('reports framing, origin and API presence from the runtime', () => {
    const ctx = readHostContext(window);
    expect(ctx.origin).toBe(window.location.origin);
    expect(ctx.inIframe).toBe(false);
    expect(typeof ctx.mediaDevicesApi).toBe('boolean');
    expect(ctx.build).toBe('local');
  });

  it('treats an inaccessible parent as framed', () => {
    const fake = Object.create(window) as Window;
    Object.defineProperty(fake, 'self', { value: {} });
    Object.defineProperty(fake, 'top', { get: () => { throw new Error('cross-origin'); } });
    expect(readHostContext(fake).inIframe).toBe(true);
  });

  it('formats a paste-ready block without user IDs', () => {
    const text = formatHostContext(readHostContext(window), 'MF Tech');
    expect(text).toContain('user (display name): MF Tech');
    expect(text).not.toMatch(/005[A-Za-z0-9]{12}/);
  });
});
