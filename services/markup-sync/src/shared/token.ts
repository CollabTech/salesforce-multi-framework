/**
 * SMF-12 room tokens: short-lived HMAC-SHA256 tokens binding a Salesforce user and case to
 * one markup room. Web Crypto only, so the same code runs in Node 22 and Cloudflare Workers.
 *
 * Format: "v1.<base64url(JSON claims)>.<base64url(HMAC-SHA256(secret, 'v1.' + payload))>"
 * The signing secret never leaves the sync service (env SMF12_ROOM_TOKEN_SECRET); Salesforce
 * asks for tokens through the authenticated /mint endpoint after its own access check.
 */
export interface RoomClaims {
  v: 1;
  /** Salesforce user Id (15/18 chars). */
  sub: string;
  /** Salesforce Case Id (18 chars). */
  case: string;
  /** Room derived from the case (see roomIdForCase). */
  room: string;
  /** Display name for presence (optional, not an identifier). */
  name?: string;
  iat: number;
  exp: number;
  jti: string;
}

export const MAX_TTL_SECONDS = 900;
export const DEFAULT_TTL_SECONDS = 300;
export const MIN_SECRET_LENGTH = 32;
const ID = /^[A-Za-z0-9]{15}(?:[A-Za-z0-9]{3})?$/;

export type VerifyFailure = 'missing' | 'malformed' | 'bad-signature' | 'expired' | 'not-yet-valid' | 'wrong-room';
export type VerifyResult = { ok: true; claims: RoomClaims } | { ok: false; reason: VerifyFailure };

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(text: string): Uint8Array {
  const pad = text.length % 4 === 0 ? '' : '='.repeat(4 - (text.length % 4));
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/') + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export function isSalesforceId(value: unknown): value is string {
  return typeof value === 'string' && ID.test(value);
}

export function assertSecret(secret: string | undefined): string {
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`SMF12_ROOM_TOKEN_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters`);
  }
  return secret;
}

