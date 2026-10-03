// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { IMAGE_UPLOAD_POLICY, MIB, validateFile } from '../lib/policy';
import { isSalesforceId, maskId, sameId } from '../lib/ids';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];

function fileOf(name: string, type: string, head: number[], size = 64): File {
  const bytes = new Uint8Array(size);
  bytes.set(head.slice(0, size));
  return new File([bytes], name, { type });
}

describe('SMF-10 upload policy (MF-UPLOAD-INVALID contract)', () => {
  it('is fixed at image-only, 5 MiB', () => {
    expect(IMAGE_UPLOAD_POLICY.maxBytes).toBe(5 * 1024 * 1024);
    expect(IMAGE_UPLOAD_POLICY.allowed.map(t => t.mime)).toEqual(['image/png', 'image/jpeg']);
  });

  it('accepts a PNG and a JPEG', async () => {
    expect((await validateFile(fileOf('pump.png', 'image/png', PNG_HEAD))).ok).toBe(true);
    expect((await validateFile(fileOf('pump.JPG', 'image/jpeg', JPEG_HEAD))).ok).toBe(true);
  });

  it('accepts an image of exactly 5 MiB and rejects 5 MiB + 1 byte', async () => {
    expect((await validateFile(fileOf('edge.png', 'image/png', PNG_HEAD, 5 * MIB))).ok).toBe(true);
    const over = await validateFile(fileOf('big.png', 'image/png', PNG_HEAD, 5 * MIB + 1));
    expect(over).toMatchObject({ ok: false, code: 'too-large' });
  });

  it('rejects a .txt file', async () => {
    const r = await validateFile(new File(['not an image'], 'notes.txt', { type: 'text/plain' }));
    expect(r).toMatchObject({ ok: false, code: 'type-not-allowed' });
  });

  it('rejects text renamed to .png (content mismatch)', async () => {
    const r = await validateFile(new File(['plain text body'], 'fake.png', { type: 'image/png' }));
    expect(r).toMatchObject({ ok: false, code: 'content-mismatch' });
  });

  it('rejects a MIME type that disagrees with the extension', async () => {
    const r = await validateFile(fileOf('pump.png', 'image/jpeg', PNG_HEAD));
    expect(r).toMatchObject({ ok: false, code: 'type-not-allowed' });
  });

  it('rejects an empty file', async () => {
    expect(await validateFile(new File([], 'empty.png', { type: 'image/png' }))).toMatchObject({ ok: false, code: 'empty' });
  });

  it('rejects an unsupported image type such as HEIC', async () => {
    const r = await validateFile(fileOf('IMG_0001.HEIC', 'image/heic', [0, 0, 0, 0x18]));
    expect(r).toMatchObject({ ok: false, code: 'type-not-allowed' });
  });
});

describe('transport selection guard', () => {
  it('only serves the mock on a localhost origin with ?transport=mock', async () => {
    const { selectFilesTransport } = await import('../lib/selectTransport');
    const fakeWindow = (hostname: string, search: string): Window =>
      ({ location: { hostname, search } }) as unknown as Window;
    expect(selectFilesTransport(fakeWindow('example.my.salesforce.com', '?transport=mock')).kind).toBe('salesforce');
    expect(selectFilesTransport(fakeWindow('localhost', '')).kind).toBe('salesforce');
    expect(selectFilesTransport(fakeWindow('localhost', '?transport=mock')).kind).toBe('mock');
  });
});

describe('Id helpers', () => {
  it('validates 15/18-character Ids only', () => {
    expect(isSalesforceId('500' + '000000000001')).toBe(true);
    expect(isSalesforceId('500' + '000000000001AAA')).toBe(true);
    expect(isSalesforceId("500' OR Id != '")).toBe(false);
    expect(isSalesforceId('5000000000000010')).toBe(false);
  });

  it('masks Ids to key prefix + last three characters', () => {
    expect(maskId('069' + '000000000123ABC')).toBe('069…ABC');
    expect(maskId('')).toBe('(none)');
  });

  it('compares 15- and 18-character forms', () => {
    expect(sameId('500' + '000000000001', '500' + '000000000001AAA')).toBe(true);
    expect(sameId('500' + '000000000001', '500' + '000000000002AAA')).toBe(false);
  });
});
