/**
 * Transport contract for case-linked Salesforce Files (SMF-10). Two implementations:
 *  - salesforceTransport: official upload() feature + UI API createRecord for writes,
 *    SMF-10 Apex REST (user context) for read-back and retrieval.
 *  - mockTransport: in-memory, localhost-only, for exercising the state machine. Its
 *    results are never Salesforce evidence and the UI labels it as such.
 */
export interface CaseFileInfo {
  contentDocumentId: string;
  latestVersionId: string;
  linkedEntityId: string | null;
  title: string;
  fileExtension: string | null;
  fileType: string | null;
  contentSize: number;
  versionNumber: string;
  description: string | null;
  reasonForChange: string | null;
  checksum: string | null;
  createdDate: string | null;
  shareType: string | null;
  visibility: string | null;
  /** Public links (ContentDistribution) visible to the caller; null = caller cannot tell. */
  publicLinkCount: number | null;
}

export interface UploadBodyOptions {
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
}

export interface CreateVersionInput {
  /** Record the new File is published to (FirstPublishLocationId → ContentDocumentLink). */
  recordId: string;
  fileName: string;
  contentBodyId: string;
  description?: string;
}

export interface FilesTransport {
  readonly kind: 'salesforce' | 'mock';
  /** Latest version of each File linked to the record, read as the current user. */
  listCaseFiles(recordId: string): Promise<CaseFileInfo[]>;
  /** Uploads bytes only (no record yet). Returns the ContentBody Id. */
  uploadBody(file: File, options?: UploadBodyOptions): Promise<string>;
  /** Creates a ContentVersion from an uploaded body, linked to the record. Returns its Id. */
  createVersion(input: CreateVersionInput): Promise<string>;
  /** Downloads one ContentVersion's bytes as the current user. */
  fetchVersionData(versionId: string, signal?: AbortSignal): Promise<Blob>;
}

/** The record or File does not exist or the caller cannot see it (HTTP 404). */
export class NotFoundOrDeniedError extends Error {
  readonly status: number;
  constructor(message = 'Not found or no access.', status = 404) {
    super(message);
    this.name = 'NotFoundOrDeniedError';
    this.status = status;
  }
}

/**
 * The probe's server-side metadata (probes/ package directory: Apex endpoint, permission
 * set) is not deployed in this org, or the user lacks the probe permission set. Salesforce
 * answers with its own error list instead of the probe's JSON envelope.
 */
export class NotConfiguredError extends Error {
  readonly status: number;
  constructor(detail: string, status: number) {
    super(`NOT CONFIGURED: probe server metadata missing in this org or probe permission set not assigned (${status} ${detail}).`);
    this.name = 'NotConfiguredError';
    this.status = status;
  }
}

export class CancelledError extends Error {
  constructor(message = 'Upload cancelled.') {
    super(message);
    this.name = 'CancelledError';
  }
}

export class UploadFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UploadFailedError';
  }
}
