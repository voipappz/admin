import { useState, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { config } from '../../config';

export const useNotifications = () => {
  const { access } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [unreadCountFromServer, setUnreadCountFromServer] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [perPage] = useState(100);
  const [alertConfig, setAlertConfig] = useState(null);
  const [alertConfigLoading, setAlertConfigLoading] = useState(false);

  // Fetch count only (lightweight, for badge display)
  const fetchNotificationCount = useCallback(async () => {
    if (!access) return 0;
    try {
      const response = await fetch(`${config.api.notifications}?count_only=true`, {
        headers: {
          'Authorization': access ? `Bearer ${access}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) return 0;
      const data = await response.json();
      const count = data.count || 0;
      setUnreadCountFromServer(count);
      return count;
    } catch (error) {
      console.error('Error fetching notification count:', error);
      return 0;
    }
  }, [access]);

  // Fetch single notification with full details (includes recipient info)
  // Note: GET /:id automatically marks notification as read on server
  const fetchNotificationDetails = useCallback(async (uuid) => {
    if (!access || !uuid) return null;
    try {
      const response = await fetch(`${config.api.notifications}/${uuid}`, {
        headers: {
          'Authorization': access ? `Bearer ${access}` : '',
          'Content-Type': 'application/json'
        }
      });
      if (!response.ok) return null;
      const notification = await response.json();

      // Update local state to mark as read (server already marked it)
      setNotifications(prev => prev.map(n =>
        n.uuid === uuid
          ? { ...n, read_at: notification.read_at || new Date().toISOString(), isRead: true }
          : n
      ));

      // Transform the notification to ensure consistent structure
      return {
        ...notification,
        id: notification.uuid,
        isRead: true, // Always read after fetching details
        timeAgo: getTimeAgo(notification.created_at),
        recipient: notification.recipient || null,
        meta: notification.meta || {},
        count: notification.count || 1,
        status: notification.status || 'pending',
        level: notification.level || 'info'
      };
    } catch (error) {
      console.error('Error fetching notification details:', error);
      return null;
    }
  }, [access]);

  const fetchNotifications = useCallback(async (page = 1) => {
    if (!access) return;

    setLoading(true);
    setError(null);

    try {
      // Fetch individual notifications with pagination (not grouped)
      const url = `${config.api.notifications}?page=${page}&order_by=created_at&order_type=desc`;
      const response = await fetch(url, {
        headers: {
          'Authorization': access ? `Bearer ${access}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      // Get total count from X-Total header
      const total = parseInt(response.headers.get('X-Total') || '0', 10);
      setTotalCount(total);

      const data = await response.json();

      // Transform the API response to ensure consistent structure
      const transformedNotifications = data.map(notification => ({
        ...notification,
        id: notification.uuid,
        isRead: !!notification.read_at,
        timeAgo: getTimeAgo(notification.created_at),
        recipient: notification.recipient || null,
        meta: notification.meta || {},
        // Ensure count, status, and level are always present
        count: notification.count || 1,
        status: notification.status || 'pending',
        level: notification.level || 'info'
      }));

      setNotifications(transformedNotifications);
      setCurrentPage(page);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err.message);
      // Don't show mock data - just show empty state
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, [access]);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      // GET /:id automatically marks as read on server
      const response = await fetch(`${config.api.notifications}/${notificationId}`, {
        method: 'GET',
        headers: {
          'Authorization': access ? `Bearer ${access}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        // Update local state
        setNotifications(prev => prev.map(notification =>
          notification.uuid === notificationId
            ? { ...notification, read_at: new Date().toISOString(), isRead: true }
            : notification
        ));
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      // Still update local state
      setNotifications(prev => prev.map(notification =>
        notification.uuid === notificationId
          ? { ...notification, read_at: new Date().toISOString(), isRead: true }
          : notification
      ));
    }
  }, [access]);

  // Change page
  const changePage = useCallback((newPage) => {
    fetchNotifications(newPage);
  }, [fetchNotifications]);

  const deleteNotification = useCallback(async (notificationId) => {
    try {
      // API call to delete notification
      const response = await fetch(`${config.api.notifications}/${notificationId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': access ? `Bearer ${access}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      setNotifications(prev => prev.filter(notification => notification.uuid !== notificationId));
    } catch (error) {
      // Do NOT drop the row on failure. This used to remove it locally anyway
      // ("for demo purposes"), so a delete looked like it worked and the
      // notification returned on the next refresh.
      console.error('Error deleting notification:', error);
      setError('Could not delete that notification.');
    }
  }, [access]);

  /**
   * Clear the whole feed. `readOnly` clears just the ones already read, so a
   * long feed can be tidied without losing anything unseen.
   */
  const clearAllNotifications = useCallback(async (readOnly = false) => {
    try {
      const url = `${config.api.notifications}${readOnly ? '?read=true' : ''}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': access ? `Bearer ${access}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (readOnly) {
        setNotifications(prev => prev.filter(n => !n.read_at));
      } else {
        setNotifications([]);
      }
    } catch (error) {
      console.error('Error clearing notifications:', error);
      setError('Could not clear notifications.');
    }
  }, [access]);

  const markAllAsRead = useCallback(async () => {
    try {
      const response = await fetch(`${config.api.notifications}/mark-all-read`, {
        method: 'PATCH',
        headers: {
          'Authorization': access ? `Bearer ${access}` : '',
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        setNotifications(prev => prev.map(notification => ({
          ...notification,
          read_at: new Date().toISOString(),
          isRead: true
        })));
      }
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      // Still update local state for demo purposes
      setNotifications(prev => prev.map(notification => ({
        ...notification,
        read_at: new Date().toISOString(),
        isRead: true
      })));
    }
  }, [access]);

  const fetchAlertConfig = useCallback(async () => {
    if (!access) return;
    setAlertConfigLoading(true);
    try {
      const response = await fetch(`${config.api.notifications}/alert_config`, {
        headers: {
          'Authorization': `Bearer ${access}`,
          'Content-Type': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        setAlertConfig(data);
      }
    } catch (err) {
      console.error('Error fetching alert config:', err);
    } finally {
      setAlertConfigLoading(false);
    }
  }, [access]);

  const refreshNotifications = useCallback(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Helper function to calculate time ago
  function getTimeAgo(dateString) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  }

  // NOTE: Notifications are NOT auto-fetched on mount
  // They are only fetched when user explicitly opens the notifications panel
  // Call refreshNotifications() to fetch notifications on demand

  return {
    notifications,
    loading,
    error,
    markAsRead,
    deleteNotification,
    clearAllNotifications,
    markAllAsRead,
    refreshNotifications,
    fetchNotificationCount,
    fetchNotificationDetails,
    unreadCount: unreadCountFromServer || notifications.filter(n => !n.read_at).length,
    totalCount,
    currentPage,
    perPage,
    changePage,
    totalPages: Math.ceil(totalCount / perPage),
    alertConfig,
    alertConfigLoading,
    fetchAlertConfig
  };
};