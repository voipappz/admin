// Ported from va-voipbox-portal (src/models/widget.model.ts + box.model.ts).
// The dashboard is driven entirely by the server: widget DEFINITIONS come from
// GET /api/dashboards/:uuid?action=widgets, and live DATA is pushed over the
// ActionCable 'DashboardUser' channel, keyed by widget name.

export interface DashboardWidget {
  uuid: string;
  name: string;            // key used to match live data (widgetData[name])
  title: string;
  template: string;        // 'counter' | 'line-chart' | 'pie-chart' | 'table' | 'form'
  data_url?: string;       // initial-data endpoint for this widget
  refresh_rate?: number;
  columns?: Array<{ name: string; type?: string; display?: boolean; header_name?: string; icon?: string }>;
  header_icon?: string;
  header_background_color?: string;
  header_text_color?: string;
  sizeX?: number;
  sizeY?: number;
  row?: number;
  col?: number;
  params?: any;
  view?: any;
}

// Whatever the DashboardUser channel pushes, keyed by widget name.
export interface WidgetDataMap {
  [widgetName: string]: any;
}
