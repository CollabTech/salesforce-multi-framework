/**
 * Salesforce implementation of FilesTransport.
 *
 * Writes use the official feature package (experience-ui-bundle-file-upload-generate):
 * upload() for the bytes (Pattern A, no hand-built FormData/XHR) and the same UI API
 * createRecord('ContentVersion') call its createContentVersion() makes, plus one standard
 * field (Description) that carries the SMF-10 idempotency marker. FirstPublishLocationId
 * makes Salesforce create the ContentDocumentLink to the case. No ContentDistribution
 * (public link) is ever created.
 *
 * Reads go through the SMF-10 Apex REST endpoint via sdk.fetch, which runs as the
 * signed-in user (with sharing + USER_MODE), so a denial here is a real access denial.
 */
import { createDataSDK } from '@salesforce/platform-sdk';
import { createRecord } from '@salesforce/ui-bundle/api';
import { upload, type FileUploadProgress } from '@salesforce/ui-bundle-template-feature-react-file-upload';
import { isSalesforceId } from './ids';
import {
  CancelledError,
  NotConfiguredError,
  NotFoundOrDeniedError,
  UploadFailedError,
  type CaseFileInfo,
  type CreateVersionInput,
  type FilesTransport,
  type UploadBodyOptions,
} from './transport';

const APEX_BASE = '/services/apexrest/smf10/v1';

async function sfFetch(path: string, init?: RequestInit): Promise<Response> {
  const sdk = await createDataSDK();
  if (!sdk.fetch) {
    throw new Error('The Salesforce data SDK has no fetch on this surface.');
  }
  return sdk.fetch(path, init);
}

function requireId(value: string, label: string): string {
  if (!isSalesforceId(value)) throw new Error(`${label} is not a valid Salesforce Id.`);
  return value;
}

/** Salesforce platform errors are a JSON array of {errorCode, message}; probe errors are an object. */
export function platformErrorCode(body: unknown): string | null {
  if (Array.isArray(body) && body[0] && typeof body[0] === 'object' && 'errorCode' in body[0]) {
    return String((body[0] as { errorCode: unknown }).errorCode);
  }
  return null;
}

async function errorFrom(res: Response): Promise<Error> {
  let message = `${res.status} ${res.statusText}`;
  try {
    const body: unknown = await res.json();
    const code = platformErrorCode(body);
    if (code && [403, 404].includes(res.status)) return new NotConfiguredError(code, res.status);
    if (body && typeof body === 'object' && 'message' in body && typeof body.message === 'string') {
      message = body.message;
    }
  } catch {
    // non-JSON error body: keep the status line
  }
  if (res.status === 404 || res.status === 403) return new NotFoundOrDeniedError(message, res.status);
  return new Error(message);
}

function isFileInfoList(value: unknown): value is { files: CaseFileInfo[] } {
  return (
    !!value && typeof value === 'object' && 'files' in value && Array.isArray((value as { files: unknown }).files)
  );
}

function titleOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return dot > 0 ? fileName.slice(0, dot) : fileName;
}

export const salesforceTransport: FilesTransport = {
  kind: 'salesforce',

  async listCaseFiles(recordId: string): Promise<CaseFileInfo[]> {
    const id = requireId(recordId, 'Record Id');
    const res = await sfFetch(`${APEX_BASE}/cases/${id}/files`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw await errorFrom(res);
    const body: unknown = await res.json();
    if (!isFileInfoList(body)) throw new Error('Unexpected read-back response shape.');
    return body.files;
  },

  async uploadBody(file: File, options: UploadBodyOptions = {}): Promise<string> {
    let lastError: string | undefined;
    const results = await upload({
      files: [file],
      signal: options.signal,
      onProgress: (p: FileUploadProgress) => {
        if (p.status === 'uploading') options.onProgress?.(p.progress);
        if (p.status === 'error') lastError = p.error;
      },
    });
    const bodyId = results[0]?.contentBodyId;
    if (options.signal?.aborted) throw new CancelledError();
    if (!bodyId) throw new UploadFailedError(lastError ?? 'Upload failed.');
    return bodyId;
  },

  async createVersion(input: CreateVersionInput): Promise<string> {
    const response = await createRecord('ContentVersion', {
      FirstPublishLocationId: requireId(input.recordId, 'Record Id'),
      Title: titleOf(input.fileName),
      PathOnClient: input.fileName,
      ContentBodyId: input.contentBodyId,
      ...(input.description ? { Description: input.description } : {}),
    });
    const id = (response as { id?: string }).id ?? response.fields?.Id?.value;
    if (!id) throw new Error('ContentVersion create returned no Id.');
    return id;
  },

  async fetchVersionData(versionId: string, signal?: AbortSignal): Promise<Blob> {
    const id = requireId(versionId, 'ContentVersion Id');
    const res = await sfFetch(`${APEX_BASE}/versions/${id}/data`, { signal });
    if (!res.ok) throw await errorFrom(res);
    return res.blob();
  },
};
