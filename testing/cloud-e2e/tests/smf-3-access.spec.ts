import { test, expect, type BrowserContext } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { personaContext, type Persona } from './persona';
import { record } from './record';

/*
 * SMF-3 DATA-02 in cloud desktop browsers, as each real persona (its own CLI session, never an admin):
 *   TECH and SUPPORT open MF-CASE-001 and download MF-IMAGE-001 (bytes must match the fixture manifest);
 *   RESTRICTED cannot; all three are denied MF-CASE-002 and MF-FILE-DENIED.
 * Rows: ENV-DESKTOP-EDGE (official Microsoft Edge on Linux), ENV-CLOUD-CHROMIUM (never a substitute for
 * ENV-DESKTOP-CHROME), ENV-DESKTOP-CHROME only with SMF_CHROME=1.
 *
 * What automation CANNOT attest here (left to humans, testing/HUMAN-ACTIONS.md + docs/test-scripts/):
 *   - an interactive login with the persona's password and MFA/identity verification (the session here
 *     comes from a frontdoor URL minted from the persona's CLI auth);
 *   - any Salesforce mobile app or mobile-browser behaviour (physical devices only);
 *   - how the image looks to a person.
 * Record IDs are looked up with the admin alias only to build URLs; they are never recorded or logged.
 */

const CASE1 = 'Pump overheating — remote diagnosis';
const CASE2 = 'MF-CASE-002 restricted negative control (synthetic)';
const ACCOUNT = 'CollabTech PoC Test Customer';

function sfQuery(soql: string): any[] {
  const out = execFileSync('sf', ['data', 'query', '--query', soql, '--target-org', 'smf-dev', '--json'],
    { encoding: 'utf8', env: { ...process.env, SF_DISABLE_TELEMETRY: 'true' } });
  return JSON.parse(out).result.records;
}

function one(soql: string, what: string): string {
  const recs = sfQuery(soql);
  if (recs.length !== 1) throw new Error(`fixture ${what} must exist exactly once (stage 32); found ${recs.length}`);
  return recs[0].Id as string;
}

const q = (s: string) => `'${s.replace(/'/g, "\\'")}'`;
const manifest = JSON.parse(readFileSync('../fixtures/manifest.json', 'utf8'));
const sha = (lid: string) => manifest.fixtures.find((f: any) => f.logical_id === lid && f.media_type === 'image/png').sha256 as string;

function fixtureIds() {
  return {
    case1: one(`SELECT Id FROM Case WHERE Subject = ${q(CASE1)} AND Account.Name = ${q(ACCOUNT)}`, 'MF-CASE-001'),
    case2: one(`SELECT Id FROM Case WHERE Subject = ${q(CASE2)} AND Account.Name = ${q(ACCOUNT)}`, 'MF-CASE-002'),
    image: one(`SELECT Id FROM ContentVersion WHERE Title = 'MF-IMAGE-001' AND IsLatest = true`, 'MF-IMAGE-001'),
    denied: one(`SELECT Id FROM ContentVersion WHERE Title = 'MF-FILE-DENIED' AND IsLatest = true`, 'MF-FILE-DENIED'),
  };
}

const DENIED_TEXT = /insufficient privileges|don't have access|do not have access|no longer available|unable to access|isn't available/i;

async function openCase(ctx: BrowserContext, caseId: string, subject: string) {
  const page = ctx.pages()[0];
  const origin = new URL(page.url()).origin;
  await page.goto(`${origin}/lightning/r/Case/${caseId}/view`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  const subjectShown = (await page.getByText(subject, { exact: false }).count()) > 0;
  const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  return { subjectShown, deniedMessage: (body.match(DENIED_TEXT) ?? [''])[0] };
}

async function fetchFile(ctx: BrowserContext, versionId: string) {
  const page = ctx.pages()[0];
  const origin = new URL(page.url()).origin;
  const res = await ctx.request.get(`${origin}/sfc/servlet.shepherd/version/download/${versionId}`, { maxRedirects: 5 });
  const type = res.headers()['content-type'] ?? '';
  const bytes = type.startsWith('image/') ? await res.body() : Buffer.alloc(0);
  return { status: res.status(), type: type.split(';')[0], sha256: bytes.length ? createHash('sha256').update(bytes).digest('hex') : '' };
}

const allowed: Persona[] = ['tech', 'support'];
const everyone: Persona[] = ['tech', 'support', 'restricted'];
const label = (p: Persona) => `MF-${p.toUpperCase()}`;

for (const persona of allowed) {
  test(`DATA-02 ${persona}: opens MF-CASE-001 and downloads MF-IMAGE-001`, async ({ browser }, info) => {
    const ids = fixtureIds();
    const ctx = await personaContext(browser, persona, '/lightning/page/home');
    const c = await openCase(ctx, ids.case1, CASE1);
    const f = await fetchFile(ctx, ids.image);
    record(info, { browserVersion: browser.version(), case: 'DATA-02', persona: label(persona), fixture: 'MF-CASE-001, MF-IMAGE-001',
      observed: `case subject shown=${c.subjectShown}; denial text="${c.deniedMessage}"; image status=${f.status} type=${f.type} sha256 matches manifest=${f.sha256 === sha('MF-IMAGE-001')}` });
    expect(c.subjectShown, `${label(persona)} must see MF-CASE-001`).toBe(true);
    expect(f.sha256, `${label(persona)} must retrieve MF-IMAGE-001 unchanged`).toBe(sha('MF-IMAGE-001'));
    await ctx.close();
  });
}

test('DATA-02 restricted: denied MF-CASE-001 and MF-IMAGE-001', async ({ browser }, info) => {
  const ids = fixtureIds();
  const ctx = await personaContext(browser, 'restricted', '/lightning/page/home');
  const c = await openCase(ctx, ids.case1, CASE1);
  const f = await fetchFile(ctx, ids.image);
  record(info, { browserVersion: browser.version(), case: 'DATA-02', persona: 'MF-RESTRICTED', fixture: 'MF-CASE-001, MF-IMAGE-001',
    observed: `case subject shown=${c.subjectShown}; denial text="${c.deniedMessage}"; image status=${f.status} type=${f.type} bytes returned=${f.sha256 !== ''}` });
  expect(c.subjectShown, 'MF-RESTRICTED must not see MF-CASE-001').toBe(false);
  expect(f.sha256, 'MF-RESTRICTED must not retrieve MF-IMAGE-001').toBe('');
  await ctx.close();
});

for (const persona of everyone) {
  test(`DATA-02 ${persona}: denied MF-CASE-002 and MF-FILE-DENIED`, async ({ browser }, info) => {
    const ids = fixtureIds();
    const ctx = await personaContext(browser, persona, '/lightning/page/home');
    const c = await openCase(ctx, ids.case2, CASE2);
    const f = await fetchFile(ctx, ids.denied);
    record(info, { browserVersion: browser.version(), case: 'DATA-02', persona: label(persona), fixture: 'MF-CASE-002, MF-FILE-DENIED',
      observed: `case subject shown=${c.subjectShown}; denial text="${c.deniedMessage}"; file status=${f.status} type=${f.type} bytes returned=${f.sha256 !== ''}` });
    expect(c.subjectShown, `${label(persona)} must not see MF-CASE-002`).toBe(false);
    expect(f.sha256, `${label(persona)} must not retrieve MF-FILE-DENIED`).toBe('');
    await ctx.close();
  });
}
