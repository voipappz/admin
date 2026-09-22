import { describe, it, expect, beforeEach } from 'vitest';
import { cableToken, tokenExpiresAt, cableUrlFor, redactCableUrl } from './cableToken';

const jwt = (claims) => `h.${btoa(JSON.stringify(claims)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')}.s`;

describe('cableToken', () => {
  beforeEach(() => localStorage.clear());

  it('prefers the local-dev override, then an admin login, then a portal login', () => {
    localStorage.setItem('user_auth', JSON.stringify({ token: 'portal' }));
    expect(cableToken()).toEqual({ token: 'portal', source: 'portal' });

    localStorage.setItem('auth', JSON.stringify({ access: 'admin' }));
    expect(cableToken()).toEqual({ token: 'admin', source: 'admin' });

    localStorage.setItem('va_cable_token', 'override');
    expect(cableToken()).toEqual({ token: 'override', source: 'override' });
  });

  it('has nothing without a session, and survives unreadable storage', () => {
    expect(cableToken()).toEqual({ token: null, source: null });
    localStorage.setItem('auth', '{not json');
    expect(cableToken()).toEqual({ token: null, source: null });
  });
});

describe('tokenExpiresAt', () => {
  it('reads exp as milliseconds', () => {
    expect(tokenExpiresAt(jwt({ user_uuid: 'u', exp: 1790000000 }))).toBe(1790000000 * 1000);
  });

  it('is null for a token with no exp, or not a JWT at all', () => {
    expect(tokenExpiresAt(jwt({ account_uuid: 'a' }))).toBeNull();
    expect(tokenExpiresAt('opaque')).toBeNull();
    expect(tokenExpiresAt(null)).toBeNull();
  });
});

describe('cable URLs', () => {
  it('appends the token and never shows it', () => {
    const url = cableUrlFor('ws://n:4000/cable', 'a.b.c');
    expect(url).toBe('ws://n:4000/cable?token=a.b.c');
    expect(redactCableUrl(url)).toBe('ws://n:4000/cable?token=***');
    expect(cableUrlFor('ws://n/ws?x=1', 't')).toBe('ws://n/ws?x=1&token=t');
  });
});
