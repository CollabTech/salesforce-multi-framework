/**
 * SMF-10 upload state machine with idempotent retry.
 *
 * Idempotency approach (documented in docs/poc-briefs/SMF-10.md):
 *  - Each *selection* of a file gets a client-generated key (UUID). Retrying the same
 *    selection reuses the key; choosing a file again makes a new key (a deliberate
 *    second upload is not a duplicate).
 *  - The key is written to the new ContentVersion's Description as "smf10:key=<uuid>".
 *  - Before any write, and again after an ambiguous link failure, the flow reads the
 *    case's Files back as the user and looks for that marker. If it is there, the
 *    earlier attempt committed and the flow only verifies it — no second attachment.
 *  - A ContentBody already uploaded in a failed attempt is reused on retry, so a failed
 *    link step does not upload the bytes again.
 * Limitation: check-then-write is not atomic; two tabs retrying the same key at the same
 * instant could both write. A retry is user-initiated and sequential in this probe.
 */
import { sameId } from './ids';
import { CancelledError, type CaseFileInfo, type FilesTransport } from './transport';

export type Phase =
  | 'idle'
  | 'checking'
  | 'uploading'
  | 'linking'
  | 'verifying'
  | 'persisted'
  | 'failed'
  | 'cancelled';

export const KEY_PREFIX = 'smf10:key=';

export interface Attempt {
  key: string;
  file: File;
  contentBodyId?: string;
  tries: number;
}

export interface PersistedResult {
  file: CaseFileInfo;
  /** True when a previous attempt had already committed and nothing new was written. */
  reusedExisting: boolean;
  /** Files on the case carrying this attempt's key (1 = no duplicate). */
  filesWithKey: number;
  linkedToCase: boolean;
  bytesLocal: number;
  bytesReadBack: number;
  sha256Local: string;
  sha256ReadBack: string;
  readBackBlob: Blob;
}

export interface FlowCallbacks {
  onPhase?: (phase: Phase) => void;
  onProgress?: (percent: number) => void;
}

export function newAttempt(file: File, makeKey: () => string = () => crypto.randomUUID()): Attempt {
  return { key: makeKey(), file, tries: 0 };
}

export function markerFor(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

export function filesWithKey(files: CaseFileInfo[], key: string): CaseFileInfo[] {
  const marker = markerFor(key);
  return files.filter(f => (f.description ?? '').includes(marker));
}

export async function sha256Hex(blob: Blob): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new CancelledError();
}

async function verify(
  transport: FilesTransport,
  recordId: string,
  attempt: Attempt,
  reusedExisting: boolean,
  signal?: AbortSignal
): Promise<PersistedResult> {
  const files = await transport.listCaseFiles(recordId);
  const matches = filesWithKey(files, attempt.key);
  if (matches.length === 0) {
    throw new Error('Read-back did not find the uploaded File on the case.');
  }
  const file = matches[0];
  const readBackBlob = await transport.fetchVersionData(file.latestVersionId, signal);
  const [sha256Local, sha256ReadBack] = await Promise.all([sha256Hex(attempt.file), sha256Hex(readBackBlob)]);
  return {
    file,
    reusedExisting,
    filesWithKey: matches.length,
    linkedToCase: sameId(file.linkedEntityId, recordId),
    bytesLocal: attempt.file.size,
    bytesReadBack: readBackBlob.size,
    sha256Local,
    sha256ReadBack,
    readBackBlob,
  };
}

/**
 * Runs (or retries) one attempt. Throws CancelledError on cancel, other errors on
 * failure; the caller keeps the Attempt (with any contentBodyId) for a retry.
 */
export async function runUpload(
  transport: FilesTransport,
  recordId: string,
  attempt: Attempt,
  callbacks: FlowCallbacks = {},
  signal?: AbortSignal
): Promise<PersistedResult> {
  const { onPhase, onProgress } = callbacks;
  attempt.tries += 1;

  onPhase?.('checking');
  const existing = filesWithKey(await transport.listCaseFiles(recordId), attempt.key);
  throwIfCancelled(signal);
  if (existing.length > 0) {
    onPhase?.('verifying');
    return verify(transport, recordId, attempt, true, signal);
  }

  if (!attempt.contentBodyId) {
    onPhase?.('uploading');
    attempt.contentBodyId = await transport.uploadBody(attempt.file, { signal, onProgress });
  }
  throwIfCancelled(signal);

  onPhase?.('linking');
  try {
    await transport.createVersion({
      recordId,
      fileName: attempt.file.name,
      contentBodyId: attempt.contentBodyId,
      description: markerFor(attempt.key),
    });
  } catch (err) {
    // Ambiguous: the server may have committed before the error. Look before failing.
    const afterError = filesWithKey(await transport.listCaseFiles(recordId), attempt.key);
    if (afterError.length === 0) throw err;
  }

  onPhase?.('verifying');
  return verify(transport, recordId, attempt, false, signal);
}
