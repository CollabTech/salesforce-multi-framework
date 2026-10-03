import { useEffect, useMemo, useRef, useState } from 'react';
import { Tldraw, type Editor } from 'tldraw';
import 'tldraw/tldraw.css';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { readHostContext } from '@/features/launch/hostContext';
import { MOCK_IDS, NotFoundOrDeniedError, isLocalhostOrigin, isSalesforceId, maskId, selectFilesTransport, type CaseFileInfo } from '@/probes/files/lib';
import {
  MarkupConflictError,
  checkMarkupFixture,
  createSalesforceAssetStore,
  licenseKeyFromBuild,
  licenseStatus,
  loadDocument,
  parseDocument,
  parseMeta,
  placeCaseImage,
  selectMarkupApi,
  serializeDocument,
  summarizeShapes,
  type MarkupApi,
  type MarkupRevision,
  type ShapeSummary,
} from './lib';

// Self-hosted tldraw fonts/icons/translations, bundled by Vite (no CDN, no CSP Trusted Site).
const assetUrls = getAssetUrlsByImport();

type SaveState =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; revision: MarkupRevision; reused: boolean }
  | { state: 'failed'; message: string; pendingKey: string }
  | { state: 'conflict'; current: MarkupRevision | null };

type Pending = { kind: 'new'; imageVersionId: string } | { kind: 'load'; json: string };

declare global {
  interface Window {
    __SMF_EDITOR__?: Editor;
    __SMF_MARKUP_API__?: MarkupApi;
  }
}

