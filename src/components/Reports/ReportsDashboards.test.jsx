import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReportsDashboards from './ReportsDashboards.jsx';
import { reportsApi } from '../../services/api/reportsApi';

vi.mock('../../services/api/reportsApi', () => ({
  reportsApi: {
    getDashboards: vi.fn(),
    runDashboardCategory: vi.fn(),
  },
}));

describe('ReportsDashboards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportsApi.getDashboards.mockResolvedValue({
      dashboards: [
        { category: 'calls', count: 8, reports: [] },
        { category: 'billing', count: 2, reports: [] },
      ],
    });
    reportsApi.runDashboardCategory.mockResolvedValue({ reports: [] });
  });

  it('runs only the first dashboard initially and another only after selection', async () => {
    render(<ReportsDashboards />);

    await waitFor(() => {
      expect(reportsApi.getDashboards).toHaveBeenCalledTimes(1);
      expect(reportsApi.runDashboardCategory).toHaveBeenCalledTimes(1);
      expect(reportsApi.runDashboardCategory).toHaveBeenCalledWith(
        'calls',
        expect.objectContaining({ startDate: expect.any(Number), endDate: expect.any(Number) }),
      );
    });

    fireEvent.click(screen.getByRole('tab', { name: /billing/i }));

    await waitFor(() => {
      expect(reportsApi.runDashboardCategory).toHaveBeenCalledTimes(2);
      expect(reportsApi.runDashboardCategory).toHaveBeenCalledWith(
        'billing',
        expect.objectContaining({ startDate: expect.any(Number), endDate: expect.any(Number) }),
      );
    });
  });
});
