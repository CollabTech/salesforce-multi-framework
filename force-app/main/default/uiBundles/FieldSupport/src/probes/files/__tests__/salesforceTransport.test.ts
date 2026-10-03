// @vitest-environment node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn<(path: string, init?: RequestInit) => Promise<Response>>();
const createRecordMock = vi.fn();
const uploadMock = vi.fn();

vi.mock('@salesforce/platform-sdk', () => ({ createDataSDK: async () => ({ fetch: fetchMock }) }));
vi.mock('@salesforce/ui-bundle/api', () => ({ createRecord: (...a: unknown[]) => createRecordMock(...a) }));
vi.mock('@salesforce/ui-bundle-template-feature-react-file-upload', () => ({
  upload: (...a: unknown[]) => uploadMock(...a),
}));

const { salesforceTransport } = await import('../lib/salesforceTransport');
const { NotFoundOrDeniedError, UploadFailedError, CancelledError } = await import('../lib/transport');

const CASE = '500' + '000000000001AAA';
const VERSION = '068' + '000000000001AAA';

beforeEach(() => {
  fetchMock.mockReset();
  createRecordMock.mockReset();
  uploadMock.mockReset();
});

describe('salesforceTransport wiring (SDK mocked; proves call shapes only)', () => {
  it('reads case Files through the SMF-10 Apex REST endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: true, files: [] }), { status: 200 }));
    await expect(salesforceTransport.listCaseFiles(CASE)).resolves.toEqual([]);
    expect(fetchMock.mock.calls[0][0]).toBe(`/services/apexrest/smf10/v1/cases/${CASE}/files`);
  });

  it('maps 404 to NotFoundOrDeniedError with the server message', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ success: false, message: 'Not found or no access.' }), { status: 404 }));
    await expect(salesforceTransport.fetchVersionData(VERSION)).rejects.toBeInstanceOf(NotFoundOrDeniedError);
    expect(fetchMock.mock.calls[0][0]).toBe(`/services/apexrest/smf10/v1/versions/${VERSION}/data`);
  });

  it('reports a missing Apex endpoint as NOT CONFIGURED, not as a denial', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify([{ errorCode: 'NOT_FOUND', message: 'Could not find a match for URL' }]), { status: 404 }));
    const { NotConfiguredError } = await import('../lib/transport');
    await expect(salesforceTransport.listCaseFiles(CASE)).rejects.toBeInstanceOf(NotConfiguredError);
  });

  it('refuses an Id that could inject into the path', async () => {
    await expect(salesforceTransport.listCaseFiles('../../sobjects')).rejects.toThrow(/not a valid Salesforce Id/);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uploads bytes with the official upload() API and no recordId', async () => {
    uploadMock.mockResolvedValue([{ fileName: 'a.png', size: 1, contentBodyId: '0BB000000000001AAA' }]);
    const id = await salesforceTransport.uploadBody(new File(['x'], 'a.png', { type: 'image/png' }));
    expect(id).toBe('0BB000000000001AAA');
    expect(uploadMock.mock.calls[0][0]).not.toHaveProperty('recordId');
  });

  it('surfaces the per-file error the upload() API swallows', async () => {
    uploadMock.mockImplementation(async (opts: { onProgress: (p: unknown) => void }) => {
      opts.onProgress({ fileName: 'a.png', status: 'error', progress: 0, error: 'Upload failed: 500' });
      return [{ fileName: 'a.png', size: 1, contentBodyId: '' }];
    });
    await expect(salesforceTransport.uploadBody(new File(['x'], 'a.png'))).rejects.toBeInstanceOf(UploadFailedError);
  });

  it('reports cancellation as CancelledError', async () => {
    const c = new AbortController();
    uploadMock.mockImplementation(async () => {
      c.abort();
      return [{ fileName: 'a.png', size: 1, contentBodyId: '' }];
    });
    await expect(salesforceTransport.uploadBody(new File(['x'], 'a.png'), { signal: c.signal })).rejects.toBeInstanceOf(CancelledError);
  });

  it('creates the ContentVersion linked to the case with the idempotency marker', async () => {
    createRecordMock.mockResolvedValue({ id: VERSION, fields: {} });
    await salesforceTransport.createVersion({ recordId: CASE, fileName: 'pump.png', contentBodyId: '0BB1', description: 'smf10:key=k' });
    expect(createRecordMock).toHaveBeenCalledWith('ContentVersion', {
      FirstPublishLocationId: CASE,
      Title: 'pump',
      PathOnClient: 'pump.png',
      ContentBodyId: '0BB1',
      Description: 'smf10:key=k',
    });
  });
});

describe('no public-link workaround in the probe source', () => {
  it('never creates ContentDistribution or uses public download URLs', () => {
    const dir = join(__dirname, '..', 'lib');
    for (const f of readdirSync(dir)) {
      const src = readFileSync(join(dir, f), 'utf8');
      expect(src, f).not.toMatch(/createRecord\(\s*['"]ContentDistribution/);
      expect(src, f).not.toMatch(/DistributionPublicUrl|ContentDownloadUrl|sfc\/p\//);
    }
  });
});