const errorText = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** SMF-11 probe: tldraw markup over the case image, saved to and reopened from Salesforce Files. */
export default function MarkupProbe() {
  const transport = useMemo(() => selectFilesTransport(), []);
  const api = useMemo(() => selectMarkupApi(transport), [transport]);
  const assetStore = useMemo(() => createSalesforceAssetStore(transport), [transport]);
  const ctx = useMemo(() => readHostContext(), []);
  const license = useMemo(() => licenseStatus(window.location, import.meta.env.PROD, licenseKeyFromBuild()), []);
  const [caseId, setCaseId] = useState(transport.kind === 'mock' ? MOCK_IDS.visibleCase : '');
  const [images, setImages] = useState<CaseFileInfo[] | null>(null);
  const [imageVersionId, setImageVersionId] = useState('');
  const [editorKey, setEditorKey] = useState(0);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [base, setBase] = useState<MarkupRevision | null>(null);
  const [save, setSave] = useState<SaveState>({ state: 'idle' });
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [shapes, setShapes] = useState<ShapeSummary[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const pending = useRef<Pending | null>(null);

  useEffect(() => {
    document.title = 'Markup probe | Field Support PoC';
  }, []);
  useEffect(() => {
    if (transport.kind === 'mock' && isLocalhostOrigin(window.location.hostname)) {
      window.__SMF_MARKUP_API__ = api;
      if (editor) window.__SMF_EDITOR__ = editor;
    }
  }, [api, editor, transport.kind]);

  const caseValid = isSalesforceId(caseId);

  const listImages = async (): Promise<void> => {
    setMessage(null);
    try {
      const files = await transport.listCaseFiles(caseId);
      setImages(files.filter(f => ['png', 'jpg', 'jpeg'].includes((f.fileExtension ?? '').toLowerCase()) && !parseMeta(f.description).kind));
    } catch (e) {
      setImages(null);
      setMessage(e instanceof NotFoundOrDeniedError ? `DENIED: ${e.message}` : errorText(e));
    }
  };

  const onMount = (ed: Editor): void => {
    setEditor(ed);
    const job = pending.current;
    pending.current = null;
    if (!job) return;
    const run = async (): Promise<void> => {
      if (job.kind === 'new') await placeCaseImage(ed, transport, job.imageVersionId);
      else loadDocument(ed, parseDocument(job.json));
      setShapes(summarizeShapes(ed));
    };
    run().catch(e => setMessage(errorText(e)));
  };

  const startNew = (): void => {
    pending.current = { kind: 'new', imageVersionId };
    setBase(null);
    setSave({ state: 'idle' });
    setExportUrl(null);
    setEditorKey(k => k + 1);
  };

  const showExport = async (rev: MarkupRevision): Promise<void> => {
    if (!rev.exportVersionId) return;
    const blob = await transport.fetchVersionData(rev.exportVersionId);
    setExportUrl(URL.createObjectURL(blob));
  };

  const reopen = async (): Promise<void> => {
    setMessage(null);
    try {
      const rev = await api.latest(caseId);
      if (!rev) {
        setMessage('No saved markup on this case yet.');
        return;
      }
      const json = await (await transport.fetchVersionData(rev.snapshotVersionId)).text();
      pending.current = { kind: 'load', json };
      setImageVersionId(parseDocument(json).imageVersionId);
      setBase(rev);
      setSave({ state: 'idle' });
      setEditorKey(k => k + 1);
      await showExport(rev);
    } catch (e) {
      setMessage(e instanceof NotFoundOrDeniedError ? `DENIED: ${e.message}` : errorText(e));
    }
  };

  const doSave = async (saveKey: string, baseRev: MarkupRevision | null): Promise<void> => {
    if (!editor) return;
    setSave({ state: 'saving' });
    try {
      const ids = [...editor.getCurrentPageShapeIds()];
      const { blob } = await editor.toImage(ids, { format: 'png', background: true });
      const snapshotJson = serializeDocument(editor, imageVersionId);
      const result = await api.save({
        caseId,
        baseSnapshotVersionId: baseRev?.snapshotVersionId ?? null,
        saveKey,
        imageVersionId,
        snapshotJson,
        exportPng: blob,
      });
      setBase(result.revision);
      setSave({ state: 'saved', revision: result.revision, reused: result.reused });
      setShapes(summarizeShapes(editor));
      await showExport(result.revision);
    } catch (e) {
      if (e instanceof MarkupConflictError) setSave({ state: 'conflict', current: e.current });
      else setSave({ state: 'failed', message: errorText(e), pendingKey: saveKey });
    }
  };

  const fixture = checkMarkupFixture(shapes);
  const report = [
    'probe: SMF-11 markup (MARK-01..04)',
    `transport: ${transport.kind === 'mock' ? 'MOCK (localhost only, not Salesforce evidence)' : 'salesforce (user context)'}`,
    `build: ${ctx.build}`,
    `captured: ${new Date().toISOString()}`,
    `origin: ${ctx.origin} framed: ${ctx.inIframe} viewport: ${ctx.viewport} dpr: ${ctx.devicePixelRatio}`,
    `user agent: ${ctx.userAgent}`,
    `tldraw: 5.5.2 env: ${license.environment} license key at build: ${license.keyConfigured ? 'yes' : 'no'} gate: ${license.productionGate} assets: self-hosted (bundle)`,
    `case: ${maskId(caseId)} image: ${maskId(imageVersionId)}`,
    `base revision: ${base ? `r${base.rev} ${maskId(base.snapshotVersionId)}` : 'none'}`,
    `save: ${save.state}${save.state === 'saved' ? ` r${save.revision.rev} snapshot ${maskId(save.revision.snapshotVersionId)} export ${maskId(save.revision.exportVersionId)} reused ${save.reused}` : ''}${save.state === 'failed' ? ` (${save.message})` : ''}${save.state === 'conflict' ? ` current r${save.current?.rev ?? '?'}` : ''}`,
    `shapes: ${shapes.map(s => `${s.type}${s.geo ? `/${s.geo}` : ''}${s.color ? `/${s.color}` : ''}${s.text ? ` "${s.text}"` : ''}`).join(', ') || 'none'}`,
    `MF-MARKUP-001 check: image ${fixture.image} red circle ${fixture.circle} arrow ${fixture.arrow} label ${fixture.label}`,
    ...(message ? [`message: ${message}`] : []),
  ].join('\n');

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">SMF-11 · MARK-01..04</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Equipment markup in Salesforce Files</h1>
      {transport.kind === 'mock' && (
        <p role="status" data-testid="mock-banner" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          MOCK TRANSPORT — localhost only. Nothing here touches Salesforce; results are not host evidence.
        </p>
      )}
      {license.productionGate === 'BLOCKED-no-key' && (
        <p role="alert" data-testid="license-blocked" className="mt-3 rounded bg-red-50 p-3 text-sm text-red-800">
          tldraw is running in production without a license key: the editor will stop rendering. Production use is gated on a license (set VITE_TLDRAW_LICENSE_KEY at build).
        </p>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>1 · Case and image</CardTitle>
          <CardDescription>Paste the MF-CASE-001 Id, list its images, then start a new markup or reopen the latest saved one.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="markup-case-id">Case record Id</Label>
          <Input id="markup-case-id" className="min-h-11" value={caseId} onChange={e => setCaseId(e.target.value.trim())} autoComplete="off" />
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="min-h-11" data-testid="list-images" disabled={!caseValid} onClick={() => void listImages()}>
              List case images
            </Button>
            <Button variant="outline" className="min-h-11" data-testid="reopen" disabled={!caseValid} onClick={() => void reopen()}>
              Reopen latest saved markup
            </Button>
          </div>
          {images && (
            <ul data-testid="image-list" className="space-y-1 text-sm">
              {images.length === 0 && <li>No images on this case.</li>}
              {images.map(f => (
                <li key={f.latestVersionId}>
                  <label className="flex min-h-11 items-center gap-2">
                    <input type="radio" name="image" checked={imageVersionId === f.latestVersionId} onChange={() => setImageVersionId(f.latestVersionId)} />
                    {f.title}.{f.fileExtension} · {maskId(f.latestVersionId)}
                  </label>
                </li>
              ))}
            </ul>
          )}
          <Button className="min-h-11" data-testid="start-new" disabled={!isSalesforceId(imageVersionId)} onClick={startNew}>
            Start new markup on this image
          </Button>
          {message && (
            <p role="alert" data-testid="markup-message" className="rounded bg-red-50 p-3 text-sm text-red-800">
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>2 · Annotate</CardTitle>
          <CardDescription>Mouse or touch: red ellipse over the inlet (TECH); arrow and text “Inspect inlet” (SUPPORT). Pinch/scroll to zoom, hand tool or space-drag to pan.</CardDescription>
        </CardHeader>
        <CardContent>
          <div data-testid="markup-canvas" className="relative h-[65vh] w-full overflow-hidden rounded border">
            {editorKey > 0 ? (
              <Tldraw key={editorKey} assetUrls={assetUrls} assets={assetStore} licenseKey={licenseKeyFromBuild()} onMount={onMount} />
            ) : (
              <p className="p-4 text-sm text-slate-600">Choose an image and start, or reopen the latest markup.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>3 · Save to Salesforce Files</CardTitle>
          <CardDescription>Saves an editable snapshot and an annotated PNG as linked Files. A stale base is refused, never overwritten.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11" data-testid="save" disabled={!editor || save.state === 'saving'} onClick={() => void doSave(crypto.randomUUID(), base)}>
              Save snapshot + export
            </Button>
            {save.state === 'failed' && (
              <Button className="min-h-11" variant="outline" data-testid="retry-save" onClick={() => void doSave(save.pendingKey, base)}>
                Retry save
              </Button>
            )}
            <Button className="min-h-11" variant="outline" data-testid="check-shapes" disabled={!editor} onClick={() => editor && setShapes(summarizeShapes(editor))}>
              Check annotations
            </Button>
          </div>
          <p data-testid="save-state" className="text-sm">
            Save: <strong>{save.state}</strong>
            {save.state === 'saved' && ` · r${save.revision.rev}${save.reused ? ' (already saved — retry wrote nothing new)' : ''}`}
            {base && ` · base r${base.rev}`}
          </p>
          {save.state === 'failed' && (
            <p role="alert" data-testid="save-error" className="rounded bg-red-50 p-3 text-sm text-red-800">
              Save failed: {save.message}. Your drawing is still here; Retry save reuses the same save key.
            </p>
          )}
          {save.state === 'conflict' && (
            <div role="alert" data-testid="conflict" className="space-y-2 rounded border border-red-400 bg-red-50 p-3 text-sm text-red-900">
              <p>
                Conflict: revision r{save.current?.rev ?? '?'} was saved by another session after you opened r{base?.rev ?? 'none'}. Nothing was written.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button className="min-h-11" variant="outline" data-testid="load-latest" onClick={() => void reopen()}>
                  Load latest (discard my unsaved changes)
                </Button>
                <Button className="min-h-11" data-testid="save-on-top" onClick={() => void doSave(crypto.randomUUID(), save.current)}>
                  Save mine as a new revision on top
                </Button>
              </div>
            </div>
          )}
          {exportUrl && (
            <figure data-testid="export-readback" className="rounded border-2 border-emerald-600 p-2">
              <figcaption className="mb-2 text-xs font-semibold uppercase text-emerald-800">Annotated export read back from Salesforce Files</figcaption>
              <img src={exportUrl} alt="Annotated export read back from Salesforce" className="max-h-64 w-auto" />
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
