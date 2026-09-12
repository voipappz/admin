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
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Skeleton,
  TableSortLabel,
  Menu,
  Tooltip
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  AutoAwesome as WizardIcon,
  EventNote as EventsIcon
} from '@mui/icons-material';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useServices } from './Services';
import { usePermissions } from '../../hooks/usePermissions';
import { getEnabledChipProps } from '../../utils/chipStyles';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import ServiceDialog from './ServiceDialog';
import ServiceWizard from './ServiceWizard/ServiceWizard.jsx';
import ImportJSONDialog from '../common/ImportJSONDialog/ImportJSONDialog';
import CentralizedSearch from '../shared/CentralizedSearch/CentralizedSearch';
import useCentralizedSearch from '../../hooks/useCentralizedSearch';
import { stripedTableRowSx } from '../shared/tableTheme.jsx';
import useNavigateToLogs from '../../hooks/useNavigateToLogs';
import MetaTagChips from '../common/MetaTagChips/MetaTagChips';
import './Services.css';

/**
 * ServiceControlDialog Component
 * Dialog for controlling service operations
 */
const ServiceControlDialog = ({ open, onClose, onConfirm, service, loading }) => {
  const [action, setAction] = useState('start');

  const handleConfirm = () => {
    onConfirm(service?.id, action);
  };

  const getActionTitle = () => {
    switch (action) {
      case 'start': return 'Start Service';
      case 'stop': return 'Stop Service';
      case 'restart': return 'Restart Service';
      default: return 'Control Service';
    }
  };

  const getActionDescription = () => {
    switch (action) {
      case 'start': return 'This will start the service and begin monitoring.';
      case 'stop': return 'This will stop the service and end all related processes.';
      case 'restart': return 'This will restart the service, which may cause a brief interruption.';
      default: return '';
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>{getActionTitle()}</DialogTitle>
      <DialogContent>
        <Typography gutterBottom>
          Service: <strong>{service?.display_name}</strong>
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {getActionDescription()}
        </Typography>
        
        <FormControl fullWidth>
          <InputLabel>Action</InputLabel>
          <Select
            value={action}
            label="Action"
            onChange={(e) => setAction(e.target.value)}
          >
            <MenuItem value="start">Start</MenuItem>
            <MenuItem value="stop">Stop</MenuItem>
            <MenuItem value="restart">Restart</MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleConfirm}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
          color={action === 'stop' ? 'error' : 'primary'}
        >
          {action.charAt(0).toUpperCase() + action.slice(1)}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * DeleteConfirmDialog Component
 */
const DeleteConfirmDialog = ({ open, onClose, onConfirm, service, loading }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Service</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete service{' '}
          <strong>{service?.display_name}</strong>?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This action cannot be undone and will remove all service configuration.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={onConfirm}
          variant="contained"
          color="error"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

/**
 * Services Component
 * Main component for services management
 */
const Services = () => {
  const { can } = usePermissions();
  const canWrite = can('services', 'write');
  const { registerScreen, unregisterScreen } = useGlobalSearch();

  const [wizardOpen, setWizardOpen] = useState(false);

  const {
    services,
    serviceTypes,
    serviceTypeConfigs,
    createService,
    loading,
    selectedService,
    dialogOpen,
    deleteDialogOpen,
    importJsonDialogOpen,
    serviceToDelete,
    controlDialogOpen,
    serviceToControl,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortOrder,
    handleOpenEditDialog,
    setDialogOpen,
    handleSaveService,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteService,
    handleOpenControlDialog,
    handleCloseControlDialog,
    handleControlService,
    handleOpenImportJsonDialog,
    handleCloseImportJsonDialog,
    handleImportJson,
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,
    setSearchQuery,
    setTypeFilter,
    setStatusFilter,
    setMetaFilters,
    fetchServices
  } = useServices();

  const { environments } = useCustomerEnvironment();

  const handleCentralizedFiltersChange = useCallback((filters) => {
    if (filters.name !== undefined) setSearchQuery(filters.name || '');
    if (filters.type !== undefined) setTypeFilter(filters.type || '');
    if (filters.enabled !== undefined) setStatusFilter(filters.enabled || '');
    if (filters.search !== undefined) setSearchQuery(filters.search || '');
    if (filters.meta !== undefined) setMetaFilters(filters.meta || {});
  }, [setSearchQuery, setTypeFilter, setStatusFilter, setMetaFilters]);

  const handleCentralizedReset = useCallback(() => {
    setSearchQuery('');
    setTypeFilter('');
    setStatusFilter('');
    setMetaFilters({});
  }, [setSearchQuery, setTypeFilter, setStatusFilter, setMetaFilters]);

  const {
    dateRange,
    quickSearchText,
    currentSearchParams,
    handleFilterChange,
    handleQuickSearch,
    handleQuickSearchChange,
    handleClearAllFilters,
    handleDateRangeChange,
    handleRefresh,
  } = useCentralizedSearch({
    onFiltersChange: handleCentralizedFiltersChange,
    onResetFilters: handleCentralizedReset,
    onRefresh: fetchServices,
  });

  const [menuAnchor, setMenuAnchor] = useState(null);
  const [menuService, setMenuService] = useState(null);
  const goToLogs = useNavigateToLogs();

  // Register search segments with GlobalSearchContext
  const serviceSegments = useMemo(() => [
    { name: 'name', label: 'Name', type: 'string' },
    { name: 'type', label: 'Type', type: 'select', data: (serviceTypes || []).map(t => ({ uuid: t, name: t.replace('_', ' ').toUpperCase() })) },
    { name: 'enabled', label: 'Status', type: 'select', data: [{ uuid: 'true', name: 'Enabled' }, { uuid: 'false', name: 'Disabled' }] },
    { name: 'meta', label: 'Tag', type: 'tag', url: '/api/services?action=meta_keys' },
  ], [serviceTypes]);

  useEffect(() => {
    registerScreen('services', serviceSegments, {
      onSearch: (params) => {
        Object.entries(params).forEach(([key, value]) => {
          if (key === 'search[text]') {
            setSearchQuery(value);
          } else {
            const match = key.match(/search\[(\w+)\]/);
            if (match) {
              if (match[1] === 'name') setSearchQuery(value);
              else if (match[1] === 'type') setTypeFilter(value);
              else if (match[1] === 'enabled') setStatusFilter(value);
            }
          }
        });
      },
      onClear: () => {
        setSearchQuery('');
        setTypeFilter('');
        setStatusFilter('');
      },
    });
    return () => unregisterScreen();
  }, [serviceSegments, registerScreen, unregisterScreen, setSearchQuery, setTypeFilter, setStatusFilter]);

  // Listen for environment change events to refresh data
  useEffect(() => {
    const handleEnvironmentChange = () => {
      console.log('🔄 Environment changed, refreshing Services data...');
      fetchServices();
    };

    window.addEventListener('environmentChanged', handleEnvironmentChange);

    return () => {
      window.removeEventListener('environmentChanged', handleEnvironmentChange);
    };
  }, [fetchServices]);

  const handleMenuOpen = (event, service) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setMenuService(service);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setMenuService(null);
  };

  return (
    <Box
      className="services-container"
      sx={{
        px: { xs: 0.5, sm: 1.5 },
        py: { xs: 0.5, sm: 1 },
        height: '100%',
        display: 'flex',
        overflow: 'hidden',
      }}
    >
      {/* Main Content Area - Full width, no sidebar */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>

        {/* Header: Title + Search + Add Service + Service Wizard on one line */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <CentralizedSearch
              segments={serviceSegments}
              currentSearchParams={currentSearchParams}
              onFilterChange={handleFilterChange}
              onQuickSearch={handleQuickSearch}
              onClearAllFilters={handleClearAllFilters}
              dateRange={dateRange}
              onDateRangeChange={handleDateRangeChange}
              onRefresh={handleRefresh}
              quickSearchText={quickSearchText}
              onQuickSearchChange={handleQuickSearchChange}
              placeholder="Search by name, or use field:value (e.g. enabled:true)"
            />
          </Box>
          {canWrite && (
            <Tooltip title="Create a service step by step">
              <Button
                variant="contained"
                color="primary"
                aria-label="Add Service"
                startIcon={<WizardIcon />}
                onClick={() => setWizardOpen(true)}
                disabled={loading}
                size="small"
                sx={{ whiteSpace: 'nowrap' }}
              >
                New Service
              </Button>
            </Tooltip>
          )}
          {canWrite && (
            <Tooltip title="Import services from JSON">
              <Button
                variant="outlined"
                color="secondary"
                onClick={handleOpenImportJsonDialog}
                disabled={loading}
                size="small"
                sx={{ whiteSpace: 'nowrap' }}
              >
                Import
              </Button>
            </Tooltip>
          )}
        </Box>

        {/* Services Table */}
        <Paper
          elevation={1}
          sx={{
            flex: 1,
            overflow: 'hidden',
            borderRadius: 2,
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          <Box sx={{ flexGrow: 1, overflow: 'auto' }}>

            <TableContainer>
              <Table stickyHeader>
                <TableHead>
                  <TableRow>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'name'}
                        direction={sortBy === 'name' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('name')}
                      >
                        Name
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>
                      <TableSortLabel
                        active={sortBy === 'type'}
                        direction={sortBy === 'type' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('type')}
                      >
                        Type
                      </TableSortLabel>
                    </TableCell>
                    <TableCell align="center">
                      <TableSortLabel
                        active={sortBy === 'enabled'}
                        direction={sortBy === 'enabled' ? sortOrder : 'asc'}
                        onClick={() => handleSortChange('enabled')}
                      >
                        Status
                      </TableSortLabel>
                    </TableCell>
                    <TableCell>Notes</TableCell>
                    <TableCell>Tags</TableCell>
                    <TableCell align="center">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                {loading && (!services || services.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Loading services...
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (!services || services.length === 0) ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No services found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  services.map((service) => {
                    const serviceId = service.id || service.uuid;

                    return (
                    <TableRow
                      key={serviceId}
                      hover
                      sx={stripedTableRowSx}
                    >
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <SettingsIcon fontSize="small" color="primary" />
                          <Box>
                            <Typography variant="body2" fontWeight={600}>
                              {service.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              ID: {service.uuid}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={service.type}
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip {...getEnabledChipProps(service.enabled)} />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" title={service.notes}>
                          {service.notes ? (
                            service.notes.length > 30 
                              ? `${service.notes.substring(0, 30)}...`
                              : service.notes
                          ) : '-'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <MetaTagChips meta={service.meta} />
                      </TableCell>
                      <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                          <Tooltip title="View Logs">
                            <IconButton
                              size="small"
                              onClick={() => goToLogs('service', service.uuid)}
                            >
                              <EventsIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                          <IconButton
                            size="small"
                            onClick={(e) => handleMenuOpen(e, service)}
                          >
                            <MoreVertIcon />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>
          </Box>

          {/* Pagination */}
          <TablePagination
            component="div"
            count={totalCount}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={handleRowsPerPageChange}
            rowsPerPageOptions={[10, 25, 50, 100]}
            sx={{ borderTop: '1px solid #e0e0e0' }}
          />
        </Paper>
      </Box>

      {/* Service Menu */}
      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{ elevation: 3 }}
      >
        <MenuItem
          onClick={() => {
            handleOpenControlDialog(menuService);
            handleMenuClose();
          }}
        >
          <SettingsIcon fontSize="small" sx={{ mr: 1 }} />
          Control
        </MenuItem>
        <MenuItem
          onClick={() => {
            goToLogs('service', menuService?.uuid);
            handleMenuClose();
          }}
        >
          <EventsIcon fontSize="small" sx={{ mr: 1 }} />
          View Logs
        </MenuItem>
        {canWrite && (
          <MenuItem
            onClick={() => {
              handleOpenEditDialog(menuService);
              handleMenuClose();
            }}
          >
            <EditIcon fontSize="small" sx={{ mr: 1 }} />
            Edit
          </MenuItem>
        )}
        {canWrite && (
          <MenuItem
            onClick={() => {
              handleOpenDeleteDialog(menuService);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <DeleteIcon fontSize="small" sx={{ mr: 1 }} />
            Delete
          </MenuItem>
        )}
      </Menu>

      {/* Step-by-step create wizard (default create flow) */}
      <ServiceWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSave={async (data) => { await createService(data); setWizardOpen(false); }}
        loading={loading}
        hookServiceTypes={serviceTypes}
        serviceTypeConfigs={serviceTypeConfigs}
        canWrite={canWrite}
      />

      {/* Edit Dialog (quick edit for existing services) */}
      <ServiceDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onSave={handleSaveService}
        service={selectedService}
        loading={loading}
        hookServiceTypes={serviceTypes}
        canWrite={canWrite}
      />

      {/* Control Dialog */}
      <ServiceControlDialog
        open={controlDialogOpen}
        onClose={handleCloseControlDialog}
        onConfirm={handleControlService}
        service={serviceToControl}
        loading={loading}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleDeleteService}
        service={serviceToDelete}
        loading={loading}
      />

      {/* Import JSON Dialog */}
      <ImportJSONDialog
        open={importJsonDialogOpen}
        onClose={handleCloseImportJsonDialog}
        onImport={handleImportJson}
        title="Create Service from Template"
        environments={environments || []}
        onSuccess={() => fetchServices()}
      />
    </Box>
  );
};

export default Services;