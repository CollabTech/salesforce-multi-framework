import { Buffer } from 'node:buffer';
import { test, expect, type Page } from '@playwright/test';

// ENV-EMULATION-LOCALHOST only (SMF-10). The built bundle served statically with the
// in-memory MOCK transport (?transport=mock, localhost only). This exercises the probe's
// validation, cancel/failure/retry state machine, duplicate prevention and the
// local-vs-persisted distinction. It is not Salesforce, persona or device evidence.
//
// File inputs are local stand-ins generated here, built to the SMF-3 MF-UPLOAD-INVALID
// specification (a .txt file and a >5 MiB image); they are not the SMF-3 fixture assets.

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64'
);
const validPng = { name: 'mf-image-standin.png', mimeType: 'image/png', buffer: PNG_1X1 };
const txt = { name: 'mf-upload-invalid.txt', mimeType: 'text/plain', buffer: Buffer.from('synthetic text, not an image') };
const bigPng = (() => {
  const b = Buffer.alloc(5 * 1024 * 1024 + 1);
  PNG_1X1.copy(b);
  return { name: 'mf-upload-invalid-big.png', mimeType: 'image/png', buffer: b };
})();

async function open(page: Page, query = ''): Promise<void> {
  await page.goto(`/probes/files?transport=mock${query}`);
  await expect(page.getByTestId('mock-banner')).toBeVisible();
}

async function mockFileCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const t = window.__SMF_MOCK_FILES__;
    if (!t) return -1;
    const files = await t.listCaseFiles('500' + 'MOCKCASE0001AAA');
    return files.length;
  });
}

test.describe('SMF-10 Files probe (localhost, mock transport)', () => {
  test('valid image: local preview is labelled not persisted, then persisted read-back is shown', async ({ page }) => {
    await open(page);
    await page.getByTestId('file-input').setInputFiles(validPng);
    await expect(page.getByTestId('local-preview')).toContainText('NOT persisted');
    await expect(page.getByTestId('persisted')).toHaveCount(0);
    await page.getByTestId('upload').click();
    await expect(page.getByTestId('persisted')).toBeVisible();
    await expect(page.getByTestId('linked')).toHaveText('true');
    await expect(page.getByTestId('key-count')).toHaveText('1');
    await expect(page.getByTestId('hash-match')).toHaveText('true');
    const evidence = await page.getByTestId('evidence').innerText();
    expect(evidence).toContain('transport: MOCK');
    expect(evidence).toMatch(/ContentDocument 069…AAA ContentVersion 068…AAA v1/);
    expect(evidence).not.toContain('500' + 'MOCKCASE0001AAA');
    expect(await mockFileCount(page)).toBe(1);
  });

  test('rejects .txt and a >5 MiB image cleanly, with nothing uploaded', async ({ page }) => {
    await open(page);
    await page.getByTestId('file-input').setInputFiles(txt);
    await expect(page.getByTestId('validation-error')).toContainText('type-not-allowed');
    await expect(page.getByTestId('upload')).toBeDisabled();
    await page.getByTestId('file-input').setInputFiles(bigPng);
    await expect(page.getByTestId('validation-error')).toContainText('too-large');
    await expect(page.getByTestId('validation-error')).toContainText('limit is 5.00 MiB');
    await expect(page.getByTestId('upload')).toBeDisabled();
    expect(await mockFileCount(page)).toBe(0);
  });

  test('cancel mid-upload, then retry once: one attachment', async ({ page }) => {
    await open(page);
    await page.getByTestId('file-input').setInputFiles(validPng);
    await page.getByTestId('upload').click();
    await expect(page.getByTestId('phase')).toContainText('uploading');
    await page.getByTestId('cancel').click();
    await expect(page.getByTestId('phase')).toContainText('cancelled');
    expect(await mockFileCount(page)).toBe(0);
    await page.getByTestId('upload').click();
    await expect(page.getByTestId('persisted')).toBeVisible();
    await expect(page.getByTestId('key-count')).toHaveText('1');
    expect(await mockFileCount(page)).toBe(1);
  });

  test('upload failure, then retry: one attachment', async ({ page }) => {
    await open(page, '&faults=upload-fail-once');
    await page.getByTestId('file-input').setInputFiles(validPng);
    await page.getByTestId('upload').click();
    await expect(page.getByTestId('upload-error')).toContainText('503');
    await expect(page.getByTestId('upload')).toHaveText('Retry upload');
    await page.getByTestId('upload').click();
    await expect(page.getByTestId('persisted')).toBeVisible();
    expect(await mockFileCount(page)).toBe(1);
  });

  test('link failure, then retry: body reused, one attachment', async ({ page }) => {
    await open(page, '&faults=link-fail-once');
    await page.getByTestId('file-input').setInputFiles(validPng);
    await page.getByTestId('upload').click();
    await expect(page.getByTestId('upload-error')).toContainText('nothing committed');
    await page.getByTestId('upload').click();
    await expect(page.getByTestId('persisted')).toBeVisible();
    const calls = await page.evaluate(() => window.__SMF_MOCK_FILES__?.calls);
    expect(calls).toEqual({ uploadBody: 1, createVersion: 2 });
    expect(await mockFileCount(page)).toBe(1);
  });

  test('response lost after commit: no second write', async ({ page }) => {
    await open(page, '&faults=link-lost-once');
    await page.getByTestId('file-input').setInputFiles(validPng);
    await page.getByTestId('upload').click();
    await expect(page.getByTestId('persisted')).toBeVisible();
    const calls = await page.evaluate(() => window.__SMF_MOCK_FILES__?.calls);
    expect(calls).toEqual({ uploadBody: 1, createVersion: 1 });
    expect(await mockFileCount(page)).toBe(1);
  });

  test('negative controls are denied (mock models the expected denial only)', async ({ page }) => {
    await open(page);
    await page.getByLabel('ContentVersion Id to retrieve').fill('068' + 'MOCKFILE0002AAA');
    await page.getByTestId('retrieve').click();
    await expect(page.getByTestId('retrieve-denied')).toContainText('Not found or no access');
    await page.getByLabel('Case record Id').fill('500' + 'MOCKCASE0002AAA');
    await page.getByTestId('list').click();
    await expect(page.getByTestId('list-denied')).toBeVisible();
  });
});
