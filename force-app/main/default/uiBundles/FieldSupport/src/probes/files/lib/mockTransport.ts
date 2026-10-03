/**
 * In-memory FilesTransport for ENV-EMULATION-LOCALHOST runs only. It models just enough
 * of Salesforce (bodies, versions, case links, per-case visibility) to exercise the
 * SMF-10 state machine: cancel, failure, ambiguous failure, retry and duplicate checks.
 * Nothing it returns is evidence about Salesforce behaviour.
 */
import { sameId } from './ids';
import {
  CancelledError,
  NotFoundOrDeniedError,
  UploadFailedError,
  type CaseFileInfo,
  type CreateVersionInput,
  type FilesTransport,
  type UploadBodyOptions,
} from './transport';

/** Obviously synthetic Ids (contain "MOCK"); never real record Ids. */
export const MOCK_IDS = {
  visibleCase: '500' + 'MOCKCASE0001AAA',
  deniedCase: '500' + 'MOCKCASE0002AAA',
  deniedVersion: '068' + 'MOCKFILE0002AAA',
} as const;

export type MockFault = 'upload-fail-once' | 'link-fail-once' | 'link-lost-once';

/** Serializable copy of one stored version (lets a test reopen in a fresh page). */
export interface MockSeedEntry {
  info: CaseFileInfo;
  base64: string;
  type: string;
}

export interface MockOptions {
  faults?: MockFault[];
  uploadDurationMs?: number;
  /** Versions to preload (from exportState() of another page). */
  seed?: MockSeedEntry[];
}

interface StoredVersion {
  info: CaseFileInfo;
  blob: Blob;
}

// Random start so Ids minted in a fresh page never collide with seeded ones.
let counter = Math.floor(Math.random() * 9e7);
const nextId = (prefix: string): string => `${prefix}MOCK${String(++counter).padStart(8, '0')}AAA`;

export interface MockTransport extends FilesTransport {
  readonly faults: Set<MockFault>;
  readonly calls: { uploadBody: number; createVersion: number };
  versions(): CaseFileInfo[];
  /** Serializes every stored version (bytes as base64) for seeding a fresh page. */
  exportState(): Promise<MockSeedEntry[]>;
}

function toBase64(bytes: Uint8Array): string {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function fromBase64(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function createMockTransport(options: MockOptions = {}): MockTransport {
  const faults = new Set<MockFault>(options.faults ?? []);
  const duration = options.uploadDurationMs ?? 1200;
  const bodies = new Map<string, Blob & { name?: string }>();
  const versions = new Map<string, StoredVersion>();
  const calls = { uploadBody: 0, createVersion: 0 };

  // Negative-control File linked only to the denied case.
  versions.set(MOCK_IDS.deniedVersion, {
    blob: new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }),
    info: {
      contentDocumentId: '069' + 'MOCKFILE0002AAA',
      latestVersionId: MOCK_IDS.deniedVersion,
      linkedEntityId: MOCK_IDS.deniedCase,
      title: 'MF-FILE-DENIED (mock)',
      fileExtension: 'png',
      fileType: 'PNG',
      contentSize: 4,
      versionNumber: '1',
      description: null,
      reasonForChange: null,
      checksum: null,
      createdDate: new Date(0).toISOString(),
      shareType: 'V',
      visibility: 'AllUsers',
      publicLinkCount: 0,
    },
  });

  for (const entry of options.seed ?? []) {
    versions.set(entry.info.latestVersionId, {
      info: entry.info,
      blob: new Blob([fromBase64(entry.base64) as BlobPart], { type: entry.type }),
    });
  }

  const visible = (recordId: string): boolean => sameId(recordId, MOCK_IDS.visibleCase);

  return {
    kind: 'mock',
    faults,
    calls,
    versions: () => [...versions.values()].map(v => v.info),
    exportState: async () =>
      Promise.all(
        [...versions.values()].map(async v => ({
          info: v.info,
          type: v.blob.type,
          base64: toBase64(new Uint8Array(await v.blob.arrayBuffer())),
        }))
      ),

    async listCaseFiles(recordId: string): Promise<CaseFileInfo[]> {
      if (!visible(recordId)) throw new NotFoundOrDeniedError();
      return [...versions.values()]
        .filter(v => sameId(v.info.linkedEntityId, recordId))
        .map(v => ({ ...v.info }))
        .reverse();
    },

    uploadBody(file: File, opts: UploadBodyOptions = {}): Promise<string> {
      calls.uploadBody += 1;
      return new Promise<string>((resolve, reject) => {
        if (opts.signal?.aborted) {
          reject(new CancelledError());
          return;
        }
        const steps = 10;
        let step = 0;
        const timer = setInterval(() => {
          step += 1;
          opts.onProgress?.(Math.round((step / steps) * 100));
          if (step === steps / 2 && faults.delete('upload-fail-once')) {
            clearInterval(timer);
            reject(new UploadFailedError('Upload failed: 503 Service Unavailable (injected mock fault)'));
            return;
          }
          if (step >= steps) {
            clearInterval(timer);
            const id = nextId('0BB');
            bodies.set(id, file);
            resolve(id);
          }
        }, duration / steps);
        opts.signal?.addEventListener('abort', () => {
          clearInterval(timer);
          reject(new CancelledError());
        });
      });
    },

    async createVersion(input: CreateVersionInput): Promise<string> {
      calls.createVersion += 1;
      if (faults.delete('link-fail-once')) {
        throw new Error('ContentVersion create failed: 500 (injected mock fault, nothing committed)');
      }
      const body = bodies.get(input.contentBodyId);
      if (!body) throw new Error('Unknown ContentBody Id.');
      if (!visible(input.recordId)) throw new NotFoundOrDeniedError();
      const versionId = nextId('068');
      const dot = input.fileName.lastIndexOf('.');
      versions.set(versionId, {
        blob: body,
        info: {
          contentDocumentId: nextId('069'),
          latestVersionId: versionId,
          linkedEntityId: input.recordId,
          title: dot > 0 ? input.fileName.slice(0, dot) : input.fileName,
          fileExtension: dot > 0 ? input.fileName.slice(dot + 1).toLowerCase() : null,
          fileType: null,
          contentSize: body.size,
          versionNumber: '1',
          description: input.description ?? null,
          reasonForChange: null,
          checksum: null,
          createdDate: new Date().toISOString(),
          shareType: 'V',
          visibility: 'AllUsers',
          publicLinkCount: 0,
        },
      });
      if (faults.delete('link-lost-once')) {
        // The write committed but the response never reached the client.
        throw new Error('Network error: response lost after ContentVersion create (injected mock fault)');
      }
      return versionId;
    },

    async fetchVersionData(versionId: string): Promise<Blob> {
      const stored = versions.get(versionId);
      if (!stored || !visible(stored.info.linkedEntityId ?? '')) throw new NotFoundOrDeniedError();
      return stored.blob;
    },
  };
}
