// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MOCK_IDS, createMockTransport } from '../../files/lib';
import { createFilesMarkupApi } from '../lib/filesMarkupApi';
import { MarkupConflictError, exportMeta, latestFromFiles, parseMeta, snapshotMeta } from '../lib/markupApi';
import { licenseStatus } from '../lib/license';
import { assertPortable } from '../lib/document';

const CASE = MOCK_IDS.visibleCase;

async function seedImage() {
  const t = createMockTransport({ uploadDurationMs: 5 });
  const body = await t.uploadBody(new File([new Uint8Array([137, 80, 78, 71])], 'img.png', { type: 'image/png' }));
  const imageVersionId = await t.createVersion({ recordId: CASE, fileName: 'MF-IMAGE-001.png', contentBodyId: body });
  return { t, imageVersionId };
}

const input = (imageVersionId: string, base: string | null, saveKey: string) => ({
  caseId: CASE,
  baseSnapshotVersionId: base,
  saveKey,
  imageVersionId,
  snapshotJson: '{}',
  exportPng: new Blob([new Uint8Array([1])], { type: 'image/png' }),
});

describe('SMF-11 revision metadata', () => {
  it('round-trips snapshot and export descriptions', () => {
    expect(parseMeta(snapshotMeta(3, 'k', 'img', null))).toEqual({ kind: 'snapshot', rev: '3', save: 'k', image: 'img', base: 'none' });
    expect(parseMeta(exportMeta(3, 'k', 'snap'))).toMatchObject({ kind: 'export', snapshot: 'snap' });
    expect(parseMeta('free text')).toEqual({});
  });
});

describe('SMF-11 revision rules (mock MarkupApi; mirrors the Apex service)', () => {
  it('first save is r1 with export associated to its snapshot', async () => {
    const { t, imageVersionId } = await seedImage();
    const api = createFilesMarkupApi(t);
    const { revision } = await api.save(input(imageVersionId, null, 'key-1'));
    expect(revision.rev).toBe(1);
    const latest = latestFromFiles(await t.listCaseFiles(CASE));
    expect(latest?.exportVersionId).toBe(revision.exportVersionId);
    const exportFile = (await t.listCaseFiles(CASE)).find(f => f.latestVersionId === revision.exportVersionId);
    expect(parseMeta(exportFile?.description).snapshot).toBe(revision.snapshotVersionId);
  });

  it('a stale base is a conflict and writes nothing', async () => {
    const { t, imageVersionId } = await seedImage();
    const api = createFilesMarkupApi(t);
    const r1 = (await api.save(input(imageVersionId, null, 'key-1'))).revision;
    await api.save(input(imageVersionId, r1.snapshotVersionId, 'key-2'));
    const before = (await t.listCaseFiles(CASE)).length;
    await expect(api.save(input(imageVersionId, r1.snapshotVersionId, 'key-3'))).rejects.toBeInstanceOf(MarkupConflictError);
    expect((await t.listCaseFiles(CASE)).length).toBe(before);
  });

  it('retrying a committed save key reuses it', async () => {
    const { t, imageVersionId } = await seedImage();
    const api = createFilesMarkupApi(t);
    await api.save(input(imageVersionId, null, 'key-1'));
    const again = await api.save(input(imageVersionId, null, 'key-1'));
    expect(again.reused).toBe(true);
  });

  it('refuses an image that is not linked to the case', async () => {
    const { t } = await seedImage();
    await expect(createFilesMarkupApi(t).save(input(MOCK_IDS.deniedVersion, null, 'key-1'))).rejects.toThrow(/not linked/);
  });
});

describe('tldraw license gate (AC5)', () => {
  it('is not required on localhost / http', () => {
    expect(licenseStatus({ protocol: 'http:', hostname: 'localhost' }, true, undefined).productionGate).toBe('not-required');
  });
  it('blocks production on a Salesforce HTTPS host without a key', () => {
    expect(licenseStatus({ protocol: 'https:', hostname: 'example.lightning.force.com' }, true, undefined).productionGate).toBe('BLOCKED-no-key');
    expect(licenseStatus({ protocol: 'https:', hostname: 'example.lightning.force.com' }, true, 'k').productionGate).toBe('key-present');
  });
});

describe('snapshot portability', () => {
  it('rejects inline or browser-local asset URLs', () => {
    expect(() => assertPortable('{"src":"data:image/png;base64,AAA"}')).toThrow();
    expect(() => assertPortable('{"src":"blob:http://x/y"}')).toThrow();
    expect(() => assertPortable('{"src":"asset:sfcv/068"}')).not.toThrow();
  });
});
