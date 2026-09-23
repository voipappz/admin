import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  Tooltip,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  Skeleton,
  TableSortLabel,
  ToggleButtonGroup,
  ToggleButton,
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Add as AddIcon,
  Upload as UploadIcon,
  Queue as QueueIcon,
  TableChart as TableIcon,
  AccountTree as FlowIcon,
  EventNote as EventsIcon,
} from '@mui/icons-material';
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react';
import { useSearchParams, useNavigate } from 'react-router';
import { ConfirmDialog } from '../ui';
import { useQueues } from './Queues';
import { queuesApi } from '../../services/api/queuesApi';
import { didsApi } from '../../services/api/routesApi';
import { useNotification } from '../../context/NotificationContext';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import { usePermissions } from '../../hooks/usePermissions';
import { QueueBridge } from '../Bridges/QueueBridge/QueueBridge';
import ImportCSVDialog from '../common/ImportCSVDialog/ImportCSVDialog';
import CentralizedSearch from '../shared/CentralizedSearch/CentralizedSearch.jsx';
import { orEmpty, stripedTableRowSx } from '../shared/tableTheme.jsx';
import useCentralizedSearch from '../../hooks/useCentralizedSearch';
import EventsCountBadge from '../common/EventsCountBadge/EventsCountBadge.jsx';
import { formatDate } from '../../utils/dateUtils';
import { getEnabledChipProps } from '../../utils/chipStyles';
import PhoneIcon from '@mui/icons-material/Phone';
import CloseIcon from '@mui/icons-material/Close';
import Alert from '@mui/material/Alert';

const QueuesTopology = lazy(() => import('./QueuesTopology'));

/**
 * Queues Component
 * Main screen for queue management with table, create/edit via QueueBridge dialog
 */
