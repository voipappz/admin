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
