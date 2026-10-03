/**
 * SMF-14 model delivery (BUDGET-03). Models are Salesforce Files linked to MF-CASE-001 and are
 * fetched in the signed-in user's context, so access follows Files sharing. Two user-context
 * paths, both on the data-access skill's allowlist:
 *
 *  - 'smf10-apex'     SMF-10 Apex REST read API (with sharing + USER_MODE), reused unchanged via
 *                     the SMF-10 transport. Apex holds VersionData on its heap (6 MB synchronous
 *                     limit), so this path has a size ceiling below that.
 *  - 'connect-content' Connect REST file content (/connect/files/{documentId}/content) through
 *                     sdk.fetch; streamed by the platform, no Apex heap.
 *
 * The bundled app asset (SMF-13) is listed separately as a NON-access-checked path.
 */
import { createDataSDK } from '@salesforce/platform-sdk';
import { NotFoundOrDeniedError, isSalesforceId, salesforceTransport, type CaseFileInfo } from '../files/lib';
import { acceptModelBytes, ModelLoadError, type FetchedModel } from '../smf-13-3d/engine/sources';

export type DeliveryPath = 'smf10-apex' | 'connect-content';

export const DELIVERY_PATHS: { id: DeliveryPath; label: string; needs: 'version' | 'document' }[] = [
  { id: 'smf10-apex', label: 'SMF-10 Apex REST (user context, with sharing)', needs: 'version' },
  { id: 'connect-content', label: 'Connect REST file content (user context)', needs: 'document' },
];

declare const __SF_API_VERSION__: string;
const FALLBACK_API_VERSION = typeof __SF_API_VERSION__ !== 'undefined' ? __SF_API_VERSION__ : '65.0';

export interface ModelFileRef {
  title: string;
  contentDocumentId: string;
  latestVersionId: string;
  contentSize: number;
  fileExtension: string | null;
}

/** Model Files (title MF-MODEL-*, .glb) linked to a case, listed as the current user. */
export async function listCaseModels(caseId: string): Promise<ModelFileRef[]> {
  const files: CaseFileInfo[] = await salesforceTransport.listCaseFiles(caseId);
  return files
    .filter(f => f.title.startsWith('MF-MODEL-') && (f.fileExtension ?? '').toLowerCase() === 'glb')
    .map(f => ({ title: f.title, contentDocumentId: f.contentDocumentId, latestVersionId: f.latestVersionId, contentSize: f.contentSize, fileExtension: f.fileExtension }))
    .sort((a, b) => a.contentSize - b.contentSize);
}

export function connectContentPath(apiVersion: string, documentId: string): string {
  if (!isSalesforceId(documentId)) throw new ModelLoadError('invalid', 'ContentDocument Id is not a valid Salesforce Id');
  return `/services/data/v${apiVersion}/connect/files/${documentId}/content`;
}

/**
 * Fetches model bytes over one delivery path as the current user. `id` is the ContentVersion Id
 * for 'smf10-apex' and the ContentDocument Id for 'connect-content'. Denied and missing are
 * indistinguishable to the caller by design (both 403/404).
 */
export async function fetchModelFile(path: DeliveryPath, id: string): Promise<FetchedModel> {
  if (!isSalesforceId(id)) throw new ModelLoadError('invalid', 'not a valid Salesforce Id');
  const requestStart = performance.now();
  let blob: Blob;
  let status = 200;
  let contentType: string | null = null;
  try {
    if (path === 'smf10-apex') {
      blob = await salesforceTransport.fetchVersionData(id);
      contentType = blob.type || null;
    } else {
      const sdk = await createDataSDK();
      if (!sdk.fetch) throw new ModelLoadError('network', 'the data SDK has no fetch on this surface');
      const res = await sdk.fetch(connectContentPath(sdk.apiVersion ?? FALLBACK_API_VERSION, id));
      status = res.status;
      contentType = res.headers.get('content-type');
      if (!res.ok) {
        throw new ModelLoadError(res.status === 403 || res.status === 404 ? 'denied' : 'network', `HTTP ${res.status} from Connect file content`, res.status);
      }
      blob = await res.blob();
    }
  } catch (e) {
    if (e instanceof ModelLoadError) throw e;
    if (e instanceof NotFoundOrDeniedError) throw new ModelLoadError('denied', `not found or no access (HTTP ${e.status})`, e.status);
    throw new ModelLoadError('network', e instanceof Error ? e.message : String(e));
  }
  const bytes = await blob.arrayBuffer();
  return acceptModelBytes(bytes, { requestStart, bytesReceivedAt: performance.now(), status, contentType });
}

/** Expected outcome of a denial attempt: no bytes, a 403/404-class refusal. */
export function isDenial(e: unknown): boolean {
  return e instanceof ModelLoadError && (e.kind === 'denied' || e.kind === 'missing');
}