const Queues = () => {
  const { can } = usePermissions();
  const canWrite = can('queues', 'write');
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'flow'
  const navigate = useNavigate();

  // DID-aware panel mode
  const [searchParams] = useSearchParams();
  const didParam = searchParams.get('did');
  const [currentDID, setCurrentDID] = useState(null);
  const [currentQueue, setCurrentQueue] = useState(null);
  const [didLoading, setDidLoading] = useState(false);

  const { showSuccess, showError } = useNotification();
  const { registerScreen, unregisterScreen } = useGlobalSearch();

  const {
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
    environments,
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
  } = useQueues();

  // CentralizedSearch - remap 'name' segment key to 'search'
  const handleCentralizedFiltersChange = useCallback((parsedFilters) => {
    const remapped = { ...parsedFilters };
    if ('name' in remapped) {
      remapped.search = remapped.name;
      delete remapped.name;
    }
    handleFiltersChange(remapped);
  }, [handleFiltersChange]);

  const centralizedSearch = useCentralizedSearch({
    onFiltersChange: handleCentralizedFiltersChange,
    onResetFilters: handleResetFilters,
    onRefresh: fetchQueues,
  });

  // Search segments
  const queueSegments = useMemo(() => [
    { name: 'name', label: 'Name', type: 'string' },
    { name: 'enabled', label: 'Status', type: 'select', data: [{ uuid: 'true', name: 'Enabled' }, { uuid: 'false', name: 'Disabled' }] },
    { name: 'environment_uuid', label: 'Application', type: 'select', data: environments },
  ], [environments]);

  useEffect(() => {
    registerScreen('queues', queueSegments, {
      onSearch: (params) => {
        const newFilters = {};
        Object.entries(params).forEach(([key, value]) => {
          if (key === 'search[text]') {
            newFilters.search = value;
          } else {
            const match = key.match(/search\[(\w+)\]/);
            if (match) newFilters[match[1]] = value;
          }
        });
        handleFiltersChange(newFilters);
      },
      onClear: () => {
        handleFiltersChange({ search: '', enabled: '', environment_uuid: '', strategy: '' });
      },
    });
    return () => unregisterScreen();
  }, [queueSegments, registerScreen, unregisterScreen, handleFiltersChange]);

  // Listen for environment changes
  useEffect(() => {
    const handleEnvironmentChange = () => fetchQueues();
    window.addEventListener('environmentChanged', handleEnvironmentChange);
    return () => window.removeEventListener('environmentChanged', handleEnvironmentChange);
  }, [fetchQueues]);

  // DID-aware mode: fetch DID and its linked queue when ?did= param is present
  useEffect(() => {
    if (!didParam) {
      setCurrentDID(null);
      setCurrentQueue(null);
      return;
    }
    const loadDIDAndQueue = async () => {
      setDidLoading(true);
      try {
        const did = await didsApi.getDID(didParam);
        setCurrentDID(did);
        if (did.bridge_uuid && (did.bridge_type === 'queue' || did.bridge_type === 'que')) {
          try {
            const queue = await queuesApi.getQueue(did.bridge_uuid);
            setCurrentQueue(queue);
          } catch {
            setCurrentQueue(null);
          }
        } else {
          setCurrentQueue(null);
        }
      } catch (err) {
        console.error('Failed to load Route:', err);
        setCurrentDID(null);
        setCurrentQueue(null);
      } finally {
        setDidLoading(false);
      }
    };
    loadDIDAndQueue();
  }, [didParam]);

  const handleClearDID = useCallback(() => {
    navigate('/queues');
  }, [navigate]);

  // Import handlers
  const handleImportCSV = useCallback(async (file, environmentUuid) => {
    const result = await queuesApi.importCSV?.(file, environmentUuid);
    return result;
  }, []);

  const handleImportSuccess = useCallback(() => {
    showSuccess('Queues imported successfully');
    fetchQueues();
  }, [showSuccess, fetchQueues]);

  // Format strategy name for display
  const formatStrategy = (strategy) => {
    if (!strategy) return '-';
    const name = typeof strategy === 'string' ? strategy : strategy.name || strategy;
    return String(name).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  };

  // Count tiers
  const getTierCount = (queue) => {
    const tiers = queue.tiers;
    if (Array.isArray(tiers)) return tiers.length;
    return '-';
  };

  // DID-aware panel mode
  if (didParam) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          p: { xs: 1, sm: 2, md: 3 },
          gap: 2,
          height: '100%',
          width: '100%'
        }}
      >
        {/* Page Header — keeps "Queues" as primary, DID as secondary context */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mx: 2, mt: 2 }}>
          <Typography variant="h6" fontWeight={600} sx={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-family-heading)' }}>
            Queues
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1, minWidth: 0 }}>
            <PhoneIcon sx={{ fontSize: 18, color: 'var(--accent-primary)' }} />
            {didLoading ? (
              <Typography variant="body2" color="text.secondary">Loading Route...</Typography>
            ) : currentDID ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                <Chip label={currentDID.number} size="small" color="primary" variant="outlined" sx={{ fontWeight: 600 }} />
                {currentDID.name && (
                  <Typography variant="body2" color="text.secondary" noWrap>{currentDID.name}</Typography>
                )}
              </Box>
            ) : (
              <Typography variant="body2" color="error">Route not found</Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            size="small"
            startIcon={<CloseIcon />}
            onClick={handleClearDID}
            sx={{ textTransform: 'none', flexShrink: 0 }}
          >
            All Queues
          </Button>
        </Box>

        {/* Queue Panel */}
        <Box sx={{ flexGrow: 1, overflow: 'auto', mx: 2 }}>
          {didLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress />
            </Box>
          ) : !currentDID ? (
            <Box sx={{ mt: 2 }}>
              <Alert severity="error" sx={{ mb: 2 }}>
                DID not found. It may have been deleted or you may not have access.
              </Alert>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button variant="outlined" size="small" onClick={handleClearDID} sx={{ textTransform: 'none' }}>
                  View All Queues
                </Button>
                <Button variant="outlined" size="small" onClick={() => navigate('/routes/list')} sx={{ textTransform: 'none' }}>
                  Go to DIDs
                </Button>
              </Box>
            </Box>
          ) : !canWrite ? (
            <Alert severity="info" sx={{ mb: 2 }}>
              You don&apos;t have permission to modify queues.
            </Alert>
          ) : currentQueue ? (
            <QueueBridge
              open={true}
              onClose={handleClearDID}
              onSave={async (data) => {
                await queuesApi.updateQueue(currentQueue.uuid, data);
                showSuccess('Queue updated');
                // Reload queue data
                const updated = await queuesApi.getQueue(currentQueue.uuid);
                setCurrentQueue(updated);
              }}
              queue={currentQueue}
              mode="edit"
              hideEnvironment={false}
              containerMode="panel"
            />
          ) : (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }}>
                This DID does not have a queue assigned. Create one below.
              </Alert>
              <QueueBridge
                open={true}
                onClose={handleClearDID}
                onSave={async (data) => {
                  const created = await queuesApi.createQueue(data);
                  showSuccess('Queue created');
                  // Link queue to DID
                  if (created?.uuid && currentDID) {
                    try {
                      await didsApi.updateDID(currentDID.uuid, {
                        bridge_type: 'que',
                        bridge_uuid: created.uuid,
                      });
                    } catch (err) {
                      console.error('Failed to link queue to Route:', err);
                      showError('Queue created but failed to link to Route. Link it manually in Route settings.');
                    }
                  }
                  setCurrentQueue(created);
                }}
                mode="create"
                environmentUuid={currentDID.environment_uuid}
                hideEnvironment={true}
                containerMode="panel"
              />
            </Box>
          )}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 0.5, sm: 1.5 },
        py: { xs: 0.5, sm: 1 },
        height: '100%',
        width: '100%'
      }}
    >
      {/* Header: Title + View Toggle + Search + Add Button */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        <Typography variant="h6" fontWeight={600} sx={{ whiteSpace: 'nowrap', fontFamily: 'var(--font-family-heading)' }}>
          Queues
        </Typography>
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, v) => v && setViewMode(v)}
          size="small"
          sx={{ '& .MuiToggleButton-root': { px: 1, py: 0.25 } }}
        >
          <ToggleButton value="table"><Tooltip title="Table"><TableIcon fontSize="small" /></Tooltip></ToggleButton>
          <ToggleButton value="flow"><Tooltip title="Flow"><FlowIcon fontSize="small" /></Tooltip></ToggleButton>
        </ToggleButtonGroup>
        {viewMode === 'table' && <Box sx={{ flex: 1, minWidth: 0 }}>
          <CentralizedSearch
            segments={queueSegments}
            currentSearchParams={centralizedSearch.currentSearchParams}
            onFilterChange={centralizedSearch.handleFilterChange}
            onQuickSearch={centralizedSearch.handleQuickSearch}
            onClearAllFilters={centralizedSearch.handleClearAllFilters}
            dateRange={centralizedSearch.dateRange}
            onDateRangeChange={centralizedSearch.handleDateRangeChange}
            onRefresh={centralizedSearch.handleRefresh}
            quickSearchText={centralizedSearch.quickSearchText}
            onQuickSearchChange={centralizedSearch.handleQuickSearchChange}
            placeholder="Search by name, or use field:value (e.g. enabled:true)"
          />
        </Box>}
        {viewMode === 'table' && canWrite && (
          <Tooltip title="Import CSV">
            <IconButton size="small" onClick={() => setImportDialogOpen(true)} disabled={loading}>
              <UploadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {viewMode === 'table' && canWrite && (
          <Tooltip title="Add Queue">
            <IconButton size="small" color="primary" onClick={() => handleOpenDialog()} disabled={loading}>
              <AddIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      {/* Flow View */}
      {viewMode === 'flow' && (
        <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <Suspense fallback={<Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>}>
            <QueuesTopology canWrite={canWrite} />
          </Suspense>
        </Box>
      )}

      {/* Queue report charts — fixed Events-style strip with report swap */}

      {/* Table (only in table mode) */}
      {viewMode === 'table' && <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
        <Paper
          elevation={3}
          sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}
        >
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'created_at'}
                        direction={sortBy === 'created_at' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('created_at')}
                      >
                        Created
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={sortBy === 'enabled'}
                        direction={sortBy === 'enabled' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('enabled')}
                      >
                        Enabled
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'name'}
                        direction={sortBy === 'name' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('name')}
                      >
                        Name
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Strategy</TableCell>
                    <TableCell align="center">Agents</TableCell>
                    <TableCell>Max Wait</TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'environment_name'}
                        direction={sortBy === 'environment_name' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('environment_name')}
                      >
                        Application
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && queues.length === 0 ? (
                    Array.from({ length: 8 }).map((_, i) => (
                    <TableRow key={i}>
                      {Array.from({ length: 8 }).map((__, j) => (
                        <TableCell key={j}><Skeleton height={20} /></TableCell>
                      ))}
                    </TableRow>
                  ))
                  ) : queues.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                        <Typography variant="body2" color="text.secondary">
                          No queues found
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    queues.map((queue) => (
                      <TableRow key={queue.uuid} hover sx={stripedTableRowSx}>
                        <TableCell>
                          <Typography variant="body2">{formatDate(queue.created_at)}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip {...getEnabledChipProps(queue.enabled)} />
                        </TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <QueueIcon fontSize="small" color="action" />
                            <Typography variant="body2" fontWeight={600}>{queue.name}</Typography>
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">{formatStrategy(queue.strategy)}</Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            label={getTierCount(queue)}
                            size="small"
                            variant="outlined"
                            color={getTierCount(queue) > 0 ? 'primary' : 'default'}
                          />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {queue.max_wait_time ? `${queue.max_wait_time}s` : '-'}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {orEmpty(queue.environment?.name)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                            {canWrite && (
                              <Tooltip title="Edit queue">
                                <IconButton size="small" onClick={() => handleOpenDialog(queue)} disabled={loading}>
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canWrite && (
                              <Tooltip title="Delete queue">
                                <IconButton size="small" color="error" onClick={() => handleOpenDeleteDialog(queue)} disabled={loading}>
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={totalCount}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              rowsPerPageOptions={[10, 25, 50, 100]}
              sx={{ borderTop: '1px solid var(--mui-palette-divider)' }}
            />
          </Box>
        </Paper>
      </Box>}

      {/* Create/Edit Dialog — reuses the existing QueueBridge component */}
      <QueueBridge
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveQueue}
        queue={selectedQueue}
        mode={selectedQueue ? 'edit' : 'create'}
        hideEnvironment={false}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleDeleteQueue}
        loading={loading}
        title="Delete Queue"
        message={<Typography>Are you sure you want to delete queue <strong>{(queueToDelete)?.name}</strong>?</Typography>}
        description="This will remove the queue and all its tier assignments from the switch."
      />

      {/* Import CSV Dialog */}
      <ImportCSVDialog
        open={importDialogOpen}
        onClose={() => setImportDialogOpen(false)}
        onImport={handleImportCSV}
        title="Import Queues from CSV"
        entityName="Queues"
        environments={environments}
        requireEnvironment={true}
        onSuccess={handleImportSuccess}
        formatHint="Name,Strategy,MaxWaitTime"
        showTemplateOption={true}
        templateHeaders={['Name', 'Strategy', 'MaxWaitTime']}
        templateData={[
          { Name: 'Sales Queue', Strategy: 'round_robin', MaxWaitTime: '300' },
          { Name: 'Support Queue', Strategy: 'ring_all', MaxWaitTime: '600' }
        ]}
      />
    </Box>
  );
};

export default Queues;
