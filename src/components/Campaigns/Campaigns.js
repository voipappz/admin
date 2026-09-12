import { useState, useEffect, useCallback } from 'react';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { campaignsApi } from '../../services/api/campaignsApi';

/**
 * Custom hook for Campaigns management
 * Provides state management and actions for campaign CRUD + run/stop operations
 */
export const useCampaigns = () => {
  const { selectedCustomer, selectedEnvironments } = useCustomerEnvironment();

  // State management
  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [campaignToDelete, setCampaignToDelete] = useState(null);

  // Duplicate state
  const [duplicateDialogOpen, setDuplicateDialogOpen] = useState(false);
  const [campaignToDuplicate, setCampaignToDuplicate] = useState(null);

  // Pagination and sorting
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  // Filters
  const [filters, setFilters] = useState({
    name: '',
    type: '',
    status: '',
    enabled: '',
    environment_uuid: ''
  });

  /**
   * Fetch campaigns from the API
   */
  const fetchCampaigns = useCallback(async (overrides = null) => {
    const effectiveSortBy = overrides?.sortBy ?? sortBy;
    const effectiveSortOrder = overrides?.sortOrder ?? sortOrder;
    const effectivePage = overrides?.page ?? page;

    setLoading(true);
    setError(null);

    try {
      const params = {
        page: effectivePage + 1,
        per_page: rowsPerPage,
        order_by: effectiveSortBy,
        order_type: effectiveSortOrder === 'asc' ? 'asc' : 'desc'
      };

      if (selectedEnvironments && selectedEnvironments.length > 0) {
        params.environment_uuid = selectedEnvironments[0].uuid;
      }

      // Apply filters
      if (filters.name) params['search[name]'] = filters.name;
      if (filters.type) params['search[type]'] = filters.type;
      if (filters.status) params['search[status]'] = filters.status;
      if (filters.enabled !== '') params['search[enabled]'] = filters.enabled;
      if (filters.environment_uuid) params['search[environment_uuid]'] = filters.environment_uuid;

      // Handle meta tag filters
      if (filters.meta && typeof filters.meta === 'object') {
        Object.entries(filters.meta).forEach(([metaKey, metaValue]) => {
          params[`search[meta][${metaKey}]`] = metaValue;
        });
      }

      const response = await campaignsApi.getCampaigns(params);

      if (Array.isArray(response)) {
        setCampaigns(response);
        setTotalCount(response.length);
      } else if (response?.data && Array.isArray(response.data)) {
        setCampaigns(response.data);
        const totalFromHeader = response.total_records || response.total;
        setTotalCount(totalFromHeader || response.data.length);
      } else {
        setCampaigns([]);
        setTotalCount(0);
      }
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError('Failed to fetch campaigns: ' + err.message);
      setCampaigns([]);
    } finally {
      setLoading(false);
    }
  }, [selectedCustomer, selectedEnvironments, page, rowsPerPage, sortBy, sortOrder, filters]);

  /**
   * Create or update a campaign
   */
  const handleSaveCampaign = useCallback(async (campaignData) => {
    setLoading(true);
    try {
      const dataWithEnv = {
        ...campaignData,
        environment_uuid: campaignData.environment_uuid || selectedEnvironments?.[0]?.uuid
      };

      if (selectedCampaign) {
        await campaignsApi.updateCampaign(selectedCampaign.uuid, dataWithEnv);
      } else {
        await campaignsApi.createCampaign(dataWithEnv);
      }

      setDialogOpen(false);
      setSelectedCampaign(null);
      fetchCampaigns();
    } catch (err) {
      console.error('Error saving campaign:', err);
      setError('Failed to save campaign: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedCampaign, selectedEnvironments, fetchCampaigns]);

  /**
   * Delete a campaign
   */
  const handleDeleteCampaign = useCallback(async () => {
    if (!campaignToDelete) return;

    setLoading(true);
    try {
      await campaignsApi.deleteCampaign(campaignToDelete.uuid);
      setCampaigns(prev => prev.filter(c => c.uuid !== campaignToDelete.uuid));
      setTotalCount(prev => prev - 1);
      setDeleteDialogOpen(false);
      setCampaignToDelete(null);
    } catch (err) {
      console.error('Error deleting campaign:', err);
      setError('Failed to delete campaign: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [campaignToDelete]);

  /**
   * Run a campaign
   */
  const handleRunCampaign = useCallback(async (id) => {
    setLoading(true);
    try {
      await campaignsApi.runCampaign(id);
      fetchCampaigns();
    } catch (err) {
      console.error('Error running campaign:', err);
      setError('Failed to run campaign: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns]);

  /**
   * Stop a campaign
   */
  const handleStopCampaign = useCallback(async (id) => {
    setLoading(true);
    try {
      await campaignsApi.stopCampaign(id);
      fetchCampaigns();
    } catch (err) {
      console.error('Error stopping campaign:', err);
      setError('Failed to stop campaign: ' + err.message);
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns]);

  /**
   * Duplicate a campaign
   */
  const handleDuplicateCampaign = useCallback(async (campaignId, newName) => {
    setLoading(true);
    try {
      await campaignsApi.duplicateCampaign(campaignId, newName);
      setDuplicateDialogOpen(false);
      setCampaignToDuplicate(null);
      fetchCampaigns();
    } catch (err) {
      console.error('Error duplicating campaign:', err);
      setError('Failed to duplicate campaign: ' + err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchCampaigns]);

  // Dialog handlers
  const handleOpenDialog = useCallback(async (campaign = null) => {
    if (campaign) {
      try {
        setLoading(true);
        const fullData = await campaignsApi.getCampaign(campaign.uuid);
        setSelectedCampaign(fullData);
      } catch {
        setSelectedCampaign(campaign);
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedCampaign(null);
    }
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedCampaign(null);
  }, []);

  const handleOpenDeleteDialog = useCallback((campaign) => {
    setCampaignToDelete(campaign);
    setDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setCampaignToDelete(null);
  }, []);

  const handleOpenDuplicateDialog = useCallback((campaign) => {
    setCampaignToDuplicate(campaign);
    setDuplicateDialogOpen(true);
  }, []);

  const handleCloseDuplicateDialog = useCallback(() => {
    setDuplicateDialogOpen(false);
    setCampaignToDuplicate(null);
  }, []);

  // Pagination handlers
  const handlePageChange = useCallback((_event, newPage) => {
    setPage(newPage);
  }, []);

  const handleRowsPerPageChange = useCallback((event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  }, []);

  // Sorting handler - directly triggers fetch with new sort params
  const handleSortChange = useCallback((field) => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    const newOrder = isAsc ? 'desc' : 'asc';
    setSortOrder(newOrder);
    setSortBy(field);
    setPage(0);
    // State updates re-run the fetch effect — a direct call here double-fetched.
  }, [sortBy, sortOrder, fetchCampaigns]);

  // Filters handler
  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  // Fetch campaigns on mount and when dependencies change
  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  return {
    // State
    campaigns,
    loading,
    error,
    selectedCampaign,
    dialogOpen,
    deleteDialogOpen,
    campaignToDelete,
    duplicateDialogOpen,
    campaignToDuplicate,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortOrder,
    filters,

    // Actions
    handleOpenDialog,
    handleCloseDialog,
    handleSaveCampaign,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteCampaign,
    handleOpenDuplicateDialog,
    handleCloseDuplicateDialog,
    handleDuplicateCampaign,
    handleRunCampaign,
    handleStopCampaign,
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,
    handleFiltersChange,
    fetchCampaigns,
  };
};
