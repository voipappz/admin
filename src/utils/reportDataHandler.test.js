import { describe, expect, it } from 'vitest';
import ReportDataHandler from './reportDataHandler';

describe('ReportDataHandler advanced visualizations', () => {
  it('uses the server chart decision for saved report responses', () => {
    const handler = ReportDataHandler.fromReportData({
      chart: 'scatter',
      table: {
        fields: [{ field: 'x' }, { field: 'y' }],
        data: [{ x: { data: '1' }, y: { data: '2' } }],
      },
    });

    expect(handler.detectChartType()).toBe('scatter');
  });

  it('recognizes map columns even when no rows are returned', () => {
    const handler = ReportDataHandler.fromReportData({
      table: {
        fields: [{ field: 'name' }, { field: 'latitude' }, { field: 'longitude' }],
        data: [],
      },
    });

    expect(handler.detectChartType()).toBe('map');
  });
});
