// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { MOCK_IDS, createMockTransport } from '../lib/mockTransport';
import { CancelledError, NotFoundOrDeniedError } from '../lib/transport';
import { filesWithKey, newAttempt, runUpload, type Phase } from '../lib/uploadFlow';

const CASE = MOCK_IDS.visibleCase;
const png = (): File =>
  new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])], 'pump.png', { type: 'image/png' });

let n = 0;
const key = (): string => `key-${++n}`;

describe('SMF-10 upload flow against the localhost mock transport', () => {
  it('uploads, links to the case and verifies the read-back', async () => {
    const t = createMockTransport({ uploadDurationMs: 10 });
    const phases: Phase[] = [];
    const r = await runUpload(t, CASE, newAttempt(png(), key), { onPhase: p => phases.push(p) });
    expect(phases).toEqual(['checking', 'uploading', 'linking', 'verifying']);
    expect(r.linkedToCase).toBe(true);
    expect(r.filesWithKey).toBe(1);
    expect(r.sha256Local).toBe(r.sha256ReadBack);
    expect(r.reusedExisting).toBe(false);
  });

  it('retries after an upload failure without a duplicate', async () => {
    const t = createMockTransport({ uploadDurationMs: 10, faults: ['upload-fail-once'] });
    const a = newAttempt(png(), key);
    await expect(runUpload(t, CASE, a)).rejects.toThrow(/injected mock fault/);
    const r = await runUpload(t, CASE, a);
    expect(r.filesWithKey).toBe(1);
    expect(filesWithKey(await t.listCaseFiles(CASE), a.key)).toHaveLength(1);
    expect(a.tries).toBe(2);
  });

  it('reuses the uploaded body when only the link step failed', async () => {
    const t = createMockTransport({ uploadDurationMs: 10, faults: ['link-fail-once'] });
    const a = newAttempt(png(), key);
    await expect(runUpload(t, CASE, a)).rejects.toThrow(/nothing committed/);
    expect(a.contentBodyId).toBeTruthy();
    await runUpload(t, CASE, a);
    expect(t.calls.uploadBody).toBe(1);
    expect(t.calls.createVersion).toBe(2);
    expect(filesWithKey(await t.listCaseFiles(CASE), a.key)).toHaveLength(1);
  });

  it('treats a lost response after commit as success, not as a reason to write again', async () => {
    const t = createMockTransport({ uploadDurationMs: 10, faults: ['link-lost-once'] });
    const a = newAttempt(png(), key);
    const r = await runUpload(t, CASE, a);
    expect(r.filesWithKey).toBe(1);
    expect(t.calls.createVersion).toBe(1);
    // A further retry of the same attempt finds it and writes nothing.
    const again = await runUpload(t, CASE, a);
    expect(again.reusedExisting).toBe(true);
    expect(t.calls.createVersion).toBe(1);
  });

  it('cancels mid-upload and can then be retried once', async () => {
    const t = createMockTransport({ uploadDurationMs: 200 });
    const a = newAttempt(png(), key);
    const c = new AbortController();
    const run = runUpload(t, CASE, a, {}, c.signal);
    setTimeout(() => c.abort(), 50);
    await expect(run).rejects.toBeInstanceOf(CancelledError);
    expect(t.versions().filter(v => v.linkedEntityId === CASE)).toHaveLength(0);
    const r = await runUpload(t, CASE, a);
    expect(r.filesWithKey).toBe(1);
  });

  it('a new selection of the same file is a separate, intended upload', async () => {
    const t = createMockTransport({ uploadDurationMs: 10 });
    await runUpload(t, CASE, newAttempt(png(), key));
    await runUpload(t, CASE, newAttempt(png(), key));
    expect((await t.listCaseFiles(CASE)).length).toBe(2);
  });

  it('denies the negative-control case and File', async () => {
    const t = createMockTransport();
    await expect(t.listCaseFiles(MOCK_IDS.deniedCase)).rejects.toBeInstanceOf(NotFoundOrDeniedError);
    await expect(t.fetchVersionData(MOCK_IDS.deniedVersion)).rejects.toBeInstanceOf(NotFoundOrDeniedError);
  });
});
