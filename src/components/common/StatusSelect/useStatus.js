import { useState, useCallback } from 'react';
import { statusesApi } from '../../../services/api/statusesApi';

/**
 * Custom hook for Status management
 * Handles fetching statuses and CRUD operations
 */
export const useStatus = () => {
  // State for statuses list
  const [statuses, setStatuses] = useState([]);
  const [statusesLoading, setStatusesLoading] = useState(false);
  const [statusesError, setStatusesError] = useState(null);

  // State for single status (edit mode)
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [selectedStatusLoading, setSelectedStatusLoading] = useState(false);

  // State for saving operations
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'

  /**
   * Fetch all statuses for dropdown
   */
  const fetchStatuses = useCallback(async () => {
    setStatusesLoading(true);
    setStatusesError(null);
    try {
      const response = await statusesApi.getStatuses({ per_page: 9999 });
      const data = Array.isArray(response) ? response : (response?.data || []);
      setStatuses(data);
      return data;
    } catch (error) {
      console.error('Error fetching statuses:', error);
      setStatusesError(error.message || 'Failed to fetch statuses');
      return [];
    } finally {
      setStatusesLoading(false);
    }
  }, []);

  /**
   * Fetch a single status by ID
   */
  const fetchStatus = useCallback(async (statusId) => {
    if (!statusId) {
      setSelectedStatus(null);
      return null;
    }

    setSelectedStatusLoading(true);
    try {
      const response = await statusesApi.getStatus(statusId);
      setSelectedStatus(response);
      return response;
    } catch (error) {
      console.error('Error fetching status:', error);
      setSelectedStatus(null);
      return null;
    } finally {
      setSelectedStatusLoading(false);
    }
  }, []);

  /**
   * Create a new status
   */
  const createStatus = useCallback(async (statusData) => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await statusesApi.createStatus(statusData);
      // Refresh statuses list after creation
      await fetchStatuses();
      return response;
    } catch (error) {
      console.error('Error creating status:', error);
      setSaveError(error.message || 'Failed to create status');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [fetchStatuses]);

  /**
   * Update an existing status
   */
  const updateStatus = useCallback(async (statusId, statusData) => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await statusesApi.updateStatus(statusId, statusData);
      // Refresh statuses list after update
      await fetchStatuses();
      return response;
    } catch (error) {
      console.error('Error updating status:', error);
      setSaveError(error.message || 'Failed to update status');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [fetchStatuses]);

  /**
   * Delete a status
   */
  const deleteStatus = useCallback(async (statusId) => {
    setSaving(true);
    setSaveError(null);
    try {
      await statusesApi.deleteStatus(statusId);
      // Refresh statuses list after deletion
      await fetchStatuses();
      return true;
    } catch (error) {
      console.error('Error deleting status:', error);
      setSaveError(error.message || 'Failed to delete status');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [fetchStatuses]);

  /**
   * Open dialog for creating new status
   */
  const openCreateDialog = useCallback(() => {
    setDialogMode('create');
    setSelectedStatus(null);
    setSaveError(null);
    setDialogOpen(true);
  }, []);

  /**
   * Open dialog for editing existing status
   */
  const openEditDialog = useCallback(async (statusId) => {
    setDialogMode('edit');
    setSaveError(null);
    await fetchStatus(statusId);
    setDialogOpen(true);
  }, [fetchStatus]);

  /**
   * Close dialog
   */
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedStatus(null);
    setSaveError(null);
  }, []);

  /**
   * Handle saving status (create or update)
   */
  const handleSave = useCallback(async (statusData) => {
    if (dialogMode === 'create') {
      const result = await createStatus(statusData);
      closeDialog();
      return result;
    } else {
      const result = await updateStatus(selectedStatus.uuid, statusData);
      closeDialog();
      return result;
    }
  }, [dialogMode, selectedStatus, createStatus, updateStatus, closeDialog]);

  return {
    // Statuses list
    statuses,
    statusesLoading,
    statusesError,
    fetchStatuses,

    // Selected status
    selectedStatus,
    selectedStatusLoading,
    fetchStatus,

    // CRUD operations
    createStatus,
    updateStatus,
    deleteStatus,
    saving,
    saveError,

    // Dialog
    dialogOpen,
    dialogMode,
    openCreateDialog,
    openEditDialog,
    closeDialog,
    handleSave
  };
};

export default useStatus;
