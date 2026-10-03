/**
 * Salesforce MarkupApi: bytes through the official upload() API (via the SMF-10
 * transport), revision commit through the SMF-11 Apex REST endpoint, which locks the Case
 * row, rejects stale bases (409) and is idempotent by save key. Runs as the signed-in user.
 */
import { createDataSDK } from '@salesforce/platform-sdk';
import { NotConfiguredError, NotFoundOrDeniedError, isSalesforceId, platformErrorCode, salesforceTransport, type FilesTransport } from '../../files/lib';
import { EXPORT_TITLE, MarkupConflictError, SNAPSHOT_TITLE, type MarkupApi, type MarkupRevision, type SaveInput, type SaveResult } from './markupApi';

const BASE = '/services/apexrest/smf11/v1/cases';

interface ApexResponse {
  success: boolean;
  message?: string;
  revision?: MarkupRevision | null;
}

function isApexResponse(v: unknown): v is ApexResponse {
  return !!v && typeof v === 'object' && 'success' in v;
}

async function apex(path: string, init?: RequestInit): Promise<{ status: number; body: ApexResponse }> {
  const sdk = await createDataSDK();
  if (!sdk.fetch) throw new Error('The Salesforce data SDK has no fetch on this surface.');
  const res = await sdk.fetch(path, { ...init, headers: { 'Content-Type': 'application/json', Accept: 'application/json' } });
  const body: unknown = await res.json().catch(() => ({ success: false, message: `${res.status} ${res.statusText}` }));
  const code = platformErrorCode(body);
  if (code) throw new NotConfiguredError(code, res.status);
  if (!isApexResponse(body)) throw new Error('Unexpected markup response shape.');
  return { status: res.status, body };
}

export function createSalesforceMarkupApi(transport: FilesTransport = salesforceTransport): MarkupApi {
  // Bodies already uploaded per save key: a retry after a failed commit does not re-upload.
  const bodies = new Map<string, { snapshot?: string; export?: string }>();
  return {
    kind: 'salesforce',

    async latest(caseId: string): Promise<MarkupRevision | null> {
      if (!isSalesforceId(caseId)) throw new Error('Case Id is not a valid Salesforce Id.');
      const { status, body } = await apex(`${BASE}/${caseId}/markup`);
      if (status === 404) throw new NotFoundOrDeniedError(body.message);
      if (status !== 200) throw new Error(body.message ?? `HTTP ${status}`);
      return body.revision ?? null;
    },

    async save(input: SaveInput): Promise<SaveResult> {
      if (!isSalesforceId(input.caseId)) throw new Error('Case Id is not a valid Salesforce Id.');
      const cached = bodies.get(input.saveKey) ?? {};
      bodies.set(input.saveKey, cached);
      cached.snapshot ??= await transport.uploadBody(
        new File([input.snapshotJson], `${SNAPSHOT_TITLE.replace(/ /g, '-')}.json`, { type: 'application/json' })
      );
      cached.export ??= await transport.uploadBody(new File([input.exportPng], `${EXPORT_TITLE.replace(/ /g, '-')}.png`, { type: 'image/png' }));
      const { status, body } = await apex(`${BASE}/${input.caseId}/markup`, {
        method: 'POST',
        body: JSON.stringify({
          baseSnapshotVersionId: input.baseSnapshotVersionId,
          saveKey: input.saveKey,
          imageVersionId: input.imageVersionId,
          snapshotBodyId: cached.snapshot,
          exportBodyId: cached.export,
        }),
      });
      if (status === 409) throw new MarkupConflictError(body.revision ?? null, body.message);
      if (status === 404) throw new NotFoundOrDeniedError(body.message);
      if ((status !== 200 && status !== 201) || !body.revision) throw new Error(body.message ?? `Save failed: HTTP ${status}`);
      bodies.delete(input.saveKey);
      return { revision: body.revision, reused: status === 200 };
    },
  };
}
