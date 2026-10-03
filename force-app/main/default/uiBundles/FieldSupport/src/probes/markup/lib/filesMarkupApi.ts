/**
 * MarkupApi implemented on top of a FilesTransport, used ONLY with the localhost mock.
 * It mirrors the Apex rules (stale base → conflict, same save key → reuse) but runs the
 * check and the writes client-side, so it is not atomic; the Salesforce implementation
 * commits under a Case row lock instead.
 */
import type { FilesTransport } from '../../files/lib';
import {
  EXPORT_TITLE,
  MarkupConflictError,
  SNAPSHOT_TITLE,
  exportMeta,
  latestFromFiles,
  parseMeta,
  snapshotMeta,
  type MarkupApi,
  type MarkupRevision,
  type SaveInput,
  type SaveResult,
} from './markupApi';

export function createFilesMarkupApi(transport: FilesTransport): MarkupApi {
  const bodies = new Map<string, { snapshot?: string; export?: string }>();
  return {
    kind: 'mock',

    async latest(caseId: string): Promise<MarkupRevision | null> {
      return latestFromFiles(await transport.listCaseFiles(caseId));
    },

    async save(input: SaveInput): Promise<SaveResult> {
      const files = await transport.listCaseFiles(input.caseId);
      const latest = latestFromFiles(files);
      if (latest && latest.saveKey === input.saveKey) return { revision: latest, reused: true };
      if ((latest?.snapshotVersionId ?? null) !== input.baseSnapshotVersionId) throw new MarkupConflictError(latest);
      const imageLinked = files.some(f => f.latestVersionId === input.imageVersionId && !parseMeta(f.description).kind);
      if (!imageLinked) throw new Error('The image is not linked to this case.');

      const cached = bodies.get(input.saveKey) ?? {};
      bodies.set(input.saveKey, cached);
      cached.snapshot ??= await transport.uploadBody(new File([input.snapshotJson], 'snapshot.json', { type: 'application/json' }));
      cached.export ??= await transport.uploadBody(new File([input.exportPng], 'export.png', { type: 'image/png' }));

      const rev = (latest?.rev ?? 0) + 1;
      const snapshotVersionId = await transport.createVersion({
        recordId: input.caseId,
        fileName: `${SNAPSHOT_TITLE}${rev}.json`,
        contentBodyId: cached.snapshot,
        description: snapshotMeta(rev, input.saveKey, input.imageVersionId, input.baseSnapshotVersionId),
      });
      const exportVersionId = await transport.createVersion({
        recordId: input.caseId,
        fileName: `${EXPORT_TITLE}${rev}.png`,
        contentBodyId: cached.export,
        description: exportMeta(rev, input.saveKey, snapshotVersionId),
      });
      bodies.delete(input.saveKey);
      return {
        reused: false,
        revision: {
          rev,
          saveKey: input.saveKey,
          snapshotVersionId,
          exportVersionId,
          imageVersionId: input.imageVersionId,
          baseSnapshotVersionId: input.baseSnapshotVersionId,
          createdDate: new Date().toISOString(),
        },
      };
    },
  };
}
