import { describe, expect, it } from 'vitest';
import { describeConnectionFailure } from './connectionError';

describe('describeConnectionFailure', () => {
  it('names the wss server and points at the certificate check', () => {
    const failure = describeConnectionFailure(
      'wss://switch.voipappz.io:8443',
      new Error('WebSocket closed wss://switch.voipappz.io:8443 (code: 1006)'),
      'https:'
    );

    expect(failure.message).toBe("Can't connect to SIP server switch.voipappz.io:8443");
    expect(failure.hint).toContain('https://switch.voipappz.io:8443');
    expect(failure.hint).toContain('certificate');
    expect(failure.detail).toBe('WebSocket closed wss://switch.voipappz.io:8443 (code: 1006)');
  });

  it('explains that an https page cannot open ws://', () => {
    const failure = describeConnectionFailure('ws://pbx.example.com:5066', new Error('SecurityError'), 'https:');

    expect(failure.message).toBe('Browser blocked insecure SIP server pbx.example.com:5066');
    expect(failure.hint).toContain('wss://');
  });

  it('allows ws:// from an http page without the certificate hint', () => {
    const failure = describeConnectionFailure('ws://pbx.example.com:5066', undefined, 'http:');

    expect(failure.message).toBe("Can't connect to SIP server pbx.example.com:5066");
    expect(failure.hint).not.toContain('certificate');
    expect(failure.detail).toBe('');
  });

  it('reports a missing or malformed address', () => {
    expect(describeConnectionFailure('', null, 'https:').message).toBe('Invalid SIP server address: (not set)');
    expect(describeConnectionFailure('https://switch.voipappz.io', null, 'https:').message)
      .toBe('Invalid SIP server address: https://switch.voipappz.io');
  });
});
