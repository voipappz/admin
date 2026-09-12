import { apiService, toFormData } from './apiService';
import { config } from '../config';

// Dashboard/widget CRUD goes through the shared apiService like every other
// endpoint — it handles the /api base, auth, CSRF and form-urlencoded bodies.
// executeAction stays on raw fetch: it targets arbitrary /tasks and full URLs
// (widget row actions), not the dashboard REST endpoints.
class DashboardService {
  // Host + /api — only used by executeAction's URL builder below.
  get baseUrl() {
    const base = config.apiBaseUrl || '';
    return `${base.endsWith('/') ? base.slice(0, -1) : base}/api`;
  }

  // ---- Dashboards -----------------------------------------------------------
  async getDashboards() {
    return apiService.get('/api/dashboards', {}, 'fetching dashboards', false);
  }

  async getDashboard(dashboardId) {
    return apiService.get(`/api/dashboards/${dashboardId}`, {}, `fetching dashboard ${dashboardId}`, false);
  }

  async createDashboard(dashboard = {}) {
    const body = toFormData({ name: dashboard.name, ...(dashboard.widgets ? { widgets: dashboard.widgets } : {}) });
    return apiService.post('/api/dashboards', body, {}, 'creating dashboard', true);
  }

  async updateDashboard(dashboardId, dashboard = {}) {
    return apiService.patch(`/api/dashboards/${dashboardId}`, toFormData(dashboard), {}, 'updating dashboard', true);
  }

  async deleteDashboard(dashboardId) {
    return apiService.delete(`/api/dashboards/${dashboardId}`, {}, 'deleting dashboard');
  }

  // ---- Widgets (nested under a dashboard) ----------------------------------
  // Widgets are embedded in GET /api/dashboards/:id (or ?action=widgets).
  async getWidgets(_token, dashboardId = 'live') {
    return apiService.get(`/api/dashboards/${dashboardId}?action=widgets`, {}, 'fetching widgets', false);
  }

  async createWidget(dashboardId, widget = {}) {
    return apiService.post(`/api/dashboards/${dashboardId}/widgets`, toFormData(widget), {}, 'creating widget', true);
  }

  // Alias used by useDashboard — same as createWidget.
  async addWidgetToDashboard(dashboardId, widget = {}) {
    return this.createWidget(dashboardId, widget);
  }

  async getWidget(dashboardId, widgetId) {
    return apiService.get(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, {}, 'fetching widget', false);
  }

