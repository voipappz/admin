import { useState, useEffect, useCallback } from 'react';
import { extensionsApi } from '../../services/api/extensionsApi';
import { useNotification } from '../../context/NotificationContext';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';

/**
 * Custom hook for Extensions management
 * Handles business logic for extension CRUD operations with table pattern and filters
 */
export const useExtensions = () => {
  // State management
  const [extensions, setExtensions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [selectedExtension, setSelectedExtension] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [extensionToDelete, setExtensionToDelete] = useState(null);

  // Pagination and sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Registration status - set of registered usernames from live registrations
  const [registeredUsers, setRegisteredUsers] = useState(new Set());

  // Filters - matching legacy AngularJS search[field] format
  const [filters, setFilters] = useState({
    search: '',          // searches name
    username: '',        // searches extension/username
    enabled: '',
    environment_uuid: '',
    created_at: '',      // date range: "start_timestamp-end_timestamp"
    updated_at: ''       // date range: "start_timestamp-end_timestamp"
  });

  // Context hooks
  const { showSuccess, showError } = useNotification();
  const { selectedEnvironments } = useCustomerEnvironment();

  /**
   * Fetch extensions from API with filters, pagination, and sorting
   */
  const fetchExtensions = useCallback(async (overrides = null) => {
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
            case 'username':
              params['search[username]'] = filters[key];
              break;
            case 'enabled':
              params['search[enabled]'] = filters[key];
              break;
            case 'environment_uuid':
              params['search[environment_uuid]'] = filters[key];
              break;
            case 'created_at':
              params['search[created_at]'] = filters[key]; // format: "start_timestamp-end_timestamp"
              break;
            case 'updated_at':
              params['search[updated_at]'] = filters[key]; // format: "start_timestamp-end_timestamp"
              break;
            default:
              break;
          }
        }
      });

      // Handle meta tag filters
      if (filters.meta && typeof filters.meta === 'object') {
        Object.entries(filters.meta).forEach(([metaKey, metaValue]) => {
          params[`search[meta][${metaKey}]`] = metaValue;
        });
      }

      const response = await extensionsApi.getExtensions(params);

      // Handle both array response and paginated response with X-Total header support
      if (Array.isArray(response)) {
        setExtensions(response);
        setTotalCount(response.length);
      } else if (response.data && Array.isArray(response.data)) {
        // Use X-Total header value (prioritized) or fallback to other total fields
        const totalFromXTotal = response.total_records || response.total;
        setExtensions(response.data);
        setTotalCount(totalFromXTotal || response.data.length);
      } else {
        setExtensions([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching extensions:', error);
      showError('Failed to load devices');
      setExtensions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironments, page, rowsPerPage, sortBy, sortOrder, filters, showError]);

  /**
   * Fetch live registrations to determine which extensions are registered
   */
  const fetchRegistrations = useCallback(async () => {
    try {
      const response = await extensionsApi.getLiveRegistrations();
      if (Array.isArray(response)) {
        const registered = new Set(response.map(r => r.reg_user).filter(Boolean));
        setRegisteredUsers(registered);
      }
    } catch {
      // Silently fail - registrations are optional status info
      // FreeSwitch may not be available for this account
    }
  }, []);

  /**
   * Load extensions on component mount and when dependencies change
   */
  useEffect(() => {
    fetchExtensions();
    fetchRegistrations();
  }, [fetchExtensions, fetchRegistrations]);

  /**
   * Handle opening create/edit dialog
   * For edit: fetches individual extension data via GET /api/devices/{uuid}
   * For create: opens empty dialog
   */
  const handleOpenDialog = useCallback(async (extension = null) => {
    try {
      if (extension) {
        // EDIT MODE: Fetch individual extension data from API (not from list)
        setDialogLoading(true);
        const extensionId = extension.id || extension.uuid;
        const fullExtensionData = await extensionsApi.getExtension(extensionId);
        setSelectedExtension(fullExtensionData);
      } else {
        // CREATE MODE: No extension data needed
        setSelectedExtension(null);
      }
      setDialogOpen(true);
    } catch (error) {
      console.error('Error loading extension details:', error);
      showError('Failed to load device details for editing');
      // Fallback to using list data if API fails
      setSelectedExtension(extension);
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
    setSelectedExtension(null);
  }, []);

  /**
   * Handle saving extension (create or update)
   */
  const handleSaveExtension = useCallback(async (extensionData) => {
    try {
      setDialogLoading(true);

      if (selectedExtension) {
        // Update existing extension
        await extensionsApi.updateExtension(
          selectedExtension.id || selectedExtension.uuid,
          extensionData
        );
        showSuccess('Device updated successfully');
      } else {
        // Create new extension
        const newExtensionData = {
          ...extensionData,
          environment_uuid: extensionData.environment_uuid || (selectedEnvironments && selectedEnvironments.length > 0 ? selectedEnvironments[0].uuid : null)
        };
        await extensionsApi.createExtension(newExtensionData);
        showSuccess('Device created successfully');
      }

      handleCloseDialog();
      await fetchExtensions(); // Refresh the list
    } catch (error) {
      console.error('Error saving extension:', error);

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
        errorMessage = selectedExtension ? 'Failed to update device' : 'Failed to create device';
      }

      showError(errorMessage);
      // Re-throw to prevent dialog from closing
      throw error;
    } finally {
      setDialogLoading(false);
    }
  }, [selectedExtension, selectedEnvironments, showSuccess, showError, fetchExtensions, handleCloseDialog]);

  /**
   * Handle opening delete confirmation dialog
   */
  const handleOpenDeleteDialog = useCallback((extension) => {
    setExtensionToDelete(extension);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Handle closing delete confirmation dialog
   */
  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setExtensionToDelete(null);
  }, []);

  /**
   * Handle deleting extension
   */
  const handleDeleteExtension = useCallback(async () => {
    if (!extensionToDelete) return;

    try {
      setDialogLoading(true);
      await extensionsApi.deleteExtension(extensionToDelete.id || extensionToDelete.uuid);
      showSuccess('Device deleted successfully');
      handleCloseDeleteDialog();
      await fetchExtensions(); // Refresh the list
    } catch (error) {
      console.error('Error deleting extension:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete device';
      showError(errorMessage);
    } finally {
      setDialogLoading(false);
    }
  }, [extensionToDelete, showSuccess, showError, fetchExtensions, handleCloseDeleteDialog]);

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
  }, [sortBy, sortOrder, fetchExtensions]);

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
      username: '',
      enabled: '',
      environment_uuid: '',
      created_at: '',
      updated_at: ''
    });
    setPage(0);
  }, []);

  return {
    // State
    extensions,
    loading,
    dialogLoading,
    selectedExtension,
    dialogOpen,
    deleteDialogOpen,
    extensionToDelete,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortOrder,
    filters,
    registeredUsers,

    // Reference data
    environments: selectedEnvironments || [],

    // Actions
    handleOpenDialog,
    handleCloseDialog,
    handleSaveExtension,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteExtension,
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,
    handleFiltersChange,
    handleResetFilters,
    fetchExtensions
  };
};

export default useExtensions;
