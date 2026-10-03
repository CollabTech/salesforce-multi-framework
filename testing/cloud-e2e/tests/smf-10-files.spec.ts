import { test, expect, type Frame, type Page } from '@playwright/test';
import { personaContext, type Persona } from './persona';
import { record } from './record';
import { fixtureFile, fixtureRecordId, latestVersionIds, openProbe, publicLinkCount } from './files-markup-helpers';

// SMF-10 FILE-01..03 (and the desktop half of FILE-04) as real personas in ENV-DESKTOP-EDGE /
// ENV-CLOUD-CHROMIUM. Automation attests: UI states, server read-back, hashes, denials,
// public-link count. It cannot attest: physical Salesforce mobile pickers/camera, HEIC
// handling on iOS, reauthentication prompts on devices — those are HUMAN-ACTIONS (FILE-04).

const PROBE_LINK = /SMF-10 · Case image in Salesforce Files/;
const HEADING = /Case image in Salesforce Files/;

test.describe.configure({ mode: 'serial' });

async function probeAs(browser: import('@playwright/test').Browser, persona: Persona) {
  const ctx = await personaContext(browser, persona);
  const { page, app } = await openProbe(ctx, PROBE_LINK, HEADING);
  return { ctx, page, app };
}

async function setCase(app: Page | Frame, id: string): Promise<void> {
  await app.getByLabel('Case record Id').fill(id);
}

async function evidenceBlock(app: Page | Frame): Promise<string> {
  return app.getByTestId('evidence').innerText();
}

let techSha = '';

test('FILE-01 TECH uploads MF-IMAGE-001 to MF-CASE-001; SUPPORT reads it from a fresh session', async ({ browser }, info) => {
  const caseId = fixtureRecordId('MF-CASE-001');
  const image = fixtureFile('MF-IMAGE-001', /\.(png|jpe?g)$/i);
  if (!caseId || !image) {
    record(info, { case: 'FILE-01', outcome: 'BLOCKED', reason: `missing ${!caseId ? 'MF-CASE-001 mapping' : 'MF-IMAGE-001 asset'} (SMF-3)` });
    test.skip(true, 'SMF-3 fixture missing');
    return;
  }
  const tech = await probeAs(browser, 'tech');
  await setCase(tech.app, caseId);
  await tech.app.getByTestId('file-input').setInputFiles(image);
  await expect(tech.app.getByTestId('local-preview')).toContainText('NOT persisted');
  await expect(tech.app.getByTestId('persisted')).toHaveCount(0);
  await tech.app.getByTestId('upload').click();
  await expect(tech.app.getByTestId('persisted')).toBeVisible({ timeout: 90_000 });
  await expect(tech.app.getByTestId('linked')).toHaveText('true');
  await expect(tech.app.getByTestId('key-count')).toHaveText('1');
  await expect(tech.app.getByTestId('hash-match')).toHaveText('true');
  const techBlock = await evidenceBlock(tech.app);
  techSha = /sha256: ([0-9a-f]{12})/.exec(techBlock)?.[1] ?? '';
  record(info, { case: 'FILE-01', persona: 'MF-TECH', browserVersion: browser.version(), observed: techBlock });
  await tech.ctx.close();

  const support = await probeAs(browser, 'support'); // new context = fresh session
  await setCase(support.app, caseId);
  await support.app.getByTestId('list').click();
  await expect(support.app.getByTestId('file-list')).toBeVisible({ timeout: 60_000 });
  await support.app.getByTestId('file-list').getByRole('button', { name: 'use' }).first().click();
  await support.app.getByTestId('retrieve').click();
  await expect(support.app.getByTestId('retrieve-ok')).toContainText(`SHA-256 ${techSha}`, { timeout: 60_000 });
  record(info, { case: 'FILE-01', persona: 'MF-SUPPORT', browserVersion: browser.version(), observed: await evidenceBlock(support.app) });
  await support.ctx.close();
});

