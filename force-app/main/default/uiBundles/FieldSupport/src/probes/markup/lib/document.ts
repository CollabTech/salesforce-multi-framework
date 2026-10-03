/**
 * tldraw document helpers for SMF-11/12.
 *
 * The equipment image is referenced, never embedded: the image asset's src is
 * "asset:sfcv/<ContentVersion Id>" and the asset store resolves it per user through the SMF-10
 * user-context endpoint. A saved snapshot therefore carries no image bytes, no data: and
 * no blob: URLs, and reopening it depends only on Salesforce Files the user can read.
 */
import { AssetRecordType, getSnapshot, loadSnapshot, type Editor, type TLAssetStore, type TLShape } from 'tldraw';
import type { FilesTransport } from '../../files/lib';

// tldraw only accepts http(s)/data/asset src protocols; asset:sfcv/<Id> is resolved by our store.
export const SFCV_PREFIX = 'asset:sfcv/';
export const SNAPSHOT_FORMAT = 'smf11-tldraw-document@1';

export interface SavedDocument {
  format: string;
  imageVersionId: string;
  document: ReturnType<typeof getSnapshot>['document'];
}

/** Resolves sfcv: assets by downloading the File as the signed-in user. Upload is disabled. */
export function createSalesforceAssetStore(transport: FilesTransport): TLAssetStore {
  const cache = new Map<string, Promise<string | null>>();
  return {
    async upload() {
      throw new Error('Adding files to the markup is not part of this probe.');
    },
    resolve(asset) {
      const src = asset.props && 'src' in asset.props ? asset.props.src : null;
      if (typeof src !== 'string' || !src.startsWith(SFCV_PREFIX)) return src ?? null;
      const versionId = src.slice(SFCV_PREFIX.length);
      if (!cache.has(versionId)) {
        cache.set(
          versionId,
          transport.fetchVersionData(versionId).then(
            blob => URL.createObjectURL(blob),
            () => null // denied or missing: the image does not render (no fallback)
          )
        );
      }
      return cache.get(versionId) ?? null;
    },
  };
}

/** Places the case image (by reference) as a locked background shape and fits the view. */
export async function placeCaseImage(editor: Editor, transport: FilesTransport, imageVersionId: string): Promise<void> {
  const blob = await transport.fetchVersionData(imageVersionId);
  const bitmap = await createImageBitmap(blob);
  const { width: w, height: h } = bitmap;
  bitmap.close();
  const asset = AssetRecordType.create({
    id: AssetRecordType.createId(),
    type: 'image',
    props: { src: `${SFCV_PREFIX}${imageVersionId}`, w, h, mimeType: blob.type || 'image/png', name: 'MF-IMAGE-001', isAnimated: false },
  });
  editor.createAssets([asset]);
  editor.createShape({ type: 'image', x: 0, y: 0, isLocked: true, props: { assetId: asset.id, w, h } });
  editor.zoomToFit();
}

export function serializeDocument(editor: Editor, imageVersionId: string): string {
  const { document } = getSnapshot(editor.store);
  const saved: SavedDocument = { format: SNAPSHOT_FORMAT, imageVersionId, document };
  const json = JSON.stringify(saved);
  assertPortable(json);
  return json;
}

/** A saved snapshot must not depend on browser-local URLs. */
export function assertPortable(json: string): void {
  if (/"(data|blob):/.test(json)) throw new Error('Snapshot contains a browser-local or inline asset URL.');
}

export function parseDocument(json: string): SavedDocument {
  const parsed: unknown = JSON.parse(json);
  if (!parsed || typeof parsed !== 'object' || (parsed as SavedDocument).format !== SNAPSHOT_FORMAT) {
    throw new Error('Not an SMF-11 markup snapshot.');
  }
  return parsed as SavedDocument;
}

export function loadDocument(editor: Editor, saved: SavedDocument): void {
  loadSnapshot(editor.store, { document: saved.document });
  editor.zoomToFit();
}

export interface ShapeSummary {
  type: string;
  color: string | null;
  text: string | null;
  geo: string | null;
}

function propOf(shape: TLShape, key: string): unknown {
  return (shape.props as Record<string, unknown>)[key];
}

/** Order-independent description of the page's shapes, used to compare documents. */
export function summarizeShapes(editor: Editor): ShapeSummary[] {
  return editor
    .getCurrentPageShapes()
    .map(s => {
      const color = propOf(s, 'color');
      const geo = propOf(s, 'geo');
      const text = editor.getShapeUtil(s).getText(s);
      return {
        type: s.type,
        color: typeof color === 'string' ? color : null,
        geo: typeof geo === 'string' ? geo : null,
        text: text ? text.trim() : null,
      };
    })
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
}

/** MF-MARKUP-001 check: red ellipse, an arrow, and the text "Inspect inlet" on the image. */
export function checkMarkupFixture(shapes: ShapeSummary[]): { circle: boolean; arrow: boolean; label: boolean; image: boolean } {
  return {
    image: shapes.some(s => s.type === 'image'),
    circle: shapes.some(s => s.type === 'geo' && s.geo === 'ellipse' && s.color === 'red'),
    arrow: shapes.some(s => s.type === 'arrow'),
    label: shapes.some(s => (s.text ?? '').toLowerCase() === 'inspect inlet'),
  };
}