/** Room id for a case: not the case Id itself, stable for every user of that case. */
export async function roomIdForCase(caseId: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(`smf12-room:${caseId.slice(0, 15)}`)));
  return `mf-${[...digest.slice(0, 16)].map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

export async function signToken(claims: RoomClaims, secret: string): Promise<string> {
  const payload = b64url(enc.encode(JSON.stringify(claims)));
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(`v1.${payload}`)));
  return `v1.${payload}.${b64url(sig)}`;
}

export async function verifyToken(token: string | null | undefined, secret: string, room: string, nowSeconds: number): Promise<VerifyResult> {
  if (!token) return { ok: false, reason: 'missing' };
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1') return { ok: false, reason: 'malformed' };
  let sig: Uint8Array;
  let claims: RoomClaims;
  try {
    sig = fromB64url(parts[2]);
    claims = JSON.parse(new TextDecoder().decode(fromB64url(parts[1]))) as RoomClaims;
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  const valid = await crypto.subtle.verify('HMAC', await hmacKey(secret), sig as BufferSource, enc.encode(`v1.${parts[1]}`));
  if (!valid) return { ok: false, reason: 'bad-signature' };
  if (claims.v !== 1 || !isSalesforceId(claims.sub) || !isSalesforceId(claims.case) || typeof claims.exp !== 'number') {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.iat > nowSeconds + 30) return { ok: false, reason: 'not-yet-valid' };
  if (claims.exp <= nowSeconds) return { ok: false, reason: 'expired' };
  if (claims.room !== room) return { ok: false, reason: 'wrong-room' };
  return { ok: true, claims };
}

export interface MintRequest {
  userId: string;
  caseId: string;
  ttlSeconds?: number;
  displayName?: string;
}

export interface MintResponse {
  token: string;
  room: string;
  expiresAt: number;
}

/** Validates a mint request (from the Salesforce side) and signs a token for the case room. */
export async function mint(req: unknown, secret: string, nowSeconds: number, jti: string): Promise<MintResponse> {
  const r = req as Partial<MintRequest> | null;
  if (!r || !isSalesforceId(r.userId) || !isSalesforceId(r.caseId)) throw new Error('userId and caseId must be Salesforce Ids');
  const ttl = Math.max(5, Math.min(MAX_TTL_SECONDS, Math.floor(r.ttlSeconds ?? DEFAULT_TTL_SECONDS)));
  const room = await roomIdForCase(r.caseId);
  const name = typeof r.displayName === 'string' ? r.displayName.slice(0, 80) : undefined;
  const claims: RoomClaims = { v: 1, sub: r.userId, case: r.caseId, room, name, iat: nowSeconds, exp: nowSeconds + ttl, jti };
  return { token: await signToken(claims, secret), room, expiresAt: claims.exp };
}

/** Constant-time comparison for the mint key header. */
export function safeEqual(a: string | null | undefined, b: string): boolean {
  if (typeof a !== 'string') return false;
  const x = enc.encode(a);
  const y = enc.encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/** Parses "/connect/<room>" (room ids are "mf-" + 32 hex). */
export function roomFromPath(pathname: string): string | null {
  const m = /^\/connect\/(mf-[0-9a-f]{32})$/.exec(pathname);
  return m ? m[1] : null;
}

/**
 * WebSocket Origin policy (fail closed): a connection is allowed only when its Origin header is
 * in the configured allowlist. An empty allowlist denies everything unless allowAny is set, which
 * is only for loopback tests (SMF12_ALLOW_ANY_ORIGIN=1). Deploy stage 49 sets the allowlist to the
 * Salesforce origin it observed and verifies it before any live-sync test.
 */
export function parseOrigins(value: string | undefined): string[] {
  return (value ?? '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
}

export function originAllowed(origin: string | null | undefined, allowed: readonly string[], allowAny = false): boolean {
  if (allowAny) return true;
  return !!origin && allowed.includes(origin);
}

/**
 * Push revocation (finding A2; SMF-12 AC4, SYNC-03). Salesforce (SMF12_AccessSweep) calls
 * POST /revoke {userId, caseId} with the mint key when a user who was issued a token for that
 * case no longer passes the issuance checks. The service then closes that user's live sessions
 * in the case room and refuses every token for (user, room) issued at or before the revocation.
 * A token minted afterwards (access restored, Apex check passed again) is accepted. Entries can
 * be dropped after MAX_TTL_SECONDS, because every token they block has expired by then.
 */
export interface RevokeRequest {
  userId: string;
  caseId: string;
}

export function parseRevoke(req: unknown): RevokeRequest {
  const r = req as Partial<RevokeRequest> | null;
  if (!r || !isSalesforceId(r.userId) || !isSalesforceId(r.caseId)) throw new Error('userId and caseId must be Salesforce Ids');
  return { userId: r.userId, caseId: r.caseId };
}

/** Key for a revoked user (15-char Id, so 15/18-char forms match). */
export function userKey(userId: string): string {
  return userId.slice(0, 15);
}

/** True when a revocation recorded at revokedAt (epoch s) blocks a token with these claims. */
export function revokedBy(claims: Pick<RoomClaims, 'iat'>, revokedAt: number | undefined): boolean {
  return typeof revokedAt === 'number' && claims.iat <= revokedAt;
}

/** In-memory revocation list keyed by (room, user), for the Node server. */
export class Revocations {
  private readonly byKey = new Map<string, number>();

  revoke(room: string, userId: string, at: number): void {
    this.prune(at);
    this.byKey.set(`${room}|${userKey(userId)}`, at);
  }

  blocks(claims: Pick<RoomClaims, 'room' | 'sub' | 'iat'>): boolean {
    return revokedBy(claims, this.byKey.get(`${claims.room}|${userKey(claims.sub)}`));
  }

  prune(now: number): void {
    for (const [k, at] of this.byKey) if (at + MAX_TTL_SECONDS < now) this.byKey.delete(k);
  }
}