test('FILE-02 RESTRICTED denied MF-IMAGE-001; TECH/SUPPORT denied MF-FILE-DENIED; no public link', async ({ browser }, info) => {
  const case1 = fixtureRecordId('MF-CASE-001');
  const case2 = fixtureRecordId('MF-CASE-002');
  if (!case1 || !case2) {
    record(info, { case: 'FILE-02', outcome: 'BLOCKED', reason: 'MF-CASE-001/002 mapping missing (SMF-3 private/fixtures.json)' });
    test.skip(true, 'SMF-3 fixture missing');
    return;
  }
  const imageVersion = latestVersionIds(case1)[0];
  const deniedVersion = latestVersionIds(case2)[0];
  expect(imageVersion, 'MF-CASE-001 must have a File (FILE-01 / SMF-3)').toBeTruthy();
  expect(deniedVersion, 'MF-CASE-002 must have MF-FILE-DENIED (SMF-3)').toBeTruthy();

  const attempts: Array<{ persona: Persona; caseId: string; versionId: string; label: string }> = [
    { persona: 'restricted', caseId: case1, versionId: imageVersion, label: 'MF-RESTRICTED → MF-CASE-001 / MF-IMAGE-001' },
    { persona: 'tech', caseId: case2, versionId: deniedVersion, label: 'MF-TECH → MF-CASE-002 / MF-FILE-DENIED' },
    { persona: 'support', caseId: case2, versionId: deniedVersion, label: 'MF-SUPPORT → MF-CASE-002 / MF-FILE-DENIED' },
  ];
  for (const a of attempts) {
    const s = await probeAs(browser, a.persona);
    await setCase(s.app, a.caseId);
    await s.app.getByTestId('list').click();
    await expect(s.app.getByTestId('list-denied')).toBeVisible({ timeout: 60_000 });
    await s.app.getByLabel('ContentVersion Id to retrieve').fill(a.versionId);
    await s.app.getByTestId('retrieve').click();
    await expect(s.app.getByTestId('retrieve-denied')).toBeVisible({ timeout: 60_000 });
    await expect(s.app.getByTestId('retrieve-ok')).toHaveCount(0);
    record(info, { case: 'FILE-02', persona: `MF-${a.persona.toUpperCase()}`, browserVersion: browser.version(), observed: `${a.label}: list DENIED, retrieve DENIED` });
    await s.ctx.close();
  }
  const links = publicLinkCount(case1) + publicLinkCount(case2);
  expect(links, 'no ContentDistribution on MF-CASE-001/002 Files').toBe(0);
  record(info, { case: 'FILE-02', persona: 'MF-ADMIN (setup query only)', observed: `ContentDistribution on case Files: ${links}` });
});

test('FILE-03 TECH: .txt and >5 MiB rejected; cancel, failure and retry leave one File per selection', async ({ browser }, info) => {
  const caseId = fixtureRecordId('MF-CASE-001');
  const image = fixtureFile('MF-IMAGE-001', /\.(png|jpe?g)$/i);
  const txt = fixtureFile('MF-UPLOAD-INVALID', /\.txt$/i);
  const big = fixtureFile('MF-UPLOAD-INVALID', /\.(png|jpe?g)$/i);
  if (!caseId || !image || !txt || !big) {
    record(info, { case: 'FILE-03', outcome: 'BLOCKED', reason: 'MF-CASE-001 mapping or MF-IMAGE-001 / MF-UPLOAD-INVALID assets missing (SMF-3)' });
    test.skip(true, 'SMF-3 fixture missing');
    return;
  }
  const before = latestVersionIds(caseId).length;
  const s = await probeAs(browser, 'tech');
  await setCase(s.app, caseId);
  await s.app.getByLabel(/Picker shows all file types/).check();
  await s.app.getByTestId('file-input').setInputFiles(txt);
  await expect(s.app.getByTestId('validation-error')).toContainText('type-not-allowed');
  await expect(s.app.getByTestId('upload')).toBeDisabled();
  await s.app.getByTestId('file-input').setInputFiles(big);
  await expect(s.app.getByTestId('validation-error')).toContainText('too-large');
  await expect(s.app.getByTestId('upload')).toBeDisabled();
  expect(latestVersionIds(caseId).length, 'nothing uploaded by rejected files').toBe(before);

  // Cancel: throttle the network (CDP; Chromium-family only) so the transfer is cancellable.
  const cdp = await s.page.context().newCDPSession(s.page);
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 200, downloadThroughput: 50_000, uploadThroughput: 20_000 });
  await s.app.getByTestId('file-input').setInputFiles(image);
  await s.app.getByTestId('upload').click();
  const phaseAtCancel = await s.app.getByTestId('phase').innerText();
  await s.app.getByTestId('cancel').click();
  await expect(s.app.getByTestId('phase')).toContainText('cancelled', { timeout: 60_000 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await s.app.getByTestId('upload').click();
  await expect(s.app.getByTestId('persisted')).toBeVisible({ timeout: 90_000 });
  await expect(s.app.getByTestId('key-count')).toHaveText('1');
  record(info, { case: 'FILE-03', persona: 'MF-TECH', browserVersion: browser.version(), observed: `cancel clicked during "${phaseAtCancel}"; retry persisted; files with key 1` });

  // Failure: go offline during the upload, then retry online.
  await s.app.getByTestId('file-input').setInputFiles(image); // new selection = new key
  await s.app.getByTestId('upload').click();
  await s.page.context().setOffline(true);
  await expect(s.app.getByTestId('phase')).toContainText('failed', { timeout: 60_000 });
  const failure = await s.app.getByTestId('upload-error').innerText();
  await s.page.context().setOffline(false);
  await s.app.getByTestId('upload').click();
  await expect(s.app.getByTestId('persisted')).toBeVisible({ timeout: 90_000 });
  await expect(s.app.getByTestId('key-count')).toHaveText('1');
  const after = latestVersionIds(caseId).length;
  record(info, { case: 'FILE-03', persona: 'MF-TECH', browserVersion: browser.version(),
    observed: `offline failure "${failure.slice(0, 120)}"; retry persisted; case Files ${before} → ${after} (expected +2, one per selection)` });
  expect(after - before, 'one File per selection, no duplicates from retries').toBe(2);
  await s.ctx.close();
});
