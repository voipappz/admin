import apiService from '../apiService';

/**
 * Notifications API Service
 * Handles notification-related API calls
 */
export const notificationsApi = {
  /**
   * Get notification count (optionally filtered by customer)
   * @param {string} customerUuid - Optional customer UUID to filter
   * @returns {Promise<number>} - Unread notification count
   */
  getNotificationCount: async (customerUuid = null) => {
    const params = new URLSearchParams({ count_only: 'true' });
    if (customerUuid) {
      params.append('customer_uuid', customerUuid);
    }
    const url = `/api/notifications?${params.toString()}`;
    try {
      const response = await apiService.get(url, {}, 'fetching notification count', false);
      return response?.count || 0;
    } catch (err) {
      console.error('Error fetching notification count:', err);
      return 0;
    }
  },

  /**
   * Get notifications (optionally filtered by customer)
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of notification objects
   */
  getNotifications: async (options = {}) => {
    const {
      customerUuid = null,
      page = 1,
      perPage = 50,
      orderBy = 'created_at',
      orderType = 'desc'
    } = options;

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      order_by: orderBy,
      order_type: orderType
    });

    if (customerUuid) {
      params.append('customer_uuid', customerUuid);
    }

    const url = `/api/notifications?${params.toString()}`;
    try {
      const response = await apiService.get(url, {}, 'fetching notifications', false);
      return Array.isArray(response) ? response : response?.data || [];
    } catch (err) {
      console.error('Error fetching notifications:', err);
      return [];
    }
  },

  /**
   * Get notification counts for multiple customers
   * @param {Array<string>} customerUuids - Array of customer UUIDs
   * @returns {Promise<Object>} - Map of customerUuid to count
   */
  getNotificationCountsByCustomers: async (customerUuids = []) => {
    if (!Array.isArray(customerUuids) || customerUuids.length === 0) {
      return {};
    }

    // Fetch counts in parallel for all customers
    const promises = customerUuids.map(uuid =>
      notificationsApi.getNotificationCount(uuid).catch(() => 0)
    );

    const counts = await Promise.all(promises);
    const result = {};
    customerUuids.forEach((uuid, idx) => {
      result[uuid] = counts[idx] || 0;
    });
    return result;
  },

  /**
   * Unread monitoring alerts (Notification rows of type 'alert'), filtered by
   * the API: GET /api/notifications?type=alert&action=pending[&level][&search].
   * The API pages unread rows 20 at a time with X-Total and orders newest
   * first, so this walks the pages (up to maxPages) and the caller orders.
   * @returns {Promise<{rows: Array, total: number}>}
   */
  getUnreadAlerts: async ({ level = '', search = '', maxPages = 10 } = {}) => {
    const rows = [];
    let total = 0;
    for (let page = 1; page <= maxPages; page += 1) {
      const params = new URLSearchParams({ type: 'alert', action: 'pending', page: String(page) });
      if (level) params.append('level', level);
      if (search) params.append('search[inline]', search);
      const res = await apiService.get(`/api/notifications?${params.toString()}`, {}, 'fetching alerts', false, true);
      const data = Array.isArray(res) ? res : (res?.data || []);
      total = Array.isArray(res) ? rows.length + data.length : (Number(res?.total) || 0);
      rows.push(...data);
      if (!data.length || rows.length >= total) break;
    }
    return { rows, total: Math.max(total, rows.length) };
  },

  /**
   * How many unread alerts (optionally of one level): the X-Total of the first
   * page of the same list, so no rows are walked for a count.
   */
  countUnreadAlerts: async (level = '') => {
    const params = new URLSearchParams({ type: 'alert', action: 'pending', page: '1' });
    if (level) params.append('level', level);
    const res = await apiService.get(`/api/notifications?${params.toString()}`, {}, 'counting alerts', false, true);
    return Array.isArray(res) ? res.length : (Number(res?.total) || 0);
  },

  /** PATCH /api/notifications/:uuid?action=read — silent: the caller shows the result. */
  markRead: (notificationUuid) =>
    apiService.patch(`/api/notifications/${encodeURIComponent(notificationUuid)}?action=read`, {}, {},
      'marking notification as read', false),

  /**
   * Mark notification as read
   * @param {string} notificationUuid - Notification UUID
   * @returns {Promise<Object>} - Updated notification
   */
  markAsRead: async (notificationUuid) => {
    const url = `/api/notifications/${notificationUuid}`;
    try {
      return await apiService.get(url, {}, 'marking notification as read', false);
    } catch (err) {
      console.error('Error marking notification as read:', err);
      return null;
    }
  }
};

export default notificationsApi;
