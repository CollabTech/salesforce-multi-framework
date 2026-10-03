/**
 * Public interface of the SMF-10 Files probe library. Later probes (SMF-11 markup,
 * SMF-12 sync, SMF-14 3D assets) import from here only; keep these exports stable.
 */
export { IMAGE_UPLOAD_POLICY, JPEG, MIB, PNG, extensionOf, formatBytes, validateFile } from './policy';
export type { AllowedType, FileLike, RejectCode, UploadPolicy, ValidationResult } from './policy';
export { isSalesforceId, maskId, sameId } from './ids';
export { CancelledError, NotFoundOrDeniedError, UploadFailedError } from './transport';
export type { CaseFileInfo, CreateVersionInput, FilesTransport, UploadBodyOptions } from './transport';
export { salesforceTransport } from './salesforceTransport';
export { MOCK_IDS, createMockTransport } from './mockTransport';
export type { MockFault, MockOptions, MockSeedEntry, MockTransport } from './mockTransport';
export { isLocalhostOrigin, parseFaults, selectFilesTransport } from './selectTransport';
export { KEY_PREFIX, filesWithKey, markerFor, newAttempt, runUpload, sha256Hex } from './uploadFlow';
export type { Attempt, FlowCallbacks, Phase, PersistedResult } from './uploadFlow';
