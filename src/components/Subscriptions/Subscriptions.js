import { useState, useEffect, useCallback, useRef } from 'react';
import { subscriptionsApi } from '../../services/api/subscriptionsApi';
import { tariffsApi } from '../../services/api/tariffsApi';
import { useNotification } from '../../context/NotificationContext';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';

/**
 * Custom hook for Subscriptions management
 * Handles business logic for subscription CRUD operations based on AngularJS legacy patterns
 * 
 * Core Fields from Research:
 * - name (required), enabled (boolean), recurring (boolean)
 * - begins_at, ends_at (date fields)
 * - status (dropdown), balance (numeric, required)
 * - environment_uuid (required), plan_uuid (required)
 * - items (dynamic array with product_uuid and profile)
 * - meta (key-value pairs)
 * - notes (textarea)
 */
export const useSubscriptions = () => {
  // State management
  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [subscriptionToDelete, setSubscriptionToDelete] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Helper data
  const [plans, setPlans] = useState([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [tariffs, setTariffs] = useState([]);
  const [tariffsLoading, setTariffsLoading] = useState(false);
  const [statuses, setStatuses] = useState([]);
  const [environments, setEnvironments] = useState([]);

  // Filters based on research findings
  const [filters, setFilters] = useState({
    // Text search
    name: '',
    balance: '',

    // Dropdown filters
    environment_uuid: '',
    status: '',
    plan_uuid: '',
    enabled: '',     // true/false/''
    recurring: '',   // true/false/''

    // Date range filters (format: "start_timestamp-end_timestamp")
    created_at: '',
    updated_at: '',
    ends_at: ''
  });

  // Context hooks
  const { showSuccess, showError } = useNotification();
  const { selectedEnvironments } = useCustomerEnvironment();

  // Ref to prevent duplicate API calls
  const fetchInProgress = useRef(false);
  const lastFetchParams = useRef(null);

  /**
   * Fetch subscriptions from API with filters based on legacy pattern
   */
  const fetchSubscriptions = useCallback(async (overrides = null) => {
    const effectiveSortBy = overrides?.sortBy ?? sortBy;
    const effectiveSortOrder = overrides?.sortOrder ?? sortOrder;
    const effectivePage = overrides?.page ?? page;

    // Create a params key to detect duplicate calls
    const paramsKey = JSON.stringify({
      page: effectivePage, rowsPerPage, sortBy: effectiveSortBy, sortOrder: effectiveSortOrder,
      envUuid: selectedEnvironments?.[0]?.uuid,
      filters
    });

    // Skip if same params already being fetched
    if (fetchInProgress.current && lastFetchParams.current === paramsKey) {
      console.log('⏭️ Skipping duplicate subscriptions fetch');
      return;
    }

    try {
      fetchInProgress.current = true;
      lastFetchParams.current = paramsKey;
      setLoading(true);
      const params = {
        page: effectivePage + 1, // API is 1-indexed
        per_page: rowsPerPage,
        order_by: effectiveSortBy,
        order_type: effectiveSortOrder
      };

      // Add environment filter if environments are selected
      if (selectedEnvironments && selectedEnvironments.length > 0) {
        // Use first selected environment (matching DIDs pattern)
        params.environment_uuid = selectedEnvironments[0].uuid;
      }

      // Add filters to params using search[field] format (matching legacy AngularJS pattern)
      Object.keys(filters).forEach(key => {
        if (filters[key] !== '') {
          // All filters use search[field] format including date ranges
          params[`search[${key}]`] = filters[key];
        }
      });

      // Handle meta tag filters
      if (filters.meta && typeof filters.meta === 'object') {
        Object.entries(filters.meta).forEach(([metaKey, metaValue]) => {
          params[`search[meta][${metaKey}]`] = metaValue;
        });
      }

      const response = await subscriptionsApi.getSubscriptions(params);

      if (Array.isArray(response)) {
        setSubscriptions(response);
        setTotalCount(response.length);
      } else if (response.data && Array.isArray(response.data)) {
        setSubscriptions(response.data);
        setTotalCount(response.total_records || response.total || response.data.length);
      } else {
        setSubscriptions([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching subscriptions:', error);
      showError('Failed to load subscriptions');
      setSubscriptions([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
      fetchInProgress.current = false;
    }
  }, [selectedEnvironments, page, rowsPerPage, sortBy, sortOrder, showError, filters]);

  /**
   * Fetch plans for dropdowns
   * NOTE: Plans are customer-level resources, NOT environment-specific
   * Do NOT filter by environment_uuid
   */
  const fetchPlans = useCallback(async () => {
    setPlansLoading(true);
    try {
      const params = { per_page: 9999 }; // Get all plans

      // Plans are customer-level resources - do NOT filter by environment
      // They belong to the customer, not to individual environments

      const response = await subscriptionsApi.getPlans(params);
      setPlans(Array.isArray(response) ? response : response.data || []);
    } catch (err) {
      console.error("Failed to fetch plans:", err);
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, []); // Remove selectedEnvironments dependency

  /**
   * Fetch tariffs for the subscription tariff dropdown
   */
  const fetchTariffs = useCallback(async () => {
    setTariffsLoading(true);
    try {
      const response = await tariffsApi.getTariffs({ per_page: 9999 });
      setTariffs(Array.isArray(response) ? response : response.data || []);
    } catch (err) {
      console.error("Failed to fetch tariffs:", err);
      setTariffs([]);
    } finally {
      setTariffsLoading(false);
    }
  }, []);

  /**
   * Load statuses from API
   * API returns: ['create', 'active', 'terminate', 'canceled', 'expired']
   */
  const fetchStatuses = useCallback(async () => {
    try {
      const response = await subscriptionsApi.getSubscriptionStatuses();
      // API returns array of strings like ['create', 'active', 'terminate', 'canceled', 'expired']
      const statusList = Array.isArray(response) ? response : [];
      // Convert to objects with value and label (capitalize for display)
      setStatuses(statusList.map(status => ({
        value: status,
        label: status.charAt(0).toUpperCase() + status.slice(1)
      })));
    } catch (error) {
      console.error('Error fetching statuses:', error);
      // Fallback to known API statuses if fetch fails
      setStatuses([
        { value: 'create', label: 'Create' },
        { value: 'active', label: 'Active' },
        { value: 'terminate', label: 'Terminate' },
        { value: 'canceled', label: 'Canceled' },
        { value: 'expired', label: 'Expired' }
      ]);
    }
  }, []);

  /**
   * Load subscriptions and helper data on component mount and when dependencies change
   */
  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  useEffect(() => {
    fetchTariffs();
  }, [fetchTariffs]);

  useEffect(() => {
    fetchStatuses();
  }, [fetchStatuses]);

  // Use selectedEnvironments from context for environment dropdown in dialogs
  useEffect(() => {
    setEnvironments(selectedEnvironments || []);
  }, [selectedEnvironments]);

  /**
   * Handle opening create/edit dialog
   * For edit: fetches individual subscription data via GET /api/subscriptions/{uuid}
   *           (includes tariff and balance directly on the subscription)
   * For create: opens empty dialog
   */
  const handleOpenDialog = useCallback(async (subscription = null) => {
    try {
      if (subscription) {
        // EDIT MODE: Fetch individual subscription data from API (not from list)
        setDialogLoading(true);
        const subscriptionId = subscription.id || subscription.uuid;
        try {
          const fullSubscriptionData = await subscriptionsApi.getSubscription(subscriptionId);
          setSelectedSubscription(fullSubscriptionData);
          console.log('Loaded full subscription data:', fullSubscriptionData);
        } catch (fetchError) {
          console.error('Error loading subscription details:', fetchError);
          // Fallback to using list data if API fails
          setSelectedSubscription(subscription);
        }
      } else {
        // CREATE MODE: No subscription data needed
        setSelectedSubscription(null);
      }
      setDialogOpen(true);
    } catch (error) {
      console.error('Error loading subscription dialog:', error);
      setSelectedSubscription(subscription);
      setDialogOpen(true);
    } finally {
      setDialogLoading(false);
    }
  }, []);

  /**
   * Handle closing create/edit dialog
   */
  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedSubscription(null);
  }, []);

  /**
   * Handle saving subscription (create or update)
   * tariff_uuid is a direct subscription field (one tariff per subscription)
   */
  const handleSaveSubscription = useCallback(async (subscriptionData) => {
    try {
      setDialogLoading(true);

      // Extract recurring (belongs to plan, not subscription)
      const { recurring: _recurring, ...subscriptionFields } = subscriptionData;

      if (selectedSubscription) {
        // Update existing subscription
        const savedSubscriptionId = selectedSubscription.id || selectedSubscription.uuid;
        await subscriptionsApi.updateSubscription(savedSubscriptionId, subscriptionFields);
      } else {
        // Create new subscription
        const newSubscriptionData = {
          ...subscriptionFields,
          environment_uuid: subscriptionFields.environment_uuid || (selectedEnvironments && selectedEnvironments.length > 0 ? selectedEnvironments[0].uuid : null)
        };
        await subscriptionsApi.createSubscription(newSubscriptionData);
      }

      showSuccess(selectedSubscription ? 'Subscription updated successfully' : 'Subscription created successfully');
      handleCloseDialog();
      await fetchSubscriptions(); // Refresh the list
    } catch (error) {
      console.error('Error saving subscription:', error);
      const errorMessage =
        error.response?.data?.message ||
        (selectedSubscription ? 'Failed to update subscription' : 'Failed to create subscription');
      showError(errorMessage);
    } finally {
      setDialogLoading(false);
    }
  }, [selectedSubscription, selectedEnvironments, showSuccess, showError, fetchSubscriptions, handleCloseDialog]);

  /**
   * Handle opening delete confirmation dialog
   */
  const handleOpenDeleteDialog = useCallback((subscription) => {
    setSubscriptionToDelete(subscription);
    setDeleteDialogOpen(true);
  }, []);

  /**
   * Handle closing delete confirmation dialog
   */
  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setSubscriptionToDelete(null);
  }, []);

  /**
   * Handle deleting subscription
   */
  const handleDeleteSubscription = useCallback(async () => {
    if (!subscriptionToDelete) return;

    try {
      setDialogLoading(true);
      await subscriptionsApi.deleteSubscription(subscriptionToDelete.id || subscriptionToDelete.uuid);
      showSuccess('Subscription deleted successfully');
      handleCloseDeleteDialog();
      await fetchSubscriptions(); // Refresh the list
    } catch (error) {
      console.error('Error deleting subscription:', error);
      const errorMessage = error.response?.data?.message || 'Failed to delete subscription';
      showError(errorMessage);
    } finally {
      setDialogLoading(false);
    }
  }, [subscriptionToDelete, showSuccess, showError, fetchSubscriptions, handleCloseDeleteDialog]);

  /**
   * Handle canceling subscription (set to cancel at next period)
   */
  const handleCancelSubscription = useCallback(async (subscription, reason = '') => {
    try {
      setLoading(true);
      await subscriptionsApi.cancelSubscription(subscription.id || subscription.uuid, reason);
      showSuccess('Subscription scheduled for cancellation');
      await fetchSubscriptions(); // Refresh the list
    } catch (error) {
      console.error('Error canceling subscription:', error);
      const errorMessage = error.response?.data?.message || 'Failed to cancel subscription';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError, fetchSubscriptions]);

  /**
   * Handle terminating subscription (immediate termination)
   */
  const handleTerminateSubscription = useCallback(async (subscription) => {
    try {
      setLoading(true);
      await subscriptionsApi.terminateSubscription(subscription.id || subscription.uuid);
      showSuccess('Subscription terminated successfully');
      await fetchSubscriptions(); // Refresh the list
    } catch (error) {
      console.error('Error terminating subscription:', error);
      const errorMessage = error.response?.data?.message || 'Failed to terminate subscription';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError, fetchSubscriptions]);

  /**
   * Handle duplicating subscription
   */
  const handleDuplicateSubscription = useCallback(async (subscription) => {
    try {
      setLoading(true);
      await subscriptionsApi.duplicateSubscription(subscription.id || subscription.uuid);
      showSuccess('Subscription duplicated successfully');
      await fetchSubscriptions(); // Refresh the list
    } catch (error) {
      console.error('Error duplicating subscription:', error);
      const errorMessage = error.response?.data?.message || 'Failed to duplicate subscription';
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError, fetchSubscriptions]);

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
    // The state updates above re-run the fetch effect — a direct call here
    // double-fetched (one request from here + one from the effect).
  }, [sortBy, sortOrder, fetchSubscriptions]);

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
      name: '',
      balance: '',
      environment_uuid: '',
      status: '',
      plan_uuid: '',
      enabled: '',
      recurring: '',
      created_at: '',
      updated_at: '',
      ends_at: ''
    });
    setPage(0);
  }, []);

  return {
    // State
    subscriptions,
    loading,
    dialogLoading,
    selectedSubscription,
    dialogOpen,
    deleteDialogOpen,
    subscriptionToDelete,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortOrder,
    plans,
    plansLoading,
    tariffs,
    tariffsLoading,
    statuses,
    environments,
    filters,

    // Actions
    handleOpenDialog,
    handleCloseDialog,
    handleSaveSubscription,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteSubscription,
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,
    handleFiltersChange,
    handleResetFilters,
    fetchSubscriptions,
    fetchPlans, // Exposed for PlanSelect to refresh after create/edit

    // Special Actions
    handleCancelSubscription,
    handleTerminateSubscription,
    handleDuplicateSubscription,
  };
};

export default useSubscriptions;