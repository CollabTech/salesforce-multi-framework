import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tldraw, UserRecordType, computed, createUserId, useValue, type Editor, type TLAssetStore } from 'tldraw';
import 'tldraw/tldraw.css';
import { useSync } from '@tldraw/sync';
import { getAssetUrlsByImport } from '@tldraw/assets/imports.vite';
import { licenseKeyFromBuild } from '../markup/lib';
import { connectUri, type TokenSource } from './lib/tokenSource';

const assetUrls = getAssetUrlsByImport();

export interface LiveRoomProps {
  caseId: string;
  userId: string;
  userName: string;
  color: string;
  tokenSource: TokenSource;
  assetStore: TLAssetStore;
  onEditor: (editor: Editor | null) => void;
  onStatus: (status: string) => void;
}

/** Joins the case's live markup room. The token is re-minted on every (re)connect. */
export default function LiveRoom({ caseId, userId, userName, color, tokenSource, assetStore, onEditor, onStatus }: LiveRoomProps) {
  const [mintError, setMintError] = useState<string | null>(null);
  const users = useMemo(
    () => ({ currentUser: computed('smf12-current-user', () => UserRecordType.create({ id: createUserId(userId), name: userName, color })) }),
    [userId, userName, color]
  );
  // Stable callback: useSync reconnects (and re-mints) only on connection loss, not on render.
  const uri = useCallback(async () => {
    try {
      const ticket = await tokenSource.mint(caseId);
      setMintError(null);
      return connectUri(ticket);
    } catch (e) {
      setMintError(e instanceof Error ? e.message : String(e));
      throw e;
    }
  }, [caseId, tokenSource]);
  const store = useSync({ uri, assets: assetStore, users });

  const statusText =
    store.status === 'synced-remote'
      ? `synced (${store.connectionStatus})`
      : store.status === 'error'
        ? `error: ${store.error.message}`
        : 'connecting';
  const fullStatus = mintError ? `${statusText}; token: ${mintError}` : statusText;
  useEffect(() => onStatus(fullStatus), [fullStatus, onStatus]);

  if (store.status !== 'synced-remote') {
    return (
      <p data-testid="room-status" className="p-4 text-sm">
        {fullStatus}
      </p>
    );
  }
  return (
    <Tldraw
      store={store.store}
      assetUrls={assetUrls}
      licenseKey={licenseKeyFromBuild()}
      onMount={editor => {
        onEditor(editor);
        return () => onEditor(null);
      }}
    />
  );
}

/** Names of other people currently in the room (tldraw presence). */
export function usePresence(editor: Editor | null): string[] {
  return useValue('smf12-presence', () => (editor ? editor.getCollaborators().map(c => c.userName) : []), [editor]);
}
