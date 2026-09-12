import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../services/api/monitoringApi', () => ({
  monitoringApi: {
    runInfluxQuery: vi.fn(() => Promise.resolve({ rows: [{ time: 't1', value: 2 }] })),
  },
}));

import { monitoringApi } from '../../services/api/monitoringApi';
import { INTEGRATIONS, useIntegrations } from './integrations.js';

describe('useIntegrations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('applies arriving thresholds without repeating metric queries', async () => {
    const expectedQueries = INTEGRATIONS.reduce((total, integration) => total + integration.fields.length, 0);
    const { result, rerender } = renderHook(
      ({ alertConfig }) => useIntegrations({ minutes: 60, bucket: 'minute', host: '', alertConfig }),
      { initialProps: { alertConfig: null } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(monitoringApi.runInfluxQuery).toHaveBeenCalledTimes(expectedQueries);

    rerender({ alertConfig: { system: { load: { warning: 5, critical: 10 } } } });
    await act(async () => {});

    expect(monitoringApi.runInfluxQuery).toHaveBeenCalledTimes(expectedQueries);
    const load = result.current.data.system.fields.find(field => field.key === 'load1');
    expect(load).toMatchObject({ warn: 5, crit: 10 });
  });
});
