// One WebSocket join attempt with a given room token and Origin; prints the HTTP status
// (101 = joined, 401/403 = refused) and exits 0. Used by the SYNC-03 access-change cloud runs to
// test a previously issued token after access was removed. The token is never printed.
// Env: SMF12_WS_URL (wss://…), SMF12_ROOM, SMF12_TOKEN, SMF12_ORIGIN
import WebSocket from 'ws';

const { SMF12_WS_URL: base, SMF12_ROOM: room, SMF12_TOKEN: token, SMF12_ORIGIN: origin } = process.env;
if (!base || !room || !token || !origin) {
  console.error('usage: SMF12_WS_URL SMF12_ROOM SMF12_TOKEN SMF12_ORIGIN must be set');
  process.exit(2);
}
const status = await new Promise(resolve => {
  const s = new WebSocket(`${base}/connect/${room}?token=${encodeURIComponent(token)}&sessionId=sync03-${Date.now()}`, { origin });
  const timer = setTimeout(() => { s.terminate(); resolve('timeout'); }, 15000);
  s.on('open', () => { clearTimeout(timer); s.close(); resolve(101); });
  s.on('unexpected-response', (_q, res) => { clearTimeout(timer); resolve(res.statusCode); });
  s.on('error', () => { clearTimeout(timer); resolve('error'); });
});
console.log(String(status));
