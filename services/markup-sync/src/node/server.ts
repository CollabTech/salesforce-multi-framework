/**
 * SMF-12 markup sync server (Node 22). Live transport only — Salesforce Files stays the
 * durable record (SMF-11 saves). Persistence: one SQLite file per room (node:sqlite +
 * tldraw SQLiteSyncStorage), written synchronously, so state survives a restart or crash.
 *
 * Endpoints
 *   GET  /health                         liveness (no room data)
 *   POST /mint   (X-SMF-Mint-Key)        Salesforce-side token mint (called by Apex via Named Credential)
 *   POST /revoke (X-SMF-Mint-Key)        Salesforce-side push revocation {userId, caseId} (SMF12_AccessSweep)
 *   WS   /connect/<room>?token=…&sessionId=…   requires a valid, unexpired, unrevoked token for that room
 *
 * Authorization: token verified on upgrade (signature, expiry, room) and re-checked every
 * SMF12_RECHECK_MS; an expired session is closed (non-fatal, so an authorized client
 * reconnects with a fresh token; a revoked user cannot mint one). Without push revocation the
 * worst-case delay is token TTL + re-check interval; /revoke closes the user's sessions in the
 * room at once and refuses tokens issued before it (see Revocations in shared/token.ts).
 */
import { createServer, type IncomingMessage, type Server } from 'node:http';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { NodeSqliteWrapper, SQLiteSyncStorage, TLSocketRoom } from '@tldraw/sync-core';
import { createTLSchema, defaultBindingSchemas, defaultShapeSchemas, type TLRecord } from '@tldraw/tlschema';
import { assertSecret, mint, originAllowed, parseOrigins, parseRevoke, Revocations, roomFromPath, roomIdForCase, safeEqual, userKey, verifyToken, type RoomClaims } from '../shared/token.js';

export interface SyncServerConfig {
  port: number;
  host: string;
  secret: string;
  dataDir: string;
  recheckMs: number;
  allowedOrigins: string[];
  /** Loopback tests only (SMF12_ALLOW_ANY_ORIGIN=1); otherwise an empty allowlist denies every connection. */
  allowAnyOrigin?: boolean;
  publicWsUrl?: string;
  log?: (event: Record<string, unknown>) => void;
}

interface Connection {
  ws: WebSocket;
  room: string;
  sessionId: string;
  claims: RoomClaims;
}

interface RoomHandle {
  room: TLSocketRoom<TLRecord, void>;
  db: DatabaseSync;
}

const schema = createTLSchema({ shapes: defaultShapeSchemas, bindings: defaultBindingSchemas });
const nowSeconds = (): number => Math.floor(Date.now() / 1000);

export interface RunningServer {
  server: Server;
  port: number;
  connections: () => number;
  close: () => Promise<void>;
}