  async updateWidget(dashboardId, widgetId, widget = {}) {
    return apiService.patch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, toFormData(widget), {}, 'updating widget', true);
  }

  async deleteWidget(dashboardId, widgetId) {
    return apiService.delete(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, {}, 'deleting widget');
  }

  // Identity time-series for one widget field (field = "<identity_type>.<field>").
  async getWidgetChart(dashboardId, widgetId, field, _token, fromMinutes = 60) {
    const url = `/api/dashboards/${dashboardId}/widgets/${widgetId}?action=chart&field=${encodeURIComponent(field)}&from=${fromMinutes}`;
    return apiService.get(url, {}, 'fetching widget chart', false);
  }

  // Position/size are stored on the widget meta.
  async updateWidgetLayout(dashboardId, widgetId, layout = {}) {
    const body = toFormData({
      meta: {
        x: layout.x,
        y: layout.y,
        col: layout.w || layout.col,
        row: layout.h || layout.row,
      },
    });
    return apiService.patch(`/api/dashboards/${dashboardId}/widgets/${widgetId}`, body, {}, 'updating widget layout', false);
  }

  async executeAction(actionOrUrl, method = 'POST', rowData = {}, token, selectedValue = null) {
    try {
      // Support both legacy signature (url, method, ...) and new signature (action, ...)
      const actionObj = (actionOrUrl && typeof actionOrUrl === 'object' && actionOrUrl.url) ? actionOrUrl : null;
      const actionUrl = actionObj ? actionObj.url : actionOrUrl;
      const actionMethod = actionObj ? (actionObj.method || method) : method;
      let processedUrl = actionUrl;

      // Replace template placeholders with actual row data (direct key replacement)
      Object.keys(rowData).forEach(key => {
        const value = rowData[key]?.data || rowData[key];
        const template = `{{${key}}}`;
        processedUrl = processedUrl.replace(new RegExp(template.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      });

      // Replace selected option placeholder if present
      if (typeof selectedValue !== 'undefined' && selectedValue !== null) {
        const sel = String(selectedValue);
        processedUrl = processedUrl.replace(/\{\{selected_option\}\}/g, encodeURIComponent(sel));
      }

      // Replace any remaining {{path}} tokens by looking up dot-paths on rowData
      processedUrl = processedUrl.replace(/\{\{([^}]+)\}\}/g, (m, path) => {
        if (path === 'selected_option' && (selectedValue !== undefined && selectedValue !== null)) {
          return encodeURIComponent(String(selectedValue));
        }
        // Try direct key
        let val = rowData?.[path];
        // Try dot path
        if (val === undefined) {
          try {
            val = path.split('.').reduce((acc, k) => (acc ? acc[k] : undefined), rowData);
          } catch {
            val = undefined;
          }
        }
        const out = (val && typeof val === 'object' && 'data' in val) ? val.data : val;
        return out != null ? encodeURIComponent(String(out)) : '';
      });

      // Ensure agent task URLs use the user's UUID from the socket row
      try {
        const userUuid = rowData?.['user.uuid']?.data
          ?? rowData?.user?.uuid?.data
          ?? rowData?.user?.uuid
          ?? rowData?.uuid?.data
          ?? rowData?.uuid;

        if (userUuid) {
          const isAgentTask = /^\/?tasks\/agent_/i.test(processedUrl);
          if (isAgentTask) {
            // If UUID segment is present, replace it; otherwise append it
            if (/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(?=[/?]|$)/i.test(processedUrl)) {
              processedUrl = processedUrl.replace(/(\/)\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b(?=[/?]|$)/i, `$1${userUuid}`);
            } else if (!/\{\{[^}]+\}\}/.test(processedUrl)) {
              // Only append if no unresolved placeholders remain
              processedUrl = processedUrl.replace(/\/?$/, '') + `/${userUuid}`;
            }
          }
        }
      } catch {
        // Non-fatal; fall back to processedUrl
      }

      // Normalize leading slash for relative joins (keep for absolute http URLs)
      const hasHttp = /^https?:\/\//i.test(processedUrl);
      if (!hasHttp && processedUrl && processedUrl.startsWith('/')) {
        processedUrl = processedUrl.slice(1);
      }
      // Compute non-leading-slash path once for reuse
      const pathNoLead = processedUrl.startsWith('/') ? processedUrl.slice(1) : processedUrl;

      // Append params if provided on action
      let queryParts = [];
      if (actionObj && actionObj.params) {
        queryParts.push(typeof actionObj.params === 'string' ? actionObj.params : new URLSearchParams(actionObj.params).toString());
      }

      // Build base taking into account when the action already includes /api or full http URL
      let finalUrl;
      if (hasHttp) {
        finalUrl = processedUrl;
      } else {
        const apiHostBase = this.baseUrl.replace(/\/?api\/?$/, '');
        if (/^api\//i.test(pathNoLead)) {
          // Action path already includes api prefix
          finalUrl = `${apiHostBase}/${pathNoLead}`;
        } else if (/^\/api\//i.test(`/${pathNoLead}`)) {
          finalUrl = `${apiHostBase}/${pathNoLead.replace(/^api\//i, '')}`;
        } else if (/^tasks\//i.test(pathNoLead)) {
          // Tasks endpoints live at the root without the /api prefix
          finalUrl = `${apiHostBase}/${pathNoLead}`;
        } else {
          finalUrl = `${this.baseUrl}/${pathNoLead}`;
        }
      }
      // Only append query params for non-task endpoints. Task URLs should be clean.
      const isTasksPath = /\/tasks\//i.test(`/${pathNoLead}`);
      if (queryParts.length > 0 && !isTasksPath) {
        finalUrl += (finalUrl.includes('?') ? '&' : '?') + queryParts.join('&');
      }

      console.log('Executing action:', finalUrl, 'with method:', actionMethod);

      const response = await fetch(finalUrl, {
        method: String(actionMethod || 'POST').toUpperCase(),
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': token } : {})
        },
        // Don't send a body by default unless the API requires it; URL params/placeholders are used
        body: undefined
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error executing action:', error);
      throw error;
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
