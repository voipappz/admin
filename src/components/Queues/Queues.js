import { useState, useEffect, useCallback } from 'react';
import { queuesApi } from '../../services/api/queuesApi';
import { useNotification } from '../../context/NotificationContext';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';

/**
 * Custom hook for Queues management
 * Handles business logic for queue CRUD operations with table pattern and filters
 */
export const useQueues = () => {
  const [queues, setQueues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [queueToDelete, setQueueToDelete] = useState(null);

  // Pagination and sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filters
  const [filters, setFilters] = useState({
    search: '',
    enabled: '',
    environment_uuid: '',
    strategy: '',
  });

  const { showSuccess, showError } = useNotification();
  const { selectedEnvironments } = useCustomerEnvironment();

  /**
   * Fetch queues from API with filters, pagination, and sorting
   */
  const fetchQueues = useCallback(async (overrides = null) => {
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

      if (selectedEnvironments?.length > 0) {
        params.environment_uuid = selectedEnvironments[0].uuid;
      }

      // Apply filters using search[field] format
      Object.keys(filters).forEach(key => {
        if (filters[key] !== '') {
          switch (key) {
            case 'search':
              params['search[name]'] = filters[key];
              break;
            case 'enabled':
              params['search[enabled]'] = filters[key];
              break;
            case 'strategy':
              params['search[strategy]'] = filters[key];
              break;
            case 'environment_uuid':
              params['search[environment_uuid]'] = filters[key];
              break;
            default:
              break;
          }
        }
      });

      const response = await queuesApi.getQueues(params);

      if (Array.isArray(response)) {
        setQueues(response);
        setTotalCount(response.length);
      } else if (response.data && Array.isArray(response.data)) {
        const total = response.total_records || response.total || response.data.length;
        setQueues(response.data);
        setTotalCount(total);
      } else {
        setQueues([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching queues:', error);
      showError('Failed to load queues');
      setQueues([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [selectedEnvironments, page, rowsPerPage, sortBy, sortOrder, filters, showError]);

  useEffect(() => {
    fetchQueues();
  }, [fetchQueues]);

  const handleOpenDialog = useCallback(async (queue = null) => {
    try {
      if (queue) {
        setLoading(true);
        const fullQueue = await queuesApi.getQueue(queue.uuid);
        setSelectedQueue(fullQueue?.data || fullQueue);
      } else {
        setSelectedQueue(null);
      }
      setDialogOpen(true);
    } catch (error) {
      console.error('Error loading queue details:', error);
      showError('Failed to load queue details');
      setSelectedQueue(queue);
      setDialogOpen(true);
    } finally {
      setLoading(false);
    }
  }, [showError]);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedQueue(null);
  }, []);

  const handleSaveQueue = useCallback(async (_queueData) => {
    handleCloseDialog();
    await fetchQueues();
    showSuccess(selectedQueue ? 'Queue updated' : 'Queue created');
  }, [selectedQueue, showSuccess, fetchQueues, handleCloseDialog]);

  const handleOpenDeleteDialog = useCallback((queue) => {
    setQueueToDelete(queue);
    setDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setQueueToDelete(null);
  }, []);

  const handleDeleteQueue = useCallback(async () => {
    if (!queueToDelete) return;

    try {
      setLoading(true);
      await queuesApi.deleteQueue(queueToDelete.uuid);
      showSuccess('Queue deleted successfully');
      handleCloseDeleteDialog();
      await fetchQueues();
    } catch (error) {
      console.error('Error deleting queue:', error);
      showError(error.response?.data?.message || 'Failed to delete queue');
    } finally {
      setLoading(false);
    }
  }, [queueToDelete, showSuccess, showError, fetchQueues, handleCloseDeleteDialog]);

  const handlePageChange = useCallback((event, newPage) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  const handleSortChange = useCallback((field) => {
    const newOrder = sortBy === field ? (sortOrder === 'asc' ? 'desc' : 'asc') : 'asc';
    setSortBy(field);
    setSortOrder(newOrder);
    setPage(0);
    // State updates re-run the fetch effect — a direct call here double-fetched.
  }, [sortBy, sortOrder, fetchQueues]);

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
    setPage(0);
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters({ search: '', enabled: '', environment_uuid: '', strategy: '' });
    setPage(0);
  }, []);

  return {
    queues,
    loading,
    selectedQueue,
    dialogOpen,
    deleteDialogOpen,
    queueToDelete,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortOrder,
    filters,
    environments: selectedEnvironments || [],
    handleOpenDialog,
    handleCloseDialog,
    handleSaveQueue,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteQueue,
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,
    handleFiltersChange,
    handleResetFilters,
    fetchQueues
  };
};

export default useQueues;
