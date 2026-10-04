// Localhost smoke test of the Cloudflare Worker build under `wrangler dev --local` (workerd).
// Usage: SMF12_URL=http://127.0.0.1:8799 SMF12_TEST_KEY=<same throwaway key passed with --var> node test/worker-smoke.mjs
// (start wrangler dev with --var SMF12_ALLOW_ANY_ORIGIN:1; the deployed Worker denies unlisted origins)
// Checks: health, mint-key guard, mint, WebSocket accept with a valid token, refusal of no /
// wrong-room / expired tokens; push revocation (/revoke) closes the live session (4003), refuses the
// earlier token and accepts one minted after the revocation. Prints one JSON line; exit 1 on any mismatch.
import WebSocket from 'ws';

const base = process.env.SMF12_URL ?? 'http://127.0.0.1:8799';
const key = process.env.SMF12_TEST_KEY ?? '';
const user = ['005', 'TESTUSER0001AAA'].join('');
const caseA = ['500', 'TESTCASE0001AAA'].join('');
const caseB = ['500', 'TESTCASE0002AAA'].join('');
const results = {};

async function mint(caseId, k = key, ttlSeconds = 60) {
  const r = await fetch(`${base}/mint`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-smf-mint-key': k }, body: JSON.stringify({ userId: user, caseId, ttlSeconds }) });
  return { status: r.status, body: r.status === 200 ? await r.json() : null };
}
function ws(room, token) {
  return new Promise(resolve => {
    const s = new WebSocket(`${base.replace('http', 'ws')}/connect/${room}${token ? `?token=${encodeURIComponent(token)}&sessionId=smoke` : ''}`);
    s.on('open', () => { s.close(); resolve(101); });
    s.on('unexpected-response', (_q, res) => resolve(res.statusCode));
    s.on('error', () => resolve('error'));
  });
}

results.health = await (await fetch(`${base}/health`)).json();
results.mintBadKey = (await mint(caseA, 'wrong')).status;
const a = await mint(caseA);
const b = await mint(caseB);
results.mint = a.status;
results.validToken = await ws(a.body.room, a.body.token);
results.noToken = await ws(a.body.room);
results.wrongRoom = await ws(b.body.room, a.body.token);
const short = await mint(caseA, key, 5);
await new Promise(r => setTimeout(r, 6500));
results.expiredToken = await ws(short.body.room, short.body.token);
// push revocation (A2)
const user2 = ['005', 'TESTUSER0002AAA'].join('');
const issued = await (await fetch(`${base}/mint`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-smf-mint-key': key }, body: JSON.stringify({ userId: user2, caseId: caseA, ttlSeconds: 300 }) })).json();
const live = new WebSocket(`${base.replace('http', 'ws')}/connect/${issued.room}?token=${encodeURIComponent(issued.token)}&sessionId=smoke-live`);
await new Promise(r => live.on('open', r));
const cut = new Promise(r => live.on('close', code => r({ code, at: Date.now() })));
const revokeBadKey = await fetch(`${base}/revoke`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-smf-mint-key': 'wrong' }, body: JSON.stringify({ userId: user2, caseId: caseA }) });
results.revokeBadKey = revokeBadKey.status;
const t0 = Date.now();
const rv = await fetch(`${base}/revoke`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-smf-mint-key': key }, body: JSON.stringify({ userId: user2, caseId: caseA }) });
results.revoke = { status: rv.status, ...(await rv.json()) };
const c = await Promise.race([cut, new Promise(r => setTimeout(() => r({ code: 'not closed', at: Date.now() }), 5000))]);
results.liveCut = { code: c.code, afterMs: c.at - t0 };
results.oldTokenAfterRevoke = await ws(issued.room, issued.token);
await new Promise(r => setTimeout(r, 1100)); // a token minted in a later second than the revocation
const fresh = await (await fetch(`${base}/mint`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-smf-mint-key': key }, body: JSON.stringify({ userId: user2, caseId: caseA, ttlSeconds: 60 }) })).json();
results.freshTokenAfterRevoke = await ws(fresh.room, fresh.token);
console.log(JSON.stringify(results));
const ok = results.revokeBadKey === 401 && results.revoke.status === 200 && results.revoke.closed === 1 && results.liveCut.code === 4003
  && results.oldTokenAfterRevoke === 401 && results.freshTokenAfterRevoke === 101 && results.health.secretConfigured === true && results.mintBadKey === 401 && results.mint === 200 && results.validToken === 101 && results.noToken === 401 && results.wrongRoom === 403 && results.expiredToken === 401;
process.exit(ok ? 0 : 1);
