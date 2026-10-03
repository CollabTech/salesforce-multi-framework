import { useCallback, useEffect, useMemo, useState } from 'react';
import { useValue, type Editor } from 'tldraw';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { fetchCurrentUser } from '@/features/launch/currentUser';
import { readHostContext } from '@/features/launch/hostContext';
import { MOCK_IDS, NotFoundOrDeniedError, isLocalhostOrigin, isSalesforceId, maskId, selectFilesTransport, type CaseFileInfo } from '../files/lib';
import {
  MarkupConflictError,
  SFCV_PREFIX,
  checkMarkupFixture,
  createSalesforceAssetStore,
  licenseKeyFromBuild,
  licenseStatus,
  parseMeta,
  placeCaseImage,
  selectMarkupApi,
  serializeDocument,
  summarizeShapes,
  type MarkupRevision,
} from '../markup/lib';
import { selectTokenSource } from './lib/tokenSource';
import LiveRoom, { usePresence } from './LiveRoom';

type SaveState =
  | { state: 'idle' }
  | { state: 'saving' }
  | { state: 'saved'; revision: MarkupRevision }
  | { state: 'failed'; message: string; key: string }
  | { state: 'conflict'; current: MarkupRevision | null };

const PERSONA_COLORS: Record<string, string> = { TECH: '#e03131', SUPPORT: '#1971c2' };

