import { execFileSync } from 'node:child_process';
import type { Browser, BrowserContext, Frame, Page } from '@playwright/test';

/** SMF-5: persona sessions in the SUBSCRIBER org (smf-install-test), where the package is
 *  installed. Same mechanism as persona.ts (frontdoor URL from the persona's own CLI auth,
 *  never logged), but against the install-test org and its persona aliases
 *  smf-install-test-{tech,support,restricted} created by SMF-3 provisioning (stage 62). */
export const SUBSCRIBER = 'smf-install-test';
export type Persona = 'tech' | 'support' | 'restricted';
const APP_PATH = process.env.SMF_APP_PATH ?? '/lightning/app/c__FieldSupport';

interface SfResult {
  [key: string]: unknown;
}

function sf(args: string[]): SfResult {
  const out = execFileSync('sf', [...args, '--json'], { encoding: 'utf8', env: { ...process.env, SF_DISABLE_TELEMETRY: 'true' } });
  return (JSON.parse(out) as { result: SfResult }).result;
}

const alias = (p: Persona): string => `${SUBSCRIBER}-${p}`;
const username = (p: Persona): string => String(sf(['org', 'display', 'user', '--target-org', alias(p)]).username);

export async function subscriberContext(browser: Browser, p: Persona, path = APP_PATH): Promise<BrowserContext> {
  const { url } = sf(['org', 'open', '--url-only', '--path', path, '--target-org', alias(p)]);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(String(url), { waitUntil: 'domcontentloaded' });
  return ctx;
}

export function subscriberDisplayName(p: Persona): string {
  const id = String(sf(['org', 'display', 'user', '--target-org', alias(p)]).id);
  const res = sf(['data', 'query', '--query', `SELECT Name FROM User WHERE Id = '${id}'`, '--target-org', SUBSCRIBER]);
  return String((res.records as Array<{ Name: string }>)[0].Name);
}

/** Admin toggle of the packaged FieldSupport_Access permission set in the subscriber. */
export function setSubscriberAppAccess(p: Persona, enabled: boolean): void {
  const u = username(p);
  if (enabled) {
    sf(['org', 'assign', 'permset', '--name', 'FieldSupport_Access', '--on-behalf-of', u, '--target-org', SUBSCRIBER]);
    return;
  }
  const q = sf(['data', 'query', '--query',
    `SELECT Id FROM PermissionSetAssignment WHERE PermissionSet.Name = 'FieldSupport_Access' AND Assignee.Username = '${u}'`,
    '--target-org', SUBSCRIBER]);
  for (const r of q.records as Array<{ Id: string }>) {
    sf(['data', 'delete', 'record', '--sobject', 'PermissionSetAssignment', '--record-id', r.Id, '--target-org', SUBSCRIBER]);
  }
}

/** The UI bundle renders inside the Lightning frame; find the frame that holds `heading`. */
export async function appFrame(page: Page, heading = 'Launch check'): Promise<Page | Frame> {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  for (const f of page.frames()) {
    if (await f.getByRole('heading', { name: heading }).count()) return f;
  }
  return page;
}
