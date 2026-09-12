import { useState, useEffect, useCallback } from 'react';
import { servicesApi } from '../../services/api/servicesApi';
import { useAuth } from '../../context/AuthContext';
import { useNotification } from '../../context/NotificationContext';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';

/**
 * Custom hook for Services management
 * Provides state management and actions for service operations
 */
export const useServices = () => {
  const { access } = useAuth();
  const { showNotification } = useNotification();
  const { selectedEnvironments } = useCustomerEnvironment();
  
  // Data state
  const [services, setServices] = useState([]);
  const [serviceTypes, setServiceTypes] = useState([]);
  const [serviceTypeConfigs, setServiceTypeConfigs] = useState({});
  const [selectedService, setSelectedService] = useState(null);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [importJsonDialogOpen, setImportJsonDialogOpen] = useState(false);
  const [controlDialogOpen, setControlDialogOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState(null);
  const [serviceToControl, setServiceToControl] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [metaFilters, setMetaFilters] = useState({});

  // Pagination
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);

  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  /**
   * Fetch services from API with filters and pagination
   */
  const fetchServices = useCallback(async (overrides = null) => {
    const effectiveSortBy = overrides?.sortBy ?? sortBy;
    const effectiveSortOrder = overrides?.sortOrder ?? sortOrder;
    const effectivePage = overrides?.page ?? page;

    setLoading(true);
    setError(null);

    try {
      const params = {
        page: effectivePage + 1, // Backend uses 1-based pagination
        // Mediators::Search::Base reads per_page (limit is ignored, which
        // silently pinned every page to Config.pagination_limit).
        per_page: rowsPerPage,
        order_by: effectiveSortBy,
        order_type: effectiveSortOrder
      };

      // NOTE: no environment filter here. Services are customer-scoped — ::Service
      // is on the filter_environments exclusion list in the API's search base, and
      // membership lives in the services.environment_uuids array rather than an
      // environment_uuid column. Passing environment_uuid was a silent no-op, and
      // passing it as search[environment_uuid] would query a column that does not
      // exist. Filtering by environment needs API support first.

      // Add filters using search[field] format (matching legacy AngularJS pattern)
      if (searchQuery) params['search[name]'] = searchQuery;
      if (typeFilter) params['search[type]'] = typeFilter;
      if (statusFilter) params['search[enabled]'] = statusFilter;

      // Handle meta tag filters
      if (metaFilters && typeof metaFilters === 'object') {
        Object.entries(metaFilters).forEach(([metaKey, metaValue]) => {
          params[`search[meta][${metaKey}]`] = metaValue;
        });
      }

      const response = await servicesApi.list(params);

      // Handle both array and paginated response formats
      if (Array.isArray(response)) {
        setServices(response);
        setTotalCount(response.length);
      } else {
        setServices(response.data || response.services || []);
        setTotalCount(response.total || response.total_records || 0);
      }
    } catch (err) {
      console.error('Error fetching services:', err);
      setError(err.message || 'Failed to load services');
      showNotification('Failed to load services', 'error');
      // Set empty on error
      setServices([]);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, searchQuery, typeFilter, statusFilter, metaFilters, selectedEnvironments, showNotification]);

  /**
   * Fetch available service types from API
   */
  const fetchServiceTypes = useCallback(async () => {
    try {
      const response = await servicesApi.getTypes();

      // Extract type names from response and store full configs
      if (typeof response === 'object' && !Array.isArray(response)) {
        // Response is an object with type configurations
        setServiceTypes(Object.keys(response));
        setServiceTypeConfigs(response);
      } else if (Array.isArray(response)) {
        setServiceTypes(response);
        setServiceTypeConfigs({});
      } else {
        // Fallback to common types
        setServiceTypes(['webhook', 'report', 'monitor', 'provider', 'notification', 'workflow', 'powerlink', 'fireberry', 'transcribe', 'rule', 'caller_id_number']);
        setServiceTypeConfigs({});
      }
    } catch (err) {
      console.error('Error fetching service types:', err);
      // Fallback to common types on error
      setServiceTypes(['webhook', 'report', 'monitor', 'provider', 'notification', 'workflow', 'powerlink', 'fireberry', 'transcribe', 'rule', 'caller_id_number']);
      setServiceTypeConfigs({});
    }
  }, []);

  /**
   * Create a new service
   */
  const createService = useCallback(async (data) => {
    setLoading(true);
    try {
      const createdService = await servicesApi.create(data);
      showNotification(`Service "${data.name}" created successfully`, 'success');
      setDialogOpen(false);
      fetchServices(); // Refresh list
      return createdService;
    } catch (err) {
      console.error('Error creating service:', err);
      showNotification(err.message || 'Failed to create service', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showNotification, fetchServices]);

  /**
   * Update an existing service
   */
  const updateService = useCallback(async (uuid, data) => {
    setLoading(true);
    try {
      const updatedService = await servicesApi.update(uuid, data);
      showNotification(`Service "${data.name}" updated successfully`, 'success');
      setDialogOpen(false);
      fetchServices(); // Refresh list
      return updatedService;
    } catch (err) {
      console.error('Error updating service:', err);
      showNotification(err.message || 'Failed to update service', 'error');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [showNotification, fetchServices]);

  /**
   * Delete a service
   */
  const deleteService = useCallback(async (uuid) => {
    setLoading(true);
    try {
      await servicesApi.delete(uuid);
      showNotification('Service deleted successfully', 'success');
      setDeleteDialogOpen(false);
      setSelectedService(null);
      fetchServices(); // Refresh list
    } catch (err) {
      console.error('Error deleting service:', err);
      showNotification(err.message || 'Failed to delete service', 'error');
    } finally {
      setLoading(false);
    }
  }, [showNotification, fetchServices]);

  /**
   * Toggle service enabled status
   */
  const toggleServiceStatus = useCallback(async (service) => {
    try {
      await servicesApi.update(service.uuid, {
        enabled: !service.enabled
      });
      showNotification(
        `Service ${service.enabled ? 'disabled' : 'enabled'} successfully`,
        'success'
      );
      fetchServices(); // Refresh list
    } catch (err) {
      console.error('Error toggling service status:', err);
      showNotification('Failed to update service status', 'error');
    }
  }, [showNotification, fetchServices]);

  /**
   * Handle save service (create or update)
   */
  const handleSaveService = useCallback(async (data) => {
    if (selectedService) {
      await updateService(selectedService.uuid, data);
    } else {
      await createService(data);
    }
  }, [selectedService, createService, updateService]);

  /**
   * Open dialog for creating new service
   */
  const handleOpenCreateDialog = useCallback(() => {
    setSelectedService(null);
    setDialogOpen(true);
  }, []);

  /**
   * Open dialog for editing service
   * Fetches individual service data via GET /api/services/{uuid}
   */
  const handleOpenEditDialog = useCallback(async (service) => {
    try {
      setLoading(true);
      // EDIT MODE: Fetch individual service data from API (not from list)
      const serviceId = service.id || service.uuid;
      const fullServiceData = await servicesApi.get(serviceId);
      setSelectedService(fullServiceData);
      console.log('Loaded full service data for editing:', fullServiceData);
      setDialogOpen(true);
    } catch (error) {
      console.error('Error loading service details:', error);
      // Fallback to using list data if API fails
      setSelectedService(service);
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Open delete confirmation dialog
   */
  const handleOpenDeleteDialog = useCallback((service) => {
    setServiceToDelete(service);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Close delete confirmation dialog
   */
  const handleCloseDeleteDialog = useCallback(() => {
    setServiceToDelete(null);
    setDeleteDialogOpen(false);
  }, []);

  /**
   * Handle delete service from dialog
   */
  const handleDeleteService = useCallback(async () => {
    if (serviceToDelete) {
      await deleteService(serviceToDelete.uuid);
      setServiceToDelete(null);
    }
  }, [serviceToDelete, deleteService]);

  /**
   * Open control dialog
   */
  const handleOpenControlDialog = useCallback((service) => {
    setServiceToControl(service);
    setControlDialogOpen(true);
  }, []);

  /**
   * Close control dialog
   */
  const handleCloseControlDialog = useCallback(() => {
    setServiceToControl(null);
    setControlDialogOpen(false);
  }, []);

  /**
   * Handle control service action
   */
  const handleControlService = useCallback(async (serviceId, action) => {
    try {
      // TODO: Implement service control API when available
      showNotification(`Service ${action} action requested`, 'info');
      handleCloseControlDialog();
    } catch (err) {
      console.error('Error controlling service:', err);
      showNotification('Failed to control service', 'error');
    }
  }, [showNotification, handleCloseControlDialog]);

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
  const handleSortChange = useCallback((column) => {
    const newOrder = sortBy === column ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(column);
    setSortOrder(newOrder);
    setPage(0);
    // State updates re-run the fetch effect — a direct call here double-fetched.
  }, [sortBy, sortOrder, fetchServices]);

  /**
   * Open JSON import dialog
   */
  const handleOpenImportJsonDialog = useCallback(() => {
    setImportJsonDialogOpen(true);
  }, []);

  /**
   * Close JSON import dialog
   */
  const handleCloseImportJsonDialog = useCallback(() => {
    setImportJsonDialogOpen(false);
  }, []);

  /**
   * Import services from JSON
   * @param {Array} services - Array of service objects to import
   * @param {Function} onProgress - Progress callback
   * @returns {Promise<Object>} Import result with succeeded and failed counts
   */
  const handleImportJson = useCallback(async (services, onProgress) => {
    const results = {
      succeeded: 0,
      failed: []
    };

    for (let i = 0; i < services.length; i++) {
      const service = services[i];
      try {
        await servicesApi.create(service);
        results.succeeded++;
      } catch (err) {
        results.failed.push({
          name: service.name || `Service ${i + 1}`,
          error: err.message || 'Unknown error'
        });
      }

      // Report progress
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: services.length,
          failed: results.failed
        });
      }
    }

    // Refresh the list after import
    if (results.succeeded > 0) {
      fetchServices();
    }

    if (results.succeeded > 0) {
      showNotification(
        `Imported ${results.succeeded} service(s)${results.failed.length > 0 ? `, ${results.failed.length} failed` : ''}`,
        results.failed.length > 0 ? 'warning' : 'success'
      );
    }

    return results;
  }, [fetchServices, showNotification]);

  // Fetch services on mount and when filters change
  useEffect(() => {
    if (access) {
      fetchServices();
    }
  }, [fetchServices, access]);

  // Fetch service types on mount
  useEffect(() => {
    if (access) {
      fetchServiceTypes();
    }
  }, [fetchServiceTypes, access]);

  return {
    // Data
    services,
    serviceTypes,
    serviceTypeConfigs,
    selectedService,

    // UI state
    loading,
    error,
    dialogOpen,
    deleteDialogOpen,
    importJsonDialogOpen,
    controlDialogOpen,
    serviceToDelete,
    serviceToControl,

    // Filters
    searchQuery,
    typeFilter,
    statusFilter,

    // Pagination
    page,
    rowsPerPage,
    totalCount,

    // Sorting
    sortBy,
    sortOrder,

    // Actions
    fetchServices,
    createService,
    updateService,
    deleteService,
    toggleServiceStatus,
    handleSaveService,

    // Dialog actions
    handleOpenCreateDialog,
    handleOpenEditDialog,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteService,
    handleOpenControlDialog,
    handleCloseControlDialog,
    handleControlService,
    setDialogOpen,
    setDeleteDialogOpen,

    // Import JSON actions
    handleOpenImportJsonDialog,
    handleCloseImportJsonDialog,
    handleImportJson,

    // Pagination handlers
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,

    // Filter setters
    setSearchQuery,
    setTypeFilter,
    setStatusFilter,
    setMetaFilters,
    setPage,
    setRowsPerPage
  };
};
