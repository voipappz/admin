import { useState, useEffect, useCallback } from 'react';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { templatesApi } from '../../services/api/templatesApi';
import { useNotification } from '../../context/NotificationContext';

export const TEMPLATE_TYPES = [
  'sms', 'account', 'user', 'voicemail', 'facsimile',
  'conference', 'call', 'subscription', 'reminder'
];

export const useTemplates = () => {
  useCustomerEnvironment(); // subscribe to environment changes
  const { showSuccess, showError } = useNotification();

  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [templateToDelete, setTemplateToDelete] = useState(null);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [filters, setFilters] = useState({
    name: '',
    type: '',
    enabled: ''
  });

  const fetchTemplates = useCallback(async (overrides = null) => {
    const effectiveSortBy = overrides?.sortBy ?? sortBy;
    const effectiveSortOrder = overrides?.sortOrder ?? sortOrder;
    const effectivePage = overrides?.page ?? page;

    try {
      setLoading(true);
      const params = {
        page: effectivePage + 1,
        per_page: rowsPerPage,
        order_by: effectiveSortBy,
        order_type: effectiveSortOrder
      };

      if (filters.name) params['search[name]'] = filters.name;
      if (filters.type) params['search[type]'] = filters.type;
      if (filters.enabled !== '') params['search[enabled]'] = filters.enabled;
      if (filters.search) params['search[name]'] = filters.search;

      // Handle meta tag filters
      if (filters.meta && typeof filters.meta === 'object') {
        Object.entries(filters.meta).forEach(([metaKey, metaValue]) => {
          params[`search[meta][${metaKey}]`] = metaValue;
        });
      }

      const response = await templatesApi.getTemplates(params);

      if (Array.isArray(response)) {
        setTemplates(response);
        setTotalCount(response.length);
      } else if (response?.data && Array.isArray(response.data)) {
        setTemplates(response.data);
        setTotalCount(response.total_records || response.total || response.data.length);
      } else {
        setTemplates([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
      showError('Failed to load templates');
      setTemplates([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, sortBy, sortOrder, filters, showError]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Listen for environment change events to refresh data
  useEffect(() => {
    const handleEnvironmentChange = () => {
      fetchTemplates();
    };
    window.addEventListener('environmentChanged', handleEnvironmentChange);
    return () => window.removeEventListener('environmentChanged', handleEnvironmentChange);
  }, [fetchTemplates]);

  const handleOpenDialog = useCallback(async (template = null) => {
    if (template) {
      try {
        setLoading(true);
        const full = await templatesApi.getTemplate(template.uuid);
        setSelectedTemplate(full);
      } catch {
        setSelectedTemplate(template);
      } finally {
        setLoading(false);
      }
    } else {
      setSelectedTemplate(null);
    }
    setDialogOpen(true);
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedTemplate(null);
  }, []);

  const handleSaveTemplate = useCallback(async (data) => {
    try {
      setLoading(true);
      if (selectedTemplate) {
        await templatesApi.updateTemplate(selectedTemplate.uuid, data);
        showSuccess('Template updated successfully');
      } else {
        await templatesApi.createTemplate(data);
        showSuccess('Template created successfully');
      }
      handleCloseDialog();
      await fetchTemplates();
    } catch (error) {
      const msg = error?.response?.data?.message || error?.message || 'Failed to save template';
      showError(msg);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [selectedTemplate, showSuccess, showError, fetchTemplates, handleCloseDialog]);

  const handleOpenDeleteDialog = useCallback((template) => {
    setTemplateToDelete(template);
    setDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setTemplateToDelete(null);
  }, []);

  const handleDeleteTemplate = useCallback(async () => {
    if (!templateToDelete) return;
    try {
      setLoading(true);
      await templatesApi.deleteTemplate(templateToDelete.uuid);
      showSuccess('Template deleted successfully');
      handleCloseDeleteDialog();
      await fetchTemplates();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to delete template');
    } finally {
      setLoading(false);
    }
  }, [templateToDelete, showSuccess, showError, fetchTemplates, handleCloseDeleteDialog]);

  const handlePageChange = useCallback((_, newPage) => setPage(newPage), []);
  const handleRowsPerPageChange = useCallback((e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  // Direct fetch on sort change (same pattern as DIDs)
  const handleSortChange = useCallback((field) => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    const newOrder = isAsc ? 'desc' : 'asc';
    setSortOrder(newOrder);
    setSortBy(field);
    setPage(0);
    // State updates re-run the fetch effect — a direct call here double-fetched.
  }, [sortBy, sortOrder, fetchTemplates]);

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  return {
    templates, loading, selectedTemplate,
    dialogOpen, deleteDialogOpen, templateToDelete,
    page, rowsPerPage, totalCount, sortBy, sortOrder, filters,
    TEMPLATE_TYPES,
    handleOpenDialog, handleCloseDialog, handleSaveTemplate,
    handleOpenDeleteDialog, handleCloseDeleteDialog, handleDeleteTemplate,
    handlePageChange, handleRowsPerPageChange, handleSortChange,
    handleFiltersChange, fetchTemplates,
  };
};

export default useTemplates;
