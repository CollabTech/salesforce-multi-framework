/**
 * SMF-11 markup revision API. Each save produces a snapshot File and an export File linked
 * to the case, associated through their Descriptions (see SMF11_MarkupService.cls):
 *   snapshot: smf11;kind=snapshot;rev=<n>;save=<key>;image=<CV>;base=<CV|none>
 *   export:   smf11;kind=export;rev=<n>;save=<key>;snapshot=<CV>
 */
import type { CaseFileInfo } from '../../files/lib';

export const SNAPSHOT_TITLE = 'MF-MARKUP-001 snapshot r';
export const EXPORT_TITLE = 'MF-MARKUP-001 export r';
export const META_PREFIX = 'smf11;';

export interface MarkupRevision {
  rev: number;
  saveKey: string;
  snapshotVersionId: string;
  exportVersionId: string | null;
  imageVersionId: string;
  baseSnapshotVersionId: string | null;
  createdDate: string | null;
}

export interface SaveInput {
  caseId: string;
  /** Snapshot version the editor content was based on; null for the first save. */
  baseSnapshotVersionId: string | null;
  saveKey: string;
  imageVersionId: string;
  snapshotJson: string;
  exportPng: Blob;
}

export interface SaveResult {
  revision: MarkupRevision;
  /** True when this save key had already been committed (retry) and nothing new was written. */
  reused: boolean;
}

export interface MarkupApi {
  readonly kind: 'salesforce' | 'mock';
  latest(caseId: string): Promise<MarkupRevision | null>;
  save(input: SaveInput): Promise<SaveResult>;
}

/** Another session saved since this editor's base revision: nothing was written. */
export class MarkupConflictError extends Error {
  readonly current: MarkupRevision | null;
  constructor(current: MarkupRevision | null, message = 'The markup was saved by another session since you opened it.') {
    super(message);
    this.name = 'MarkupConflictError';
    this.current = current;
  }
}

export function parseMeta(description: string | null | undefined): Record<string, string> {
  const meta: Record<string, string> = {};
  if (!description || !description.startsWith(META_PREFIX)) return meta;
  for (const part of description.slice(META_PREFIX.length).split(';')) {
    const eq = part.indexOf('=');
    if (eq > 0) meta[part.slice(0, eq)] = part.slice(eq + 1);
  }
  return meta;
}

export function snapshotMeta(rev: number, saveKey: string, imageVersionId: string, base: string | null): string {
  return `${META_PREFIX}kind=snapshot;rev=${rev};save=${saveKey};image=${imageVersionId};base=${base ?? 'none'}`;
}

export function exportMeta(rev: number, saveKey: string, snapshotVersionId: string): string {
  return `${META_PREFIX}kind=export;rev=${rev};save=${saveKey};snapshot=${snapshotVersionId}`;
}

/** Latest revision from a case's File list (same rules as the Apex service). */
export function latestFromFiles(files: CaseFileInfo[]): MarkupRevision | null {
  let best: MarkupRevision | null = null;
  const exportBySave = new Map<string, string>();
  for (const f of files) {
    const m = parseMeta(f.description);
    if (m.kind === 'export' && m.save) exportBySave.set(m.save, f.latestVersionId);
    if (m.kind !== 'snapshot' || !m.rev) continue;
    const rev = Number(m.rev);
    if (!best || rev > best.rev) {
      best = {
        rev,
        saveKey: m.save ?? '',
        snapshotVersionId: f.latestVersionId,
        exportVersionId: null,
        imageVersionId: m.image ?? '',
        baseSnapshotVersionId: m.base && m.base !== 'none' ? m.base : null,
        createdDate: f.createdDate,
      };
    }
  }
  if (best) best.exportVersionId = exportBySave.get(best.saveKey) ?? null;
  return best;
}
