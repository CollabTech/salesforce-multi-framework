// Stage 49: verify the deployed Worker's Origin allowlist with a real room token from Salesforce.
// Inputs via environment only (the token is never on a command line or in output):
//   SMF12_WS_URL (wss://…), SMF12_ROOM, SMF12_TOKEN, SMF12_ALLOWED_ORIGIN
// Expected: allowed origin → 101; another origin → 403; no Origin header → 403.
// Prints one JSON line {allowed, other, none, pass} with HTTP statuses only.
import WebSocket from 'ws';

const { SMF12_WS_URL: base, SMF12_ROOM: room, SMF12_TOKEN: token, SMF12_ALLOWED_ORIGIN: allowed } = process.env;
if (!base || !room || !token || !allowed) {
  console.log(JSON.stringify({ pass: false, error: 'missing input' }));
  process.exit(2);
}
const url = `${base.replace(/\/+$/, '')}/connect/${room}?token=${encodeURIComponent(token)}&sessionId=origin-check-${Date.now()}`;

function attempt(origin) {
  return new Promise(resolve => {
    const ws = new WebSocket(url, origin ? { origin } : {});
    const timer = setTimeout(() => { ws.terminate(); resolve(0); }, 15_000);
    ws.on('open', () => { clearTimeout(timer); ws.close(); resolve(101); });
    ws.on('unexpected-response', (_req, res) => { clearTimeout(timer); resolve(res.statusCode ?? 0); });
    ws.on('error', () => undefined);
  });
}

const result = { allowed: await attempt(allowed), other: await attempt('https://origin-check.invalid'), none: await attempt(null) };
result.pass = result.allowed === 101 && result.other === 403 && result.none === 403;
console.log(JSON.stringify(result));
process.exit(result.pass ? 0 : 1);
