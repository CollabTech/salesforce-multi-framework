import { execFileSync } from 'node:child_process';
import type { Browser, BrowserContext } from '@playwright/test';

export type Persona = 'tech' | 'support' | 'restricted';
const APP_PATH = process.env.SMF_APP_PATH ?? '/lightning/app/c__FieldSupport'; // verified on first deployed run

function sf(args: string[]): any {
  const out = execFileSync('sf', [...args, '--json'], { encoding: 'utf8', env: { ...process.env, SF_DISABLE_TELEMETRY: 'true' } });
  return JSON.parse(out).result;
}

/** A browser context logged in as the persona via a frontdoor URL from the persona's own CLI auth.
 *  The URL carries a session token: it is never logged, stored, or put in traces' visible text. */
export async function personaContext(browser: Browser, persona: Persona, path = APP_PATH): Promise<BrowserContext> {
  const alias = `smf-dev-${persona}`;
  const { url } = sf(['org', 'open', '--url-only', '--path', path, '--target-org', alias]);
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  return ctx;
}

export function personaDisplayName(persona: Persona): string {
  const alias = `smf-dev-${persona}`;
  const user = sf(['org', 'display', 'user', '--target-org', alias]);
  const rec = sf(['data', 'query', '--query', `SELECT Name FROM User WHERE Id = '${user.id}'`, '--target-org', 'smf-dev']);
  return rec.records[0].Name as string;
}

export function setAppAccess(persona: Persona, enabled: boolean): void {
  const username = sf(['org', 'display', 'user', '--target-org', `smf-dev-${persona}`]).username as string;
  if (enabled) {
    sf(['org', 'assign', 'permset', '--name', 'FieldSupport_Access', '--on-behalf-of', username, '--target-org', 'smf-dev']);
  } else {
    const q = sf(['data', 'query', '--query',
      `SELECT Id FROM PermissionSetAssignment WHERE PermissionSet.Name = 'FieldSupport_Access' AND Assignee.Username = '${username}'`,
      '--target-org', 'smf-dev']);
    for (const r of q.records) sf(['data', 'delete', 'record', '--sobject', 'PermissionSetAssignment', '--record-id', r.Id, '--target-org', 'smf-dev']);
  }
}
