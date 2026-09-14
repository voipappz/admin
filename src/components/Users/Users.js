import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../../services/api/usersApi';
import { extensionsApi } from '../../services/api/extensionsApi';
import { useNotification } from '../../context/NotificationContext';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { addRecentObject } from '../../utils/recentObjects';

/**
 * Custom hook for Users management
 * Handles business logic for user CRUD operations with table pattern and filters
 */
export const useUsers = () => {
  // State management
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [userToDelete, setUserToDelete] = useState(null);

  // Duplicate state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [userToDuplicate, setUserToDuplicate] = useState(null);

  // Logs state
  const [logsDialogOpen, setLogsDialogOpen] = useState(false);
  const [logsUser, setLogsUser] = useState(null);

  // Reference data
  const [environments, setEnvironments] = useState([]);
  const [acls, setAcls] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [referenceDataLoading, setReferenceDataLoading] = useState(false);

  // Pagination and sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filters - matching legacy AngularJS search[field] format
  const [filters, setFilters] = useState({
    search: '',
    email: '',
    enabled: '',
    environment_uuid: '',
    acl_uuid: '',
    status_uuid: '',
    skill_uuids: [],      // array of skill UUIDs for filtering
    created_at: '',       // date range: "start_timestamp-end_timestamp"
    updated_at: ''        // date range: "start_timestamp-end_timestamp"
  });

  // Context hooks
  const { showSuccess, showError } = useNotification();
  const { selectedEnvironments } = useCustomerEnvironment();

  /**
   * Load reference data for dropdowns (acls, statuses)
   * Note: environments come from selectedEnvironments context (top selector)
   */
  const loadReferenceData = useCallback(async () => {
    try {
      setReferenceDataLoading(true);

      // Load ACLs and statuses - environments come from context
      const [aclsResponse, statusesResponse] = await Promise.all([
        usersApi.getAcls(),
        usersApi.getStatuses()
      ]);

      // Use selectedEnvironments from context for environment dropdown
      setEnvironments(selectedEnvironments || []);
      setAcls(Array.isArray(aclsResponse) ? aclsResponse : (aclsResponse?.data || []));
      setStatuses(Array.isArray(statusesResponse) ? statusesResponse : (statusesResponse?.data || []));
    } catch (error) {
      console.error('Error loading reference data:', error);
      showError('Failed to load form data');
    } finally {
      setReferenceDataLoading(false);
    }
  }, [showError, selectedEnvironments]);

  /**
   * Fetch users from API with filters, pagination, and sorting
   */
  const fetchUsers = useCallback(async (overrides = null) => {
    const effectiveSortBy = overrides?.sortBy ?? sortBy;
    const effectiveSortOrder = overrides?.sortOrder ?? sortOrder;
    const effectivePage = overrides?.page ?? page;

    try {
      setLoading(true);
      const params = {
        page: effectivePage + 1, // API is 1-indexed
        per_page: rowsPerPage,
        order_by: effectiveSortBy,
        order_type: effectiveSortOrder
      };

      // Add environment filter if available
      if (selectedEnvironments && selectedEnvironments.length > 0) {
        params.environment_uuid = selectedEnvironments[0].uuid;
      }

      // Apply filters using search[field] format (matching legacy AngularJS pattern)
      Object.keys(filters).forEach(key => {
        if (filters[key] !== '') {
          switch (key) {
            case 'search':
              params['search[name]'] = filters[key];
              break;
            case 'email':
              params['search[email]'] = filters[key];
              break;
            case 'enabled':
              params['search[enabled]'] = filters[key];
              break;
            case 'environment_uuid':
              params['search[environment_uuid]'] = filters[key];
              break;
            case 'acl_uuid':
              params['search[acl_uuid]'] = filters[key];
              break;
            case 'status_uuid':
              params['search[status_uuid]'] = filters[key];
              break;
            case 'created_at':
              params['search[created_at]'] = filters[key]; // format: "start_timestamp-end_timestamp"
              break;
            case 'updated_at':
              params['search[updated_at]'] = filters[key]; // format: "start_timestamp-end_timestamp"
              break;
            case 'skill_uuids':
              // Handle skill filtering - send as array
              if (Array.isArray(filters[key]) && filters[key].length > 0) {
                filters[key].forEach((uuid, index) => {
                  params[`search[skill_uuids][${index}]`] = uuid;
                });
              }
              break;
            default:
              break;
          }
        }
      });

      // Handle meta skill filters
      if (filters.meta && typeof filters.meta === 'object') {
        Object.entries(filters.meta).forEach(([metaKey, metaValue]) => {
          params[`search[meta][${metaKey}]`] = metaValue;
        });
      }

      const response = await usersApi.getUsers(params);

      // Handle both array response and paginated response with X-Total header support
      if (Array.isArray(response)) {
        setUsers(response);
        setTotalCount(response.length);
      } else if (response.data && Array.isArray(response.data)) {
        // Use X-Total header value (prioritized) or fallback to other total fields
        const totalFromXTotal = response.total_records || response.total;
        setUsers(response.data);
        setTotalCount(totalFromXTotal || response.data.length);
      } else {
        setUsers([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching users:', error);
      showError('Failed to load users');
      setUsers([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironments, page, rowsPerPage, sortBy, sortOrder, filters, showError]);

  /**
   * Load users on component mount and when dependencies change
   */
  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  /**
   * Load reference data on component mount
   */
  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  /**
   * Handle opening create/edit dialog
   * For edit: fetches individual user data via GET /api/users/{uuid}
   * For create: opens empty dialog
   */
  const handleOpenDialog = useCallback(async (user = null) => {
    try {
      if (user) {
        // EDIT MODE: Fetch individual user data from API (not from list)
        setDialogLoading(true);
        const userId = user.id || user.uuid;
        const fullUserData = await usersApi.getUser(userId);
        setSelectedUser(fullUserData);
        // Log to the global search's RECENT section (browser-history style)
        addRecentObject({ type: 'user', uuid: userId, name: fullUserData?.name || user.name || '', path: '/users' });
      } else {
        // CREATE MODE: No user data needed
        setSelectedUser(null);
      }
      setDialogOpen(true);
    } catch (error) {
      console.error('Error loading user details:', error);
      showError('Failed to load user details for editing');
      // Fallback to using list data if API fails
      setSelectedUser(user);
      setDialogOpen(true);
    } finally {
      setDialogLoading(false);
    }
  }, [showError]);

  /**
   * Handle closing create/edit dialog
   */
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedUser(null);
  }, []);

  // Open a user's edit dialog when requested by the global search (RECENT /
  // resource results). Same-screen requests arrive as the event; cross-screen
  // requests land in sessionStorage before navigation and are consumed here on
  // mount. The event handler clears the pending key so nothing double-fires.
  useEffect(() => {
    const PENDING_KEY = 'nimbus_pending_user_edit';
    const openFromDetail = (detail) => {
      if (detail?.uuid) handleOpenDialog({ uuid: detail.uuid, name: detail.name });
    };
    try {
      const pending = sessionStorage.getItem(PENDING_KEY);
      if (pending) {
        sessionStorage.removeItem(PENDING_KEY);
        openFromDetail(JSON.parse(pending));
      }
    } catch { /* malformed pending entry — ignore */ }
    const handler = (e) => {
      try { sessionStorage.removeItem(PENDING_KEY); } catch { /* non-fatal */ }
      openFromDetail(e?.detail);
    };
    window.addEventListener('nimbus:openUserEditor', handler);
    return () => window.removeEventListener('nimbus:openUserEditor', handler);
  }, [handleOpenDialog]);

  /**
   * Handle saving user (create or update)
   */
  const handleSaveUser = useCallback(async (userData, extensionData = null) => {
    try {
      setDialogLoading(true);

      if (selectedUser) {
        // Update existing user
        // Extract username from userData - it needs to be sent to extensions API, not users API
        const { username, ...userDataWithoutUsername } = userData;

        // Update user data (without username - users API doesn't support it)
        await usersApi.updateUser(
          selectedUser.id || selectedUser.uuid,
          userDataWithoutUsername
        );

        // If username was provided and user has an extension, update the extension
        if (username && selectedUser.extension?.uuid) {
          try {
            await extensionsApi.updateExtension(selectedUser.extension.uuid, { username });
            showSuccess('User and device updated successfully');
          } catch (extError) {
            console.error('Error updating extension username:', extError);
            showSuccess('User updated, but device username update failed');
          }
        } else if (username && !selectedUser.extension?.uuid) {
          // User doesn't have an extension yet - we could create one, but for now just warn
          showSuccess('User updated (no device to update username)');
        } else {
          showSuccess('User updated successfully');
        }
      } else {
        // Create new user with extension
        const newUserData = {
          ...userData,
          environment_uuid: userData.environment_uuid || (selectedEnvironments && selectedEnvironments.length > 0 ? selectedEnvironments[0].uuid : null)
        };
        await usersApi.createUser(newUserData, extensionData);

        if (extensionData) {
          showSuccess(`User created successfully with device ${extensionData.username}`);
        } else {
          showSuccess('User created successfully');
        }
      }

      handleCloseDialog();
      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error saving user:', error);

      // Extract validation errors from API response
      let errorMessage = error.response?.data?.message;

      // If there are validation errors, format them
      if (error.response?.data && typeof error.response.data === 'object') {
        const errors = error.response.data;
        const errorMessages = Object.entries(errors)
          .filter(([key]) => key !== 'message')
          .map(([field, messages]) => `${field}: ${Array.isArray(messages) ? messages.join(', ') : messages}`)
          .join('; ');

        if (errorMessages) {
          errorMessage = errorMessages;
        }
      }

      if (!errorMessage) {
        errorMessage = selectedUser ? 'Failed to update user' : 'Failed to create user';
      }

      showError(errorMessage);
      // Re-throw to prevent dialog from closing
      throw error;
    } finally {
      setDialogLoading(false);
    }
  }, [selectedUser, selectedEnvironments, showSuccess, showError, fetchUsers, handleCloseDialog]);

  /**
   * Handle opening delete confirmation dialog
   */
  const handleOpenDeleteDialog = useCallback((user) => {
    setUserToDelete(user);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Handle closing delete confirmation dialog
   */
  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setUserToDelete(null);
  }, []);

  /**
   * Handle deleting user
   */
  const handleDeleteUser = useCallback(async () => {
    if (!userToDelete) return;

    try {
      setDialogLoading(true);
      await usersApi.deleteUser(userToDelete.id || userToDelete.uuid);
      showSuccess('User deleted successfully');
      handleCloseDeleteDialog();
      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error deleting user:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete user';
      showError(errorMessage);
    } finally {
      setDialogLoading(false);
    }
  }, [userToDelete, showSuccess, showError, fetchUsers, handleCloseDeleteDialog]);

  /**
   * Handle opening duplicate dialog
   */
  const handleOpenDuplicateDialog = useCallback((user) => {
    setUserToDuplicate(user);
    setDuplicateDialogOpen(true);
  }, []);

  /**
   * Handle closing duplicate dialog
   */
  const handleCloseDuplicateDialog = useCallback(() => {
    setDuplicateDialogOpen(false);
    setUserToDuplicate(null);
  }, []);

  /**
   * Handle duplicating user
   */
  const handleDuplicateUser = useCallback(async (userId, newEmail, newName) => {
    try {
      setDialogLoading(true);
      await usersApi.duplicateUser(userId, newEmail, newName);
      showSuccess('User duplicated successfully');
      handleCloseDuplicateDialog();
      await fetchUsers(); // Refresh the list
    } catch (error) {
      console.error('Error duplicating user:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to duplicate user';
      showError(errorMessage);
      throw error; // Re-throw so dialog can show error
    } finally {
      setDialogLoading(false);
    }
  }, [showSuccess, showError, fetchUsers, handleCloseDuplicateDialog]);

  /**
   * Handle page change
   */
  const handlePageChange = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  /**
   * Handle rows per page change
   */
  const handleRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  /**
   * Handle sort change
   */
  const handleSortChange = useCallback((field) => {
    const newOrder = sortBy === field ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(field);
    setSortOrder(newOrder);
    setPage(0);
    // State updates re-run the fetch effect — a direct call here double-fetched.
  }, [sortBy, sortOrder, fetchUsers]);

  /**
   * Handle filter changes
   */
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(0); // Reset to first page on filter change
  }, []);

  /**
   * Reset all filters
   */
  const handleResetFilters = useCallback(() => {
    setFilters({
      search: '',
      email: '',
      enabled: '',
      environment_uuid: '',
      acl_uuid: '',
      status_uuid: '',
      skill_uuids: [],
      created_at: '',
      updated_at: ''
    });
    setPage(0);
  }, []);

  /**
   * Handle password reset email
   */
  const handleResetPassword = useCallback(async (user) => {
    if (!user) return;

    const confirmed = window.confirm(
      `Send password reset email to ${user.email}?`
    );

    if (!confirmed) return;

    try {
      setLoading(true);
      await usersApi.sendPasswordResetEmail(user.email);
      showSuccess('Password reset email sent successfully');
    } catch (error) {
      console.error('Error sending password reset:', error);
      showError('Failed to send password reset email');
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError]);

  /**
   * Handle password reset (admin action)
   * Generates a new random password via API and returns it
   */
  const handleDirectPasswordReset = useCallback(async (userId) => {
    if (!userId) return;

    try {
      const result = await usersApi.generateUserPassword(userId);
      // Return the result so dialog can display the generated password
      return result;
    } catch (error) {
      console.error('Error resetting password:', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to reset password';
      showError(errorMessage);
      throw error; // Re-throw so dialog can show error
    }
  }, [showError]);

  /**
   * Handle viewing user logs
   * Opens the logs dialog - EntityLogsDialog handles fetching internally
   */
  const handleViewUserLogs = useCallback((user) => {
    setLogsUser(user);
    setLogsDialogOpen(true);
  }, []);

  /**
   * Handle closing logs dialog
   */
  const handleCloseLogsDialog = useCallback(() => {
    setLogsDialogOpen(false);
    setLogsUser(null);
  }, []);

  return {
    // State
    users,
    loading,
    dialogLoading,
    selectedUser,
    dialogOpen,
    deleteDialogOpen,
    userToDelete,
    duplicateDialogOpen,
    userToDuplicate,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortOrder,
    filters,

    // Reference data
    environments,
    acls,
    statuses,
    referenceDataLoading,

    // Actions
    handleOpenDialog,
    handleCloseDialog,
    handleSaveUser,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteUser,
    handleOpenDuplicateDialog,
    handleCloseDuplicateDialog,
    handleDuplicateUser,
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,
    handleFiltersChange,
    handleResetFilters,
    handleResetPassword,
    handleDirectPasswordReset,
    fetchUsers,
    loadReferenceData,

    // Logs
    logsDialogOpen,
    logsUser,
    handleViewUserLogs,
    handleCloseLogsDialog
  };
};

export default useUsers;
