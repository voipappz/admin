import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * nginx.conf sets the Content-Security-Policy the browser enforces on the
 * built app. Without an explicit connect-src it falls back to default-src,
 * which lists http: and https: but not wss:, and the browser then blocks every
 * WebSocket: the softphone's SIP transport (wss://switch...:8443), ActionCable
 * and NATS. Nothing in the app reports why; the only trace is a console
 * violation. Pinned here so a header edit cannot quietly bring that back.
 */

const nginxConf = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../../nginx.conf'),
  'utf8'
);

const policies = [...nginxConf.matchAll(/add_header\s+Content-Security-Policy\s+"([^"]*)"/g)].map((m) => m[1]);

const directive = (policy, name) => {
  const found = policy.split(';').map((d) => d.trim().split(/\s+/)).find(([key]) => key === name);
  return found ? found.slice(1) : null;
};

describe('nginx.conf Content-Security-Policy', () => {
  it('is set in every location block that serves the app', () => {
    expect(policies.length).toBeGreaterThanOrEqual(5);
  });

  it.each(policies.map((p, i) => [i + 1, p]))('header %i allows secure WebSockets', (_n, policy) => {
    const connect = directive(policy, 'connect-src');
    expect(connect, 'connect-src must be explicit; default-src has no wss:').not.toBeNull();
    expect(connect).toContain('wss:');
  });

  it.each(policies.map((p, i) => [i + 1, p]))('header %i still allows the API calls default-src allowed', (_n, policy) => {
    // connect-src replaces default-src for fetch/XHR, so it must keep these.
    const connect = directive(policy, 'connect-src');
    for (const source of ["'self'", 'https:', 'http:']) expect(connect).toContain(source);
  });

  it('uses the same policy everywhere', () => {
    expect(new Set(policies).size).toBe(1);
  });
});
