import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readHostContext } from '@/features/launch/hostContext';
import {
  CancelledError,
  IMAGE_UPLOAD_POLICY,
  MOCK_IDS,
  NotFoundOrDeniedError,
  formatBytes,
  isSalesforceId,
  maskId,
  newAttempt,
  runUpload,
  selectFilesTransport,
  sha256Hex,
  validateFile,
  type Attempt,
  type CaseFileInfo,
  type PersistedResult,
  type Phase,
  type ValidationResult,
} from './lib';

type Retrieval =
  | { state: 'idle' }
  | { state: 'busy' }
  | { state: 'ok'; bytes: number; sha256: string; url: string }
  | { state: 'denied'; message: string }
  | { state: 'error'; message: string };

type Listing =
  | { state: 'idle' }
  | { state: 'busy' }
  | { state: 'ok'; files: CaseFileInfo[] }
  | { state: 'denied'; message: string }
  | { state: 'error'; message: string };

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** SMF-10 probe: case-linked image upload, user-context read-back and denial checks. */
export default function FilesProbe() {
  const transport = useMemo(() => selectFilesTransport(), []);
  const ctx = useMemo(() => readHostContext(), []);
  const initialCase = new URLSearchParams(window.location.search).get('caseId');
  const [caseId, setCaseId] = useState<string>(initialCase ?? (transport.kind === 'mock' ? MOCK_IDS.visibleCase : ''));
  const [anyTypeInPicker, setAnyTypeInPicker] = useState(false);
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<PersistedResult | null>(null);
  const [persistedUrl, setPersistedUrl] = useState<string | null>(null);
  const [listing, setListing] = useState<Listing>({ state: 'idle' });
  const [versionId, setVersionId] = useState('');
  const [retrieval, setRetrieval] = useState<Retrieval>({ state: 'idle' });
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    document.title = 'Files probe | Field Support PoC';
  }, []);
  useEffect(() => () => void (localUrl && URL.revokeObjectURL(localUrl)), [localUrl]);
  useEffect(() => () => void (persistedUrl && URL.revokeObjectURL(persistedUrl)), [persistedUrl]);

  const caseValid = isSalesforceId(caseId);
  const busy = ['checking', 'uploading', 'linking', 'verifying'].includes(phase);

  const onSelect = async (event: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = event.target.files?.[0];
    event.target.value = '';
    setResult(null);
    setPersistedUrl(null);
    setError(null);
    setPhase('idle');
    setProgress(0);
    if (!file) return;
    const v = await validateFile(file, IMAGE_UPLOAD_POLICY);
    setValidation(v);
    setLocalUrl(v.ok ? URL.createObjectURL(file) : null);
    // A new selection is a new intent: new idempotency key.
    setAttempt(v.ok ? newAttempt(file) : null);
  };

  const start = async (): Promise<void> => {
    if (!attempt || !caseValid) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setError(null);
    setProgress(0);
    try {
      const r = await runUpload(transport, caseId, attempt, { onPhase: setPhase, onProgress: setProgress }, controller.signal);
      setResult(r);
      setPersistedUrl(URL.createObjectURL(r.readBackBlob));
      setPhase('persisted');
    } catch (e) {
      if (e instanceof CancelledError || controller.signal.aborted) {
        setPhase('cancelled');
        setError('Cancelled by the user. Retry resumes with the same idempotency key.');
      } else {
        setPhase('failed');
        setError(errorText(e));
      }
    } finally {
      setAttempt(a => (a ? { ...a } : a));
      abortRef.current = null;
    }
  };

  const cancel = (): void => abortRef.current?.abort();

  const listFiles = async (): Promise<void> => {
    setListing({ state: 'busy' });
    try {
      setListing({ state: 'ok', files: await transport.listCaseFiles(caseId) });
    } catch (e) {
      setListing(e instanceof NotFoundOrDeniedError ? { state: 'denied', message: e.message } : { state: 'error', message: errorText(e) });
    }
  };

  const retrieve = async (): Promise<void> => {
    setRetrieval({ state: 'busy' });
    try {
      const blob = await transport.fetchVersionData(versionId.trim());
      setRetrieval({ state: 'ok', bytes: blob.size, sha256: await sha256Hex(blob), url: URL.createObjectURL(blob) });
    } catch (e) {
      setRetrieval(e instanceof NotFoundOrDeniedError ? { state: 'denied', message: e.message } : { state: 'error', message: errorText(e) });
    }
  };

  const report = [
    `probe: SMF-10 files (FILE-01..04)`,
    `transport: ${transport.kind === 'mock' ? 'MOCK (localhost only, not Salesforce evidence)' : 'salesforce (user context)'}`,
    `build: ${ctx.build}`,
    `captured: ${new Date().toISOString()}`,
    `origin: ${ctx.origin} framed: ${ctx.inIframe} viewport: ${ctx.viewport}`,
    `user agent: ${ctx.userAgent}`,
    `case: ${maskId(caseId)}`,
    `validation: ${validation ? (validation.ok ? `accepted ${validation.type.label} ${formatBytes(validation.bytes)}` : `rejected ${validation.code} (${formatBytes(validation.bytes)})`) : 'none'}`,
    `phase: ${phase}${attempt ? ` tries: ${attempt.tries} key: ${attempt.key.slice(0, 8)}…` : ''}`,
    ...(error ? [`error: ${error}`] : []),
    ...(result
      ? [
          `persisted: ContentDocument ${maskId(result.file.contentDocumentId)} ContentVersion ${maskId(result.file.latestVersionId)} v${result.file.versionNumber}`,
          `linked to this case: ${result.linkedToCase} files with key: ${result.filesWithKey} reused existing: ${result.reusedExisting}`,
          `bytes local/read-back: ${result.bytesLocal}/${result.bytesReadBack} sha256 match: ${result.sha256Local === result.sha256ReadBack} sha256: ${result.sha256ReadBack.slice(0, 12)}…`,
          `public links visible: ${result.file.publicLinkCount ?? 'unknown'}`,
        ]
      : []),
    ...(listing.state === 'ok' ? [`case Files listed: ${listing.files.length}`] : []),
    ...(listing.state === 'denied' ? [`case Files listing: DENIED (${listing.message})`] : []),
    ...(retrieval.state === 'ok' ? [`retrieve ${maskId(versionId)}: OK ${retrieval.bytes} B sha256 ${retrieval.sha256.slice(0, 12)}…`] : []),
    ...(retrieval.state === 'denied' ? [`retrieve ${maskId(versionId)}: DENIED (${retrieval.message})`] : []),
    ...(retrieval.state === 'error' ? [`retrieve ${maskId(versionId)}: ERROR (${retrieval.message})`] : []),
  ].join('\n');

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">SMF-10 · FILE-01..04</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Case image in Salesforce Files</h1>
      {transport.kind === 'mock' && (
        <p role="status" data-testid="mock-banner" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          MOCK TRANSPORT — localhost only. Nothing here touches Salesforce; results are not host evidence.
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>1 · Case</CardTitle>
          <CardDescription>Paste the MF-CASE-001 record Id from the private mapping. It is shown masked in evidence.</CardDescription>
        </CardHeader>
        <CardContent>
          <Label htmlFor="case-id">Case record Id</Label>
          <Input id="case-id" className="mt-1 min-h-11" value={caseId} onChange={e => setCaseId(e.target.value.trim())} autoComplete="off" />
          {!caseValid && caseId !== '' && <p className="mt-1 text-sm text-red-700">Not a valid Salesforce Id.</p>}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>2 · Choose image</CardTitle>
          <CardDescription>
            PNG or JPEG, at most {formatBytes(IMAGE_UPLOAD_POLICY.maxBytes)} (fixed PoC limit). Type, extension and content are all checked.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            data-testid="file-input"
            className="min-h-11"
            accept={anyTypeInPicker ? undefined : 'image/png,image/jpeg'}
            onChange={e => void onSelect(e)}
            disabled={busy}
          />
          <label className="flex min-h-11 items-center gap-2 text-sm">
            <input type="checkbox" checked={anyTypeInPicker} onChange={e => setAnyTypeInPicker(e.target.checked)} />
            Picker shows all file types (to select the .txt for FILE-03)
          </label>
          {validation && !validation.ok && (
            <p role="alert" data-testid="validation-error" className="rounded bg-red-50 p-3 text-sm text-red-800">
              Rejected ({validation.code}): {validation.message} Nothing was uploaded.
            </p>
          )}
          {validation?.ok && localUrl && (
            <figure data-testid="local-preview" className="rounded border-2 border-dashed border-slate-400 p-2">
              <figcaption className="mb-2 text-xs font-semibold uppercase text-slate-600">
                Browser-local preview — NOT persisted · {validation.type.label} · {formatBytes(validation.bytes)}
              </figcaption>
              <img src={localUrl} alt="Local preview of the selected file" className="max-h-56 w-auto" />
            </figure>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>3 · Upload and link to the case</CardTitle>
          <CardDescription>Retry reuses the same idempotency key, so a retry never attaches a second copy.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11" data-testid="upload" disabled={!attempt || !caseValid || busy || phase === 'persisted'} onClick={() => void start()}>
              {phase === 'failed' || phase === 'cancelled' ? 'Retry upload' : 'Upload to Salesforce Files'}
            </Button>
            <Button className="min-h-11" variant="outline" data-testid="cancel" disabled={!busy} onClick={cancel}>
              Cancel
            </Button>
          </div>
          <p data-testid="phase" className="text-sm">
            Phase: <strong>{phase}</strong>
            {attempt && ` · attempt ${attempt.tries} · key ${attempt.key.slice(0, 8)}…`}
          </p>
          {phase === 'uploading' && <progress className="h-2 w-full" max={100} value={progress} aria-label="Upload progress" />}
          {error && (
            <p role="alert" data-testid="upload-error" className="rounded bg-red-50 p-3 text-sm text-red-800">
              {error}
            </p>
          )}
          {result && persistedUrl && (
            <figure data-testid="persisted" className="rounded border-2 border-emerald-600 p-2">
              <figcaption className="mb-2 text-xs font-semibold uppercase text-emerald-800">
                Persisted Salesforce File — read back from the server as the signed-in user
              </figcaption>
              <img src={persistedUrl} alt="Image read back from Salesforce Files" className="max-h-56 w-auto" />
              <dl className="mt-2 grid grid-cols-2 gap-x-3 text-sm">
                <dt>ContentDocument</dt>
                <dd>{maskId(result.file.contentDocumentId)}</dd>
                <dt>ContentVersion</dt>
                <dd>
                  {maskId(result.file.latestVersionId)} (v{result.file.versionNumber})
                </dd>
                <dt>Linked to this case</dt>
                <dd data-testid="linked">{String(result.linkedToCase)}</dd>
                <dt>Files with this key</dt>
                <dd data-testid="key-count">{result.filesWithKey}</dd>
                <dt>Bytes match (SHA-256)</dt>
                <dd data-testid="hash-match">{String(result.sha256Local === result.sha256ReadBack)}</dd>
                <dt>Public links visible</dt>
                <dd>{result.file.publicLinkCount ?? 'unknown'}</dd>
              </dl>
            </figure>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>4 · Read back as the current user</CardTitle>
          <CardDescription>Use from a fresh session as MF-SUPPORT (FILE-01) and as MF-RESTRICTED or for MF-FILE-DENIED (FILE-02).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button className="min-h-11" variant="outline" data-testid="list" disabled={!caseValid} onClick={() => void listFiles()}>
            List Files on this case
          </Button>
          {listing.state === 'denied' && <p data-testid="list-denied" className="text-sm font-semibold text-red-800">DENIED: {listing.message}</p>}
          {listing.state === 'error' && <p className="text-sm text-red-800">Error: {listing.message}</p>}
          {listing.state === 'ok' && (
            <ul data-testid="file-list" className="space-y-1 text-sm">
              {listing.files.length === 0 && <li>No Files visible on this case.</li>}
              {listing.files.map(f => (
                <li key={f.latestVersionId}>
                  {f.title}.{f.fileExtension} · v{f.versionNumber} · {formatBytes(f.contentSize)} · version {maskId(f.latestVersionId)}
                  <Button variant="link" className="min-h-11" onClick={() => setVersionId(f.latestVersionId)}>
                    use
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Label htmlFor="version-id">ContentVersion Id to retrieve</Label>
          <Input id="version-id" className="min-h-11" value={versionId} onChange={e => setVersionId(e.target.value)} autoComplete="off" />
          <Button className="min-h-11" variant="outline" data-testid="retrieve" disabled={!isSalesforceId(versionId.trim())} onClick={() => void retrieve()}>
            Retrieve File bytes
          </Button>
          {retrieval.state === 'denied' && <p data-testid="retrieve-denied" className="text-sm font-semibold text-red-800">DENIED: {retrieval.message}</p>}
          {retrieval.state === 'error' && <p className="text-sm text-red-800">Error: {retrieval.message}</p>}
          {retrieval.state === 'ok' && (
            <figure data-testid="retrieve-ok">
              <figcaption className="text-sm">
                Retrieved {formatBytes(retrieval.bytes)} · SHA-256 {retrieval.sha256.slice(0, 12)}…
              </figcaption>
              <img src={retrieval.url} alt="Retrieved File" className="mt-2 max-h-56 w-auto" />
            </figure>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Copy for evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <pre data-testid="evidence" className="whitespace-pre-wrap break-all rounded bg-slate-100 p-3 text-xs">
            {report}
          </pre>
          <Button className="mt-3 min-h-11" onClick={() => void navigator.clipboard?.writeText(report).then(() => setCopied(true))}>
            {copied ? 'Copied' : 'Copy for evidence'}
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
