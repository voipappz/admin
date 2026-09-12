import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

vi.mock('../../services/api/metricsApi', () => ({
  metricsApi: { getDetailedHealth: vi.fn() },
}));

import { metricsApi } from '../../services/api/metricsApi';
import ApiHealthPanel from './ApiHealthPanel.jsx';

describe('ApiHealthPanel', () => {
  beforeEach(() => vi.clearAllMocks());

  it('loads and renders the authenticated detailed health response', async () => {
    metricsApi.getDetailedHealth.mockResolvedValue({
      http_status: 200,
      status: 'healthy',
      healthy: true,
      checks: { database: { healthy: true, latency_ms: 1.2 } },
    });

    render(<ApiHealthPanel />);

    await waitFor(() => expect(metricsApi.getDetailedHealth).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('database')).toBeInTheDocument();
    expect(screen.getByText('1.2ms')).toBeInTheDocument();
    expect(screen.getByText('healthy')).toBeInTheDocument();
  });
});