export async function startSyncServer(config: SyncServerConfig): Promise<RunningServer> {
  const secret = assertSecret(config.secret);
  const log = config.log ?? ((e: Record<string, unknown>) => console.log(JSON.stringify({ ts: new Date().toISOString(), ...e })));
  mkdirSync(config.dataDir, { recursive: true });
  const rooms = new Map<string, RoomHandle>();
  const connections = new Set<Connection>();
  const revocations = new Revocations();
  const wss = new WebSocketServer({ noServer: true, maxPayload: 4 * 1024 * 1024 });

  function getRoom(roomId: string): RoomHandle {
    const existing = rooms.get(roomId);
    if (existing && !existing.room.isClosed()) return existing;
    const db = new DatabaseSync(join(config.dataDir, `${roomId}.sqlite`));
    const storage = new SQLiteSyncStorage<TLRecord>({ sql: new NodeSqliteWrapper(db) });
    // Rooms stay open until shutdown: closing on "last session removed" raced with a new
    // session joining the same room (seen in the localhost run). SQLite writes are synchronous,
    // so an open room holds no unpersisted state.
    const room = new TLSocketRoom<TLRecord, void>({ schema, storage });
    const handle = { room, db };
    rooms.set(roomId, handle);
    return handle;
  }

  function reject(socket: Duplex, status: number, text: string): void {
    socket.write(`HTTP/1.1 ${status} ${text}\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);
    socket.destroy();
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (req.method === 'GET' && url.pathname === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ ok: true, rooms: rooms.size, connections: connections.size }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/mint') {
      if (!safeEqual(header(req, 'x-smf-mint-key'), secret)) {
        log({ event: 'mint-denied', reason: 'bad-mint-key' });
        res.writeHead(401).end();
        return;
      }
      try {
        const body = JSON.parse(await readBody(req)) as unknown;
        const minted = await mint(body, secret, nowSeconds(), randomUUID());
        const wsUrl = config.publicWsUrl ?? `ws://${req.headers.host ?? `localhost:${config.port}`}`;
        log({ event: 'mint', room: minted.room, exp: minted.expiresAt });
        res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' }).end(JSON.stringify({ ...minted, wsUrl }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ message: e instanceof Error ? e.message : 'bad request' }));
      }
      return;
    }
    if (req.method === 'POST' && url.pathname === '/revoke') {
      if (!safeEqual(header(req, 'x-smf-mint-key'), secret)) {
        log({ event: 'revoke-denied', reason: 'bad-mint-key' });
        res.writeHead(401).end();
        return;
      }
      try {
        const r = parseRevoke(JSON.parse(await readBody(req)) as unknown);
        const room = await roomIdForCase(r.caseId);
        const at = nowSeconds();
        revocations.revoke(room, r.userId, at);
        let closed = 0;
        for (const c of connections) {
          if (c.room === room && userKey(c.claims.sub) === userKey(r.userId)) {
            connections.delete(c);
            c.ws.close(4003, 'access revoked');
            closed++;
          }
        }
        log({ event: 'revoke', room, closed });
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ revokedAt: at, closed }));
      } catch (e) {
        res.writeHead(400, { 'content-type': 'application/json' }).end(JSON.stringify({ message: e instanceof Error ? e.message : 'bad request' }));
      }
      return;
    }
    res.writeHead(404).end();
  });

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    void (async () => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const roomId = roomFromPath(url.pathname);
      if (!roomId) return reject(socket, 404, 'Not Found');
      const origin = header(req, 'origin');
      if (!originAllowed(origin, config.allowedOrigins, config.allowAnyOrigin === true)) {
        log({ event: 'connect-denied', reason: 'origin', room: roomId });
        return reject(socket, 403, 'Forbidden');
      }
      const result = await verifyToken(url.searchParams.get('token'), secret, roomId, nowSeconds());
      if (!result.ok) {
        log({ event: 'connect-denied', reason: result.reason, room: roomId });
        return reject(socket, result.reason === 'wrong-room' ? 403 : 401, result.reason === 'wrong-room' ? 'Forbidden' : 'Unauthorized');
      }
      if (revocations.blocks(result.claims)) {
        log({ event: 'connect-denied', reason: 'revoked', room: roomId });
        return reject(socket, 401, 'Unauthorized');
      }
      const sessionId = url.searchParams.get('sessionId') ?? randomUUID();
      wss.handleUpgrade(req, socket, head, ws => {
        const conn: Connection = { ws, room: roomId, sessionId, claims: result.claims };
        connections.add(conn);
        ws.on('close', () => connections.delete(conn));
        getRoom(roomId).room.handleSocketConnect({ sessionId, socket: ws });
        log({ event: 'connect', room: roomId, exp: result.claims.exp });
      });
    })();
  });

  // Periodic re-check: close sessions whose token has expired.
  const timer = setInterval(() => {
    const now = nowSeconds();
    for (const c of connections) {
      if (c.claims.exp <= now) {
        log({ event: 'session-expired', room: c.room, expiredFor: now - c.claims.exp });
        connections.delete(c);
        c.ws.close(4001, 'token expired');
      }
    }
  }, config.recheckMs);

  await new Promise<void>(resolve => server.listen(config.port, config.host, resolve));
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : config.port;
  log({ event: 'listening', port, recheckMs: config.recheckMs });

  return {
    server,
    port,
    connections: () => connections.size,
    close: async () => {
      clearInterval(timer);
      for (const c of connections) c.ws.close(1012, 'service restart');
      for (const { room, db } of rooms.values()) {
        room.close();
        db.close();
      }
      rooms.clear();
      wss.close();
      const closed = new Promise<void>(resolve => server.close(() => resolve()));
      server.closeAllConnections();
      await closed;
    },
  };
}

function header(req: IncomingMessage, name: string): string | undefined {
  const v = req.headers[name];
  return Array.isArray(v) ? v[0] : v;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > 16 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
      } else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function configFromEnv(env: NodeJS.ProcessEnv = process.env): SyncServerConfig {
  return {
    port: Number(env.PORT ?? 8787),
    host: env.HOST ?? '127.0.0.1',
    secret: assertSecret(env.SMF12_ROOM_TOKEN_SECRET),
    dataDir: env.SMF12_DATA_DIR ?? './data',
    recheckMs: Number(env.SMF12_RECHECK_MS ?? 15_000),
    allowedOrigins: parseOrigins(env.SMF12_ALLOWED_ORIGINS),
    allowAnyOrigin: env.SMF12_ALLOW_ANY_ORIGIN === '1',
    publicWsUrl: env.SMF12_PUBLIC_WS_URL,
  };
}

const isMain = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  let config: SyncServerConfig;
  try {
    config = configFromEnv();
  } catch (e) {
    console.error(`BLOCKED: ${e instanceof Error ? e.message : String(e)}`);
    process.exit(2);
  }
  process.on('uncaughtException', e => {
    console.error(JSON.stringify({ event: 'uncaught', message: e.message }));
    process.exit(1);
  });
  const running = await startSyncServer(config);
  const stop = (): void => {
    void running.close().then(() => process.exit(0));
  };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
