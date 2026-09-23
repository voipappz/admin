// Probe the portal's /ws/events with a REAL session, and say exactly which
// stage refuses us. Run it via `make probe AUTH='<localStorage.auth>'`.
//
// This goes through the portal rather than straight at va-crystal's cable,
// because that is the path a browser and the Chrome extension actually take.
// Probing cable directly proved a hop no client uses and skipped the two that
// fail most often: the portal's own token verification, and the socket
// upgrade behind it.
//
// The stages are distinct and mean different things:
//
//   HTTP 401 / immediate close  -> the TOKEN was refused: the portal verifies
//                                  it locally against its own signing key, and
//                                  a token another platform issued fails there.
//   welcome, cable_ready:false  -> you are authenticated; the portal has no
//                                  upstream cable. Check CABLE_URL.
//   welcome, no frames          -> in, but this user produced no events.
//
// Node only (>= 22, for the global WebSocket) — no deno, no build step.

const PORTAL = process.env.PORTAL_URL || 'http://localhost:4001';
const SECONDS = Number(process.env.SECONDS || 30);

// The whole `localStorage.auth` blob is the easiest thing to copy out of
// devtools, so accept that and pick the fields out of it. TOKEN stays available
// for a token that did not come from a browser session.
function credentials() {
  const token = (process.env.TOKEN || '').trim();
  if (token) return { token, id: (process.env.ID || '').trim() };

  const auth = (process.env.AUTH || '').trim();
  if (!auth) {
    console.error('Need a session. Either:');
    console.error("  make probe AUTH='<paste localStorage.auth here>'");
    console.error('  make probe TOKEN=<jwt>');
    process.exit(2);
  }
  let parsed;
  try {
    parsed = JSON.parse(auth);
  } catch {
    console.error('AUTH is not JSON. Copy the whole value of localStorage.auth, quoted:');
    console.error(`  make probe AUTH='{"access":"…","user_uuid":"…"}'`);
    process.exit(2);
  }
  const resolved = { token: parsed.access, id: parsed.user_uuid || '' };
  if (!resolved.token) {
    console.error('AUTH is missing "access" — is the session complete?');
    process.exit(2);
  }
  return resolved;
}

const { token, id } = credentials();

// The contract carries the token as a SUBPROTOCOL, not a query parameter: a URL
// is written verbatim into every proxy and access log on the way through.
// base64url, unpadded — see docs/REALTIME_CONTRACT.md in the chrome repo.
const subprotocol =
  'voipappz-bearer.' + Buffer.from(token, 'utf8').toString('base64url');

const wsUrl = PORTAL.replace(/^http/, 'ws').replace(/\/$/, '') + '/ws/events';

// Tokens are credentials — print only enough to tell two of them apart, and
// enough shape to spot the "opaque, not a JWT" case that cannot verify.
const segments = token.split('.').length;
console.log(`portal    ${wsUrl}`);
if (id) console.log(`user      ${id}`);
console.log(
  `token     ${token.slice(0, 8)}…${token.slice(-4)} (${token.length} chars, ${segments} dot-segments` +
    `${segments === 3 ? ' — looks like a JWT' : ' — NOT a JWT, the issuer cannot decode this'})`,
);
console.log(`listening ${SECONDS}s\n`);

const t0 = Date.now();
const ms = () => String(Date.now() - t0).padStart(6);
let welcomed = false;
let cableReady = null;
let frames = 0;

const ws = new WebSocket(wsUrl, [subprotocol]);

ws.addEventListener('open', () => console.log(`${ms()}  ws open`));
ws.addEventListener('error', () => console.log(`${ms()}  ws error`));

ws.addEventListener('message', (ev) => {
  const raw = String(ev.data);
  let frame;
  try {
    frame = JSON.parse(raw);
  } catch {
    console.log(`${ms()}  unparsed ${raw.slice(0, 200)}`);
    return;
  }

  if (frame.type === 'welcome') {
    welcomed = true;
    cableReady = frame.cable_ready;
    console.log(`${ms()}  welcome  cable_ready=${frame.cable_ready} subscribed=${JSON.stringify(frame.subscribed)}`);
    return;
  }

  frames++;
  console.log(`${ms()}  ${frame.type} #${frames} ${JSON.stringify(frame).slice(0, 800)}`);
});

ws.addEventListener('close', (ev) => {
  console.log(`${ms()}  close code=${ev.code} reason=${JSON.stringify(ev.reason)}`);
  console.log(`\nwelcome=${welcomed} cable_ready=${cableReady} frames=${frames}`);
  if (!welcomed) {
    console.log('\n>> TOKEN REFUSED — closed before the welcome frame.');
    console.log('   The portal verifies the token locally, against its own signing key,');
    console.log('   before the socket exists. A token issued by another platform, or an');
    console.log('   expired one, fails there — the fix is a fresh login, not the socket.');
  } else if (cableReady === false) {
    console.log('\n>> AUTHENTICATED, but the portal has no upstream cable.');
    console.log('   Check CABLE_URL, and that the node is up (make cable).');
  } else if (frames === 0) {
    console.log('\n>> CONNECTED, but this user produced no events while listening.');
    console.log('   Place or receive a call on that extension and run it again.');
  } else {
    console.log('\n>> WORKING end to end.');
  }
  process.exit(welcomed ? 0 : 1);
});

setTimeout(() => {
  try {
    ws.close();
  } catch {
    /* already gone */
  }
}, SECONDS * 1000);