/** SMF-12 probe: two-user live markup through the authenticated sync service; Files = durable save. */
export default function MarkupSyncProbe() {
  const transport = useMemo(() => selectFilesTransport(), []);
  const tokenSource = useMemo(() => selectTokenSource(), []);
  const api = useMemo(() => selectMarkupApi(transport), [transport]);
  const assetStore = useMemo(() => createSalesforceAssetStore(transport), [transport]);
  const ctx = useMemo(() => readHostContext(), []);
  const license = useMemo(() => licenseStatus(window.location, import.meta.env.PROD, licenseKeyFromBuild()), []);
  const mockAs = new URLSearchParams(window.location.search).get('as') ?? 'TECH';
  const [identity, setIdentity] = useState<{ id: string; name: string } | null>(null);
  const [caseId, setCaseId] = useState(transport.kind === 'mock' ? MOCK_IDS.visibleCase : '');
  const [joined, setJoined] = useState(false);
  const [status, setStatus] = useState('not joined');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [images, setImages] = useState<CaseFileInfo[]>([]);
  const [base, setBase] = useState<MarkupRevision | null>(null);
  const [save, setSave] = useState<SaveState>({ state: 'idle' });
  const [message, setMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const presence = usePresence(editor);

  useEffect(() => {
    document.title = 'Live markup probe | Field Support PoC';
    if (transport.kind === 'mock') {
      setIdentity({ id: mockAs === 'SUPPORT' ? '005' + 'MOCKSUPP0001AAA' : '005' + 'MOCKTECH0001AAA', name: `MF-${mockAs} (mock)` });
      return;
    }
    fetchCurrentUser()
      .then(u => setIdentity(u ? { id: u.id, name: u.name ?? 'Unknown user' } : null))
      .catch(e => setMessage(e instanceof Error ? e.message : String(e)));
  }, [mockAs, transport.kind]);

  useEffect(() => {
    if (transport.kind === 'mock' && isLocalhostOrigin(window.location.hostname) && editor) window.__SMF_EDITOR__ = editor;
  }, [editor, transport.kind]);

  const onEditor = useCallback((ed: Editor | null) => setEditor(ed), []);
  const onStatus = useCallback((s: string) => setStatus(s), []);

  const join = async (): Promise<void> => {
    setMessage(null);
    try {
      const files = await transport.listCaseFiles(caseId);
      setImages(files.filter(f => ['png', 'jpg', 'jpeg'].includes((f.fileExtension ?? '').toLowerCase()) && !parseMeta(f.description).kind));
      setBase(await api.latest(caseId));
      setJoined(true);
    } catch (e) {
      setMessage(e instanceof NotFoundOrDeniedError ? `DENIED: ${e.message}` : e instanceof Error ? e.message : String(e));
    }
  };

  const imageInDoc = (): string | null => {
    const asset = editor?.getAssets().find(a => 'src' in a.props && typeof a.props.src === 'string' && a.props.src.startsWith(SFCV_PREFIX));
    return asset && 'src' in asset.props && typeof asset.props.src === 'string' ? asset.props.src.slice(SFCV_PREFIX.length) : null;
  };

  const doSave = async (key: string, baseRev: MarkupRevision | null): Promise<void> => {
    const imageVersionId = imageInDoc();
    if (!editor || !imageVersionId) return;
    setSave({ state: 'saving' });
    try {
      const { blob } = await editor.toImage([...editor.getCurrentPageShapeIds()], { format: 'png', background: true });
      const result = await api.save({ caseId, baseSnapshotVersionId: baseRev?.snapshotVersionId ?? null, saveKey: key, imageVersionId, snapshotJson: serializeDocument(editor, imageVersionId), exportPng: blob });
      setBase(result.revision);
      setSave({ state: 'saved', revision: result.revision });
    } catch (e) {
      if (e instanceof MarkupConflictError) setSave({ state: 'conflict', current: e.current });
      else setSave({ state: 'failed', message: e instanceof Error ? e.message : String(e), key });
    }
  };

  // Reactive: re-renders when the shared document changes (local or remote edits).
  const shapes = useValue('smf12-shapes', () => (editor ? summarizeShapes(editor) : []), [editor]);
  const fixture = checkMarkupFixture(shapes);
  const report = [
    'probe: SMF-12 live markup (SYNC-01..04)',
    `transport: ${transport.kind === 'mock' ? 'MOCK Files + localhost test tokens (not Salesforce evidence)' : 'salesforce (user context)'}; token source: ${tokenSource.kind}`,
    `build: ${ctx.build}`,
    `captured: ${new Date().toISOString()}`,
    `origin: ${ctx.origin} framed: ${ctx.inIframe} viewport: ${ctx.viewport}`,
    `user agent: ${ctx.userAgent}`,
    `tldraw: 5.5.2 env: ${license.environment} gate: ${license.productionGate}`,
    `case: ${maskId(caseId)} room status: ${status}`,
    `presence (others): ${presence.length} ${presence.join(', ')}`,
    `shapes: ${shapes.length} · MF-MARKUP-001 check: image ${fixture.image} red circle ${fixture.circle} arrow ${fixture.arrow} label ${fixture.label}`,
    `Files base: ${base ? `r${base.rev}` : 'none'} save: ${save.state}${save.state === 'saved' ? ` r${save.revision.rev} snapshot ${maskId(save.revision.snapshotVersionId)} export ${maskId(save.revision.exportVersionId)}` : ''}${save.state === 'conflict' ? ` current r${save.current?.rev ?? '?'}` : ''}${save.state === 'failed' ? ` (${save.message})` : ''}`,
    ...(message ? [`message: ${message}`] : []),
  ].join('\n');

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-amber-700">SMF-12 · SYNC-01..04</p>
      <h1 className="mt-1 text-2xl font-bold text-slate-900">Live two-user markup</h1>
      {transport.kind === 'mock' && (
        <p role="status" data-testid="mock-banner" className="mt-3 rounded border border-amber-400 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
          MOCK FILES + LOCAL TEST TOKENS — localhost only. Not host evidence.
        </p>
      )}
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>1 · Join the case room</CardTitle>
          <CardDescription>The room token is issued only after Salesforce confirms you can see and edit this case. It expires and is re-issued on reconnect.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Label htmlFor="sync-case-id">Case record Id</Label>
          <Input id="sync-case-id" className="min-h-11" value={caseId} onChange={e => setCaseId(e.target.value.trim())} disabled={joined} autoComplete="off" />
          <Button className="min-h-11" data-testid="join" disabled={!isSalesforceId(caseId) || joined || !identity} onClick={() => void join()}>
            Join live markup
          </Button>
          <p className="text-sm" data-testid="identity">
            You: {identity?.name ?? '…'}
          </p>
          {message && (
            <p role="alert" data-testid="sync-message" className="rounded bg-red-50 p-3 text-sm text-red-800">
              {message}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>2 · Mark up together</CardTitle>
          <CardDescription>
            Status: <span data-testid="sync-status">{status}</span> · Others here: <span data-testid="presence">{presence.join(', ') || 'nobody'}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {joined && editor && !fixture.image && images.length > 0 && (
            <Button className="min-h-11" variant="outline" data-testid="place-image" onClick={() => void placeCaseImage(editor, transport, images[0].latestVersionId)}>
              Place case image ({images[0].title})
            </Button>
          )}
          <div data-testid="sync-canvas" className="relative h-[65vh] w-full overflow-hidden rounded border">
            {joined && identity ? (
              <LiveRoom
                  caseId={caseId}
                  userId={identity.id}
                  userName={identity.name}
                  color={PERSONA_COLORS[mockAs] ?? '#2f9e44'}
                  tokenSource={tokenSource}
                  assetStore={assetStore}
                  onEditor={onEditor}
                  onStatus={onStatus}
                />
            ) : (
              <p className="p-4 text-sm text-slate-600">Join to load the shared markup.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>3 · Save the agreed markup to Salesforce Files</CardTitle>
          <CardDescription>Files is the durable record (SMF-11 revisions). Simultaneous saves get an explicit conflict.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-3">
            <Button className="min-h-11" data-testid="sync-save" disabled={!editor || save.state === 'saving'} onClick={() => void doSave(crypto.randomUUID(), base)}>
              Save snapshot + export
            </Button>
            {save.state === 'failed' && (
              <Button className="min-h-11" variant="outline" onClick={() => void doSave(save.key, base)}>
                Retry save
              </Button>
            )}
            {save.state === 'conflict' && (
              <Button className="min-h-11" variant="outline" data-testid="sync-save-on-top" onClick={() => void doSave(crypto.randomUUID(), save.current)}>
                Save as a new revision on top of r{save.current?.rev ?? '?'}
              </Button>
            )}
          </div>
          <p data-testid="sync-save-state" className="text-sm">
            Save: {save.state}
            {save.state === 'saved' && ` · r${save.revision.rev}`}
            {save.state === 'conflict' && ` · another session saved r${save.current?.rev ?? '?'}; nothing was written`}
          </p>
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
