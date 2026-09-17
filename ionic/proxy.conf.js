// Dev-server proxy — makes `make serve` look like the ONE origin the app has
// in production.
//
// Served from the portal at /app the app is same-origin with everything it
// calls: no preflight, no CORS, no `access-control-allow-origin` to get wrong.
// The dev server is the only shape where the two are separate, so it proxies
// the portal's routes rather than letting the app reach :4001 cross-origin —
// otherwise the FIRST thing that breaks in dev is the login preflight, which
// cannot break in production and so sends you looking in the wrong place.
//
// A .js config and not .json so the target can come from the environment: the
// Makefile passes PORTAL, and `make serve PORTAL=https://nimbus-connectix...`
// points the local UI at a deployed portal without editing a file.
const target = process.env.PORTAL || 'http://localhost:4001';

// EVERY PATH THE PORTAL OWNS, and nothing else. A broader rule (`/a*`, say)
// would swallow the dev server's own asset requests and serve them from the
// portal, which 404s them — a blank page with no error anywhere obvious.
//
//   /auth      the login (performed BY the portal, Portal.AuthController)
//   /api       forwarded to the engine, plus the portal's own /api/events etc
//   /tasks     forwarded to the engine (customer_portal_data on every login)
//   /ws        the realtime socket — needs ws: true or it 400s on the upgrade
//   /release   what this node ships (version, the extension zip, this bundle)
//   /health    so a dev page can show the same status the monitor sees
const paths = ['/auth', '/api', '/tasks', '/ws', '/release', '/health'];

module.exports = paths.reduce((config, path) => {
  config[path] = {
    target,
    secure: false,
    changeOrigin: true,
    // The socket is at /ws/events. Without this the handshake is proxied as a
    // plain GET and answered 400, which surfaces in the app as a socket that
    // retries forever with no error message worth reading.
    ws: path === '/ws',
    logLevel: 'warn',
  };
  return config;
}, {});
