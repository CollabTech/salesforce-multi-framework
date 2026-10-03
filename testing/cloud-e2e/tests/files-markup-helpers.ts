/**
 * Shared helpers for the SMF-10/11/12 cloud specs (files and markup track).
 * Record Ids are read from private/fixtures.json (SMF-3, git-ignored) or resolved with an
 * MF-ADMIN query on smf-dev (setup role only). They are typed into the probe UI and never
 * logged; record() redacts any Id that slips into an observation.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { BrowserContext, Frame, Page } from '@playwright/test';

export const ROOT = resolve(__dirname, '../../..');
const FIXTURE_DIR = process.env.SMF_FIXTURES_DIR ?? join(ROOT, 'testing', 'fixtures');
/** MF-CASE-001 subject as defined in SMF-3 (fallback lookup when the private map lacks it). */
const CASE_001_SUBJECT = 'Pump overheating — remote diagnosis';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function sf(args: string[]): any {
  const out = execFileSync('sf', [...args, '--json'], {
    encoding: 'utf8',
    env: { ...process.env, SF_DISABLE_TELEMETRY: 'true' },
  });
  return JSON.parse(out).result;
}

function adminQuery(soql: string): Array<Record<string, unknown>> {
  return sf(['data', 'query', '--query', soql, '--target-org', 'smf-dev']).records ?? [];
}

const ID = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;

/** Logical fixture → dev-org record Id, or null (caller records BLOCKED). */
export function fixtureRecordId(logical: 'MF-CASE-001' | 'MF-CASE-002'): string | null {
  const file = join(ROOT, 'private', 'fixtures.json');
  if (existsSync(file)) {
    const map = JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>;
    const v = map[logical];
    const id = typeof v === 'string' ? v : (v as Record<string, string> | undefined)?.dev;
    if (id && ID.test(id)) return id;
  }
  if (logical === 'MF-CASE-001') {
    const rows = adminQuery(`SELECT Id FROM Case WHERE Subject = '${CASE_001_SUBJECT}' ORDER BY CreatedDate LIMIT 1`);
    const id = rows[0]?.Id;
    if (typeof id === 'string') return id;
  }
  return null;
}

/** Latest ContentVersion Ids of Files linked to a record (MF-ADMIN query, setup only). */
export function latestVersionIds(recordId: string): string[] {
  return adminQuery(
    `SELECT Id FROM ContentVersion WHERE IsLatest = true AND ContentDocumentId IN ` +
      `(SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${recordId}') ORDER BY CreatedDate DESC LIMIT 20`
  ).map(r => String(r.Id));
}

/** Count of public links (ContentDistribution) on Files linked to a record (MF-ADMIN). */
export function publicLinkCount(recordId: string): number {
  const rows = adminQuery(
    `SELECT Id FROM ContentDistribution WHERE ContentDocumentId IN ` +
      `(SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = '${recordId}')`
  );
  return rows.length;
}

/** Path of an SMF-3 fixture asset whose file name starts with the logical Id. */
export function fixtureFile(logical: string, ext: RegExp): string | null {
  if (!existsSync(FIXTURE_DIR)) return null;
  const hit = readdirSync(FIXTURE_DIR).find(f => f.startsWith(logical) && ext.test(f));
  return hit ? join(FIXTURE_DIR, hit) : null;
}

/** Finds the frame that renders the Field Support app (Lightning may host it in an iframe). */
export async function appFrame(page: Page, marker = 'Launch check'): Promise<Page | Frame> {
  await page.waitForLoadState('networkidle', { timeout: 60_000 }).catch(() => undefined);
  for (let i = 0; i < 30; i++) {
    for (const f of page.frames()) {
      if (await f.getByRole('heading', { name: marker }).count()) return f;
    }
    await page.waitForTimeout(1_000);
  }
  return page;
}

/** Opens a probe from the app's Probes page inside the persona context. */
export async function openProbe(ctx: BrowserContext, linkText: RegExp, heading: RegExp): Promise<{ page: Page; app: Page | Frame }> {
  const page = ctx.pages()[0];
  const launch = await appFrame(page);
  await launch.getByRole('link', { name: 'Capability probes' }).first().click();
  await launch.getByRole('link', { name: linkText }).first().click();
  for (let i = 0; i < 30; i++) {
    for (const f of page.frames()) {
      if (await f.getByRole('heading', { name: heading }).count()) return { page, app: f };
    }
    await page.waitForTimeout(1_000);
  }
  throw new Error(`probe heading ${heading} not found`);
}
