// A FreeSWITCH event socket, faked — the one component of the chain that is
// not real in tests/cable-events, because a switch needs a SIP plane and the
// events under test do not.
//
// The node is an ESL CLIENT: it dials FREESWITCH_HOST:FREESWITCH_PORT, is
// greeted with `auth/request`, answers `auth <password>`, then `event json
// all`, and from then on reads `text/event-json` frames. This speaks exactly
// that (mirrors va-crystal clients/state-client/test/fake-freeswitch.ts) and
// adds one thing a test needs: an HTTP door to push an event through —
//
//   POST /emit   {"Event-Name":"CUSTOM", ...}   -> written to every authed node
//   GET  /health                                -> {"clients":n,"authed":n}
//
// so a scenario can say "FreeSWITCH reported an agent answering" and watch
// what the node makes of it, all the way to the browser. Plain Node, no deps,
// run from node:22-alpine on the host network.
import net from 'node:net';
import http from 'node:http';

const ESL_PORT = Number(process.env.ESL_PORT || 18021);
const HTTP_PORT = Number(process.env.HTTP_PORT || 18022);
const PASSWORD = process.env.ESL_PASSWORD || 'ClueCon';

// ESL frames: header block, blank line, then Content-Length bytes of body.
const frame = (headers, body) => {
  const head = Object.entries(headers).map(([k, v]) => `${k}: ${v}`).join('\n');
  if (body === undefined) return `${head}\n\n`;
  return `${head}\nContent-Length: ${Buffer.byteLength(body, 'utf8')}\n\n${body}`;
};

const clients = new Map(); // socket -> { authed, subscribed }
const log = (...a) => console.log(new Date().toISOString(), 'fake-freeswitch:', ...a);

const esl = net.createServer((socket) => {
  const state = { authed: false, subscribed: false };
  clients.set(socket, state);
  socket.setNoDelay(true);
  socket.on('error', () => clients.delete(socket));
  socket.on('close', () => { clients.delete(socket); log('node disconnected'); });
  log('node connected from', socket.remoteAddress + ':' + socket.remotePort);
  socket.write(frame({ 'Content-Type': 'auth/request' }));

  let buffer = '';
  socket.on('data', (chunk) => {
    buffer += chunk.toString();
    let idx;
    while ((idx = buffer.indexOf('\n')) !== -1) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      if (line.startsWith('auth ')) {
        state.authed = line.slice(5).trim() === PASSWORD;
        socket.write(frame({ 'Content-Type': 'command/reply', 'Reply-Text': state.authed ? '+OK accepted' : '-ERR invalid' }));
        log(state.authed ? 'node authenticated' : 'node sent a wrong password');
      } else if (line.startsWith('event ')) {
        state.subscribed = true;
        socket.write(frame({ 'Content-Type': 'command/reply', 'Reply-Text': '+OK event listener enabled json' }));
        log('node subscribed:', line);
      } else {
        // api/… and anything else: acknowledge so the client is never blocked.
        socket.write(frame({ 'Content-Type': 'command/reply', 'Reply-Text': '+OK' }));
      }
    }
  });
});

const ready = () => [...clients.values()].filter((s) => s.authed && s.subscribed).length;

const emit = (event) => {
  const payload = frame({ 'Content-Type': 'text/event-json' }, JSON.stringify(event));
  let n = 0;
  for (const [socket, state] of clients) if (state.authed && state.subscribed) { socket.write(payload); n++; }
  return n;
};

const control = http.createServer((req, res) => {
  const json = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (req.method === 'GET' && req.url === '/health') return json(200, { clients: clients.size, authed: ready() });
  if (req.method === 'POST' && req.url === '/emit') {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      let event;
      try { event = JSON.parse(body); } catch { return json(400, { error: 'body must be a JSON object of ESL headers' }); }
      const delivered = emit(event);
      log('emitted', event['Event-Name'], event['CC-Action'] || '', '->', delivered, 'consumer(s)');
      // 0 consumers is the caller's problem to notice: the node reconnects to
      // ESL with a backoff, and an event emitted before that is simply gone.
      json(delivered ? 200 : 503, { delivered });
    });
    return;
  }
  json(404, { error: 'GET /health or POST /emit' });
});

esl.listen(ESL_PORT, '0.0.0.0', () => log('ESL listening on', ESL_PORT));
control.listen(HTTP_PORT, '127.0.0.1', () => log('control on', HTTP_PORT));
