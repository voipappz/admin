import { describe, expect, it } from 'vitest';
import { extractMapShapes } from './ReportMap.jsx';
import { linkedColumnUrl } from './ReportsPanel.jsx';

describe('report map and linked columns', () => {
  it('extracts latitude/longitude points and labels', () => {
    const result = extractMapShapes(
      ['name', 'latitude', 'longitude'],
      [{ name: 'Tel Aviv', latitude: 32.0853, longitude: 34.7818 }],
    );

    expect(result.points).toEqual([
      { label: 'Tel Aviv', coordinates: [34.7818, 32.0853] },
    ]);
  });

  it('extracts GeoJSON shapes', () => {
    const result = extractMapShapes(['geojson'], [{
      geojson: JSON.stringify({ type: 'Point', coordinates: [34.7818, 32.0853] }),
    }]);

    expect(result.points).toHaveLength(1);
  });

  it('builds a safe linked-column URL from the returned value', () => {
    expect(linkedColumnUrl('/users/{value}', 'a/b')).toBe('/users/a%2Fb');
    expect(linkedColumnUrl('/users/{value}', null)).toBeNull();
  });
});
