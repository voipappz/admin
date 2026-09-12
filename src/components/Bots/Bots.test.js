import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api/botsApi', () => ({
  botsApi: {
    getBots: vi.fn(),
    updateBot: vi.fn(),
  },
}));
const customerEnvironment = { selectedEnvironments: [{ uuid: 'env-1' }] };
vi.mock('../../context/CustomerEnvironmentContext', () => ({
  useCustomerEnvironment: () => customerEnvironment,
}));
const notifications = { showSuccess: vi.fn(), showError: vi.fn() };
vi.mock('../../context/NotificationContext', () => ({
  useNotification: () => notifications,
}));

import { botsApi } from '../../services/api/botsApi';
import { useBots } from './Bots.js';

describe('useBots realtime settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    botsApi.getBots.mockResolvedValue([
      {
        id: 'bot-1',
        uuid: 'bot-1',
        name: 'Support',
        status: 'draft',
        profile: { language: 'en', realtime_enabled: false },
      },
    ]);
    botsApi.updateBot.mockResolvedValue({ uuid: 'bot-1' });
  });

  it('keeps the existing profile and saves realtime_enabled as nested data', async () => {
    const { result } = renderHook(() => useBots());
    await waitFor(() => expect(result.current.projects).toHaveLength(1));

    act(() => result.current.setSelectedBot(result.current.bots[0]));
    await waitFor(() => expect(result.current.selectedProject?.uuid).toBe('bot-1'));

    act(() => result.current.updateBotField('profile.realtime_enabled', true));
    await waitFor(() => expect(result.current.selectedProject.profile.realtime_enabled).toBe(true));

    await act(async () => result.current.saveBot('bot-1'));

    expect(botsApi.updateBot).toHaveBeenCalledWith('bot-1', {
      name: 'Support',
      status: 'draft',
      profile: { language: 'en', realtime_enabled: true },
    });
  });
});
