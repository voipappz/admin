import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../apiService', () => ({
  apiService: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  toFormData: vi.fn(),
}));

import { apiService, toFormData } from '../apiService';
import { botsApi } from './botsApi';

describe('botsApi.runTurn', () => {
  beforeEach(() => vi.clearAllMocks());

  it('posts a message and existing session to the canonical bot endpoint', async () => {
    apiService.post.mockResolvedValue({ say: 'Hello', session_id: 'session-1' });

    const result = await botsApi.runTurn('bot-1', {
      message: 'hello',
      sessionId: 'session-1',
      requestId: 'request-1',
    });

    expect(apiService.post).toHaveBeenCalledWith(
      '/api/bots/bot-1/turn',
      { message: 'hello', session_id: 'session-1', request_id: 'request-1' },
      {},
      'testing bot turn',
      false,
    );
    expect(result.say).toBe('Hello');
  });
});

describe('botsApi.validateBot', () => {
  it('reads the canonical server-side graph report', async () => {
    apiService.get.mockResolvedValue({ valid: false, errors: [{ code: 'unknown_target' }] });

    const result = await botsApi.validateBot('bot-1');

    expect(apiService.get).toHaveBeenCalledWith('/api/bots/bot-1/validate', {}, 'validating bot', false);
    expect(result.valid).toBe(false);
  });
});

describe('botsApi.updateBot', () => {
  it('passes the realtime profile to the shared nested form encoder', async () => {
    const encoded = new URLSearchParams('profile%5Brealtime_enabled%5D=true');
    toFormData.mockReturnValue(encoded);
    apiService.patch.mockResolvedValue({ uuid: 'bot-1' });
    const payload = {
      name: 'Support',
      profile: { language: 'en', realtime_enabled: true },
    };

    await botsApi.updateBot('bot-1', payload);

    expect(toFormData).toHaveBeenCalledWith(payload);
    expect(apiService.patch).toHaveBeenCalledWith(
      '/api/bots/bot-1',
      encoded,
      { 'Content-Type': 'application/x-www-form-urlencoded' },
      'updating bot Support',
      true,
    );
  });
});
