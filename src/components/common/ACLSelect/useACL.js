import { useState, useCallback } from 'react';
import { aclsApi } from '../../../services/api/aclsApi';

/**
 * Custom hook for ACL (Access Control List) management
 * Handles fetching ACLs, types, type data, and CRUD operations
 */
export const useACL = () => {
  // State for ACLs list
  const [acls, setACLs] = useState([]);
  const [aclsLoading, setACLsLoading] = useState(false);
  const [aclsError, setACLsError] = useState(null);

  // State for ACL types
  const [types, setTypes] = useState([]);
  const [typesLoading, setTypesLoading] = useState(false);

  // State for type data (permissions structure)
  const [typeData, setTypeData] = useState(null);
  const [typeDataLoading, setTypeDataLoading] = useState(false);

  // State for single ACL (edit mode)
  const [selectedACL, setSelectedACL] = useState(null);
  const [selectedACLLoading, setSelectedACLLoading] = useState(false);

  // State for saving operations
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState('create'); // 'create' or 'edit'

  /**
   * Fetch all ACLs for dropdown
   */
  const fetchACLs = useCallback(async () => {
    setACLsLoading(true);
    setACLsError(null);
    try {
      const response = await aclsApi.getACLs({ per_page: 9999 });
      const data = Array.isArray(response) ? response : (response?.data || []);
      setACLs(data);
      return data;
    } catch (error) {
      console.error('Error fetching ACLs:', error);
      setACLsError(error.message || 'Failed to fetch ACLs');
      return [];
    } finally {
      setACLsLoading(false);
    }
  }, []);

  /**
   * Fetch available ACL types
   */
  const fetchTypes = useCallback(async () => {
    setTypesLoading(true);
    try {
      const response = await aclsApi.getACLTypes();
      const data = Array.isArray(response) ? response : (response?.data || []);
      setTypes(data);
      return data;
    } catch (error) {
      console.error('Error fetching ACL types:', error);
      return [];
    } finally {
      setTypesLoading(false);
    }
  }, []);

  /**
   * Fetch permissions structure for a specific type
   */
  const fetchTypeData = useCallback(async (type) => {
    if (!type) {
      setTypeData(null);
      return null;
    }

    setTypeDataLoading(true);
    try {
      const response = await aclsApi.getACLTypeData(type);
      // The API returns the permissions structure
      // Expected format: { category: { element: ['permission1', 'permission2'] } }
      const data = response?.data || response || {};
      setTypeData(data);
      return data;
    } catch (error) {
      console.error('Error fetching ACL type data:', error);
      setTypeData(null);
      return null;
    } finally {
      setTypeDataLoading(false);
    }
  }, []);

  /**
   * Fetch a single ACL by ID
   */
  const fetchACL = useCallback(async (aclId) => {
    if (!aclId) {
      setSelectedACL(null);
      return null;
    }

    setSelectedACLLoading(true);
    try {
      const response = await aclsApi.getACL(aclId);
      setSelectedACL(response);

      // Also fetch the type data for this ACL's type
      if (response?.type) {
        await fetchTypeData(response.type);
      }

      return response;
    } catch (error) {
      console.error('Error fetching ACL:', error);
      setSelectedACL(null);
      return null;
    } finally {
      setSelectedACLLoading(false);
    }
  }, [fetchTypeData]);

  /**
   * Create a new ACL
   */
  const createACL = useCallback(async (aclData) => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await aclsApi.createACL(aclData);
      // Refresh ACLs list after creation
      await fetchACLs();
      return response;
    } catch (error) {
      console.error('Error creating ACL:', error);
      setSaveError(error.message || 'Failed to create ACL');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [fetchACLs]);

  /**
   * Update an existing ACL
   */
  const updateACL = useCallback(async (aclId, aclData) => {
    setSaving(true);
    setSaveError(null);
    try {
      const response = await aclsApi.updateACL(aclId, aclData);
      // Refresh ACLs list after update
      await fetchACLs();
      return response;
    } catch (error) {
      console.error('Error updating ACL:', error);
      setSaveError(error.message || 'Failed to update ACL');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [fetchACLs]);

  /**
   * Delete an ACL
   */
  const deleteACL = useCallback(async (aclId) => {
    setSaving(true);
    setSaveError(null);
    try {
      await aclsApi.deleteACL(aclId);
      // Refresh ACLs list after deletion
      await fetchACLs();
      return true;
    } catch (error) {
      console.error('Error deleting ACL:', error);
      setSaveError(error.message || 'Failed to delete ACL');
      throw error;
    } finally {
      setSaving(false);
    }
  }, [fetchACLs]);

  /**
   * Open dialog for creating new ACL
   */
  const openCreateDialog = useCallback(async () => {
    setDialogMode('create');
    setSelectedACL(null);
    setTypeData(null);
    setSaveError(null);

    // Fetch types if not already loaded
    if (types.length === 0) {
      await fetchTypes();
    }

    setDialogOpen(true);
  }, [types.length, fetchTypes]);

  /**
   * Open dialog for editing existing ACL
   */
  const openEditDialog = useCallback(async (aclId) => {
    setDialogMode('edit');
    setSaveError(null);

    // Fetch the ACL data and types in parallel
    await Promise.all([
      fetchACL(aclId),
      types.length === 0 ? fetchTypes() : Promise.resolve()
    ]);

    setDialogOpen(true);
  }, [fetchACL, fetchTypes, types.length]);

  /**
   * Close dialog
   */
  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedACL(null);
    setTypeData(null);
    setSaveError(null);
  }, []);

  /**
   * Handle saving ACL (create or update)
   */
  const handleSave = useCallback(async (aclData) => {
    if (dialogMode === 'create') {
      const result = await createACL(aclData);
      closeDialog();
      return result;
    } else {
      const result = await updateACL(selectedACL.uuid, aclData);
      closeDialog();
      return result;
    }
  }, [dialogMode, selectedACL, createACL, updateACL, closeDialog]);

  return {
    // ACLs list
    acls,
    aclsLoading,
    aclsError,
    fetchACLs,

    // Types
    types,
    typesLoading,
    fetchTypes,

    // Type data (permissions structure)
    typeData,
    typeDataLoading,
    fetchTypeData,

    // Selected ACL
    selectedACL,
    selectedACLLoading,
    fetchACL,

    // CRUD operations
    createACL,
    updateACL,
    deleteACL,
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

export default useACL;
