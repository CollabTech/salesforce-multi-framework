/**
 * SMF-12 markup sync service on Cloudflare Workers (hosting option; same protocol as the
 * Node server). Follows the tldraw sync-cloudflare template's current persistence design:
 * one Durable Object per room with SQLite-backed storage (DurableObjectSqliteSyncWrapper +
 * SQLiteSyncStorage). Images are NOT stored here: every client resolves the case image from
 * Salesforce Files with its own user access (asset:sfcv/<ContentVersion Id>).
 *
 * Secret: SMF12_ROOM_TOKEN_SECRET (wrangler secret, set by the owner). Without it /mint and
 * /connect return 503 and /health reports secretConfigured=false (the deploy stage then
 * reports BLOCKED).
 */
import { DurableObject } from 'cloudflare:workers';
import { DurableObjectSqliteSyncWrapper, SQLiteSyncStorage, TLSocketRoom } from '@tldraw/sync-core';
import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas, type TLRecord } from '@tldraw/tlschema';
import { MIN_SECRET_LENGTH, mint, roomFromPath, safeEqual, verifyToken, type RoomClaims } from '../shared/token';

export interface Env {
  SMF12_ROOM_TOKEN_SECRET?: string;
  SMF12_RECHECK_MS?: string;
  SMF12_ALLOWED_ORIGINS?: string;
  TLDRAW_DURABLE_OBJECT: DurableObjectNamespace<TldrawDurableObject>;
}

const schema = createTLSchema({ shapes: defaultShapeSchemas, bindings: defaultBindingSchemas });
const nowSeconds = (): number => Math.floor(Date.now() / 1000);
const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function secretOf(env: Env): string | null {
  const s = env.SMF12_ROOM_TOKEN_SECRET;
  return s && s.length >= MIN_SECRET_LENGTH ? s : null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const secret = secretOf(env);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json(200, { ok: true, secretConfigured: !!secret });
    }
    if (!secret) return json(503, { message: 'SMF12_ROOM_TOKEN_SECRET not configured' });

    if (request.method === 'POST' && url.pathname === '/mint') {
      if (!safeEqual(request.headers.get('x-smf-mint-key'), secret)) return new Response(null, { status: 401 });
      try {
        const minted = await mint(await request.json(), secret, nowSeconds(), crypto.randomUUID());
        return json(200, { ...minted, wsUrl: `wss://${url.host}` });
      } catch (e) {
        return json(400, { message: e instanceof Error ? e.message : 'bad request' });
      }
    }

    const room = roomFromPath(url.pathname);
    if (!room) return new Response(null, { status: 404 });
    if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') return new Response(null, { status: 426 });
    const allowed = (env.SMF12_ALLOWED_ORIGINS ?? '').split(',').map(s => s.trim()).filter(Boolean);
    const origin = request.headers.get('origin');
    if (allowed.length && (!origin || !allowed.includes(origin))) return new Response(null, { status: 403 });
    const result = await verifyToken(url.searchParams.get('token'), secret, room, nowSeconds());
    if (!result.ok) return new Response(null, { status: result.reason === 'wrong-room' ? 403 : 401 });

    const stub = env.TLDRAW_DURABLE_OBJECT.get(env.TLDRAW_DURABLE_OBJECT.idFromName(room));
    const forwarded = new Request(request);
    forwarded.headers.set('x-smf-claims', JSON.stringify(result.claims));
    return stub.fetch(forwarded);
  },
};

interface Connection {
  socket: WebSocket;
  sessionId: string;
  claims: RoomClaims;
}

export class TldrawDurableObject extends DurableObject<Env> {
  private room: TLSocketRoom<TLRecord, void> | null = null;
  private readonly connections = new Set<Connection>();

  private getRoom(): TLSocketRoom<TLRecord, void> {
    if (!this.room || this.room.isClosed()) {
      const storage = new SQLiteSyncStorage<TLRecord>({ sql: new DurableObjectSqliteSyncWrapper(this.ctx.storage) });
      this.room = new TLSocketRoom<TLRecord, void>({ schema, storage });
    }
    return this.room;
  }

  async fetch(request: Request): Promise<Response> {
    // Only reachable through the Worker above, which has already verified the token.
    const claims = JSON.parse(request.headers.get('x-smf-claims') ?? 'null') as RoomClaims | null;
    if (!claims) return new Response(null, { status: 401 });
    const sessionId = new URL(request.url).searchParams.get('sessionId') ?? crypto.randomUUID();
    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    server.accept();
    const conn: Connection = { socket: server, sessionId, claims };
    this.connections.add(conn);
    server.addEventListener('close', () => this.connections.delete(conn));
    this.getRoom().handleSocketConnect({ sessionId, socket: server });
    await this.scheduleRecheck();
    return new Response(null, { status: 101, webSocket: client });
  }

  private async scheduleRecheck(): Promise<void> {
    const ms = Number(this.env.SMF12_RECHECK_MS ?? 15_000);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(Date.now() + ms);
  }

  /** Periodic re-check: close sessions whose token has expired (client re-mints to continue). */
  async alarm(): Promise<void> {
    const now = nowSeconds();
    for (const c of this.connections) {
      if (c.claims.exp <= now) {
        this.connections.delete(c);
        c.socket.close(4001, 'token expired');
      }
    }
    if (this.connections.size > 0) await this.scheduleRecheck();
  }
}
