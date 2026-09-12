import { useState, useEffect, useCallback } from 'react';
import { tariffsApi } from '../../services/api/tariffsApi';
import { useNotification } from '../../context/NotificationContext';

// Scheme options for the filter dropdown.
//
// There is NO schemes catalog on the backend: `/api/tariffs?action=schemes`
// isn't a recognised action (only `types`, `rates` and `rate` are), so it falls
// through to the ordinary list and answers with tariff RECORDS. Calling
// tariffsApi.getSchemes() here would therefore fill the dropdown with one entry
// per tariff. Instead: start from the vocabulary TariffBridge offers and add
// any scheme actually present in the data, which also covers values the
// hardcoded list doesn't know about (real data has `volume`).
export const TARIFF_SCHEMES = ['flat', 'tiered', 'usage', 'prepaid', 'postpaid'];

export const useTariffs = () => {
  const { showSuccess, showError } = useNotification();

  const [tariffs, setTariffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTariff, setSelectedTariff] = useState(null);
  const [dialogMode, setDialogMode] = useState('create');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tariffToDelete, setTariffToDelete] = useState(null);
  const [schemes, setSchemes] = useState(TARIFF_SCHEMES);

  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [totalCount, setTotalCount] = useState(0);
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');

  const [filters, setFilters] = useState({ name: '', scheme: '', enabled: '' });

  const fetchTariffs = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        page: page + 1,
        per_page: rowsPerPage,
        order_by: sortBy,
        order_type: sortOrder,
      };
      // Quick-search text arrives as `search`; tariffs only have a name to
      // match it against.
      const name = filters.name || filters.search;
      if (name) params.name = name;
      if (filters.scheme) params.scheme = filters.scheme;
      if (filters.enabled !== '' && filters.enabled !== undefined) params.enabled = filters.enabled;

      const response = await tariffsApi.getTariffs(params);

      if (Array.isArray(response)) {
        setTariffs(response);
        setTotalCount(response.length);
      } else if (Array.isArray(response?.data)) {
        setTariffs(response.data);
        setTotalCount(response.total_records || response.total || response.data.length);
      } else {
        setTariffs([]);
        setTotalCount(0);
      }
    } catch (error) {
      console.error('Error fetching tariffs:', error);
      showError('Failed to load tariffs');
      setTariffs([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, sortBy, sortOrder, filters, showError]);

  useEffect(() => { fetchTariffs(); }, [fetchTariffs]);

  // Accumulate schemes seen in the data on top of the known vocabulary. Union
  // rather than replace, so options don't vanish once a filter narrows the
  // rows that produced them.
  useEffect(() => {
    if (!tariffs.length) return;
    setSchemes((prev) => {
      const merged = new Set(prev);
      tariffs.forEach((t) => { if (t.scheme) merged.add(t.scheme); });
      return merged.size === prev.length ? prev : Array.from(merged);
    });
  }, [tariffs]);

  // Tariffs are customer-scoped, not environment-scoped, but the customer can
  // change under the same mount — refetch when the selector reloads.
  useEffect(() => {
    const handler = () => fetchTariffs();
    window.addEventListener('environmentChanged', handler);
    return () => window.removeEventListener('environmentChanged', handler);
  }, [fetchTariffs]);

  // Edit needs the full record: the list serializer omits rates/items, which
  // the bridge's rate editor reads.
  const handleOpenDialog = useCallback(async (tariff = null) => {
    if (!tariff) {
      setSelectedTariff(null);
      setDialogMode('create');
      setDialogOpen(true);
      return;
    }
    setDialogMode('edit');
    setSelectedTariff(tariff);
    setDialogOpen(true);
    try {
      const full = await tariffsApi.getTariff(tariff.uuid);
      setSelectedTariff(full?.data || full || tariff);
    } catch { /* keep the list row */ }
  }, []);

  const handleCloseDialog = useCallback(() => {
    setDialogOpen(false);
    setSelectedTariff(null);
  }, []);

  // TariffBridge owns its own create/update call and hands back the saved
  // record, so this only has to close and refresh.
  const handleSaved = useCallback(async () => {
    showSuccess(dialogMode === 'edit' ? 'Tariff updated' : 'Tariff created');
    handleCloseDialog();
    await fetchTariffs();
  }, [dialogMode, showSuccess, handleCloseDialog, fetchTariffs]);

  const handleOpenDeleteDialog = useCallback((tariff) => {
    setTariffToDelete(tariff);
    setDeleteDialogOpen(true);
  }, []);

  const handleCloseDeleteDialog = useCallback(() => {
    setDeleteDialogOpen(false);
    setTariffToDelete(null);
  }, []);

  const handleDeleteTariff = useCallback(async () => {
    if (!tariffToDelete) return;
    try {
      setLoading(true);
      await tariffsApi.deleteTariff(tariffToDelete.uuid);
      showSuccess('Tariff deleted');
      handleCloseDeleteDialog();
      await fetchTariffs();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to delete tariff');
    } finally {
      setLoading(false);
    }
  }, [tariffToDelete, showSuccess, showError, fetchTariffs, handleCloseDeleteDialog]);

  const handleDuplicateTariff = useCallback(async (tariff) => {
    try {
      setLoading(true);
      await tariffsApi.duplicateTariff(tariff.uuid);
      showSuccess(`Duplicated "${tariff.name}"`);
      await fetchTariffs();
    } catch (error) {
      showError(error?.response?.data?.message || 'Failed to duplicate tariff');
    } finally {
      setLoading(false);
    }
  }, [showSuccess, showError, fetchTariffs]);

  const handlePageChange = useCallback((_, newPage) => setPage(newPage), []);
  const handleRowsPerPageChange = useCallback((e) => {
    setRowsPerPage(parseInt(e.target.value, 10));
    setPage(0);
  }, []);

  const handleSortChange = useCallback((field) => {
    const isAsc = sortBy === field && sortOrder === 'asc';
    setSortOrder(isAsc ? 'desc' : 'asc');
    setSortBy(field);
    setPage(0);
  }, [sortBy, sortOrder]);

  const handleFiltersChange = useCallback((newFilters) => {
    setFilters(newFilters);
    setPage(0);
  }, []);

  return {
    tariffs, loading, selectedTariff, dialogMode, schemes,
    dialogOpen, deleteDialogOpen, tariffToDelete,
    page, rowsPerPage, totalCount, sortBy, sortOrder, filters,
    handleOpenDialog, handleCloseDialog, handleSaved,
    handleOpenDeleteDialog, handleCloseDeleteDialog, handleDeleteTariff,
    handleDuplicateTariff,
    handlePageChange, handleRowsPerPageChange, handleSortChange,
    handleFiltersChange, fetchTariffs,
  };
};

export default useTariffs;
