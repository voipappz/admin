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
  TableSortLabel
} from '@mui/material';
import {
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Add as AddIcon,
  EventNote as EventsIcon,
  Visibility as ViewIcon,
} from '@mui/icons-material';
import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAccounts } from './useAccounts';
import { usePermissions } from '../../hooks/usePermissions';
import { useGlobalSearch } from '../../context/GlobalSearchContext';
import AccountDialog from './AccountDialog/AccountDialog';
import useNavigateToLogs from '../../hooks/useNavigateToLogs';
import { formatDate } from '../../utils/dateUtils';
import { getEnabledChipProps } from '../../utils/chipStyles';
import CentralizedSearch from '../shared/CentralizedSearch/CentralizedSearch.jsx';
import useCentralizedSearch from '../../hooks/useCentralizedSearch';
import { orEmpty, stripedTableRowSx } from '../shared/tableTheme.jsx';
import MetaTagChips from '../common/MetaTagChips/MetaTagChips';
import HelpButton from '../common/HelpButton';
import { GUIDE_URLS } from '../../utils/guides';
import CopyableEmail from '../common/CopyableEmail/CopyableEmail.jsx';

/**
 * DeleteConfirmDialog Component
 * Confirmation dialog for deleting accounts
 */
const DeleteConfirmDialog = ({ open, onClose, onConfirm, account, loading }) => {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Delete Account</DialogTitle>
      <DialogContent>
        <Typography>
          Are you sure you want to delete account{' '}
          <strong>{account?.name}</strong>?
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          This action cannot be undone and will remove all account data.
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          data-testid="confirm-delete-button"
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
 * Accounts Component
 * Main component for accounts management with sidebar list and wide table
 */
const Accounts = () => {
  const { can } = usePermissions();
  const canWrite = can('accounts', 'write');
  const { registerScreen, unregisterScreen } = useGlobalSearch();

  const {
    accounts,
    loading,
    dialogLoading,
    selectedAccount,
    dialogOpen,
    deleteDialogOpen,
    accountToDelete,
    page,
    rowsPerPage,
    totalCount,
    sortBy,
    sortOrder,
    environments,
    acls,
    referenceDataLoading,
    handleOpenDialog,
    handleCloseDialog,
    handleSaveAccount,
    handleOpenDeleteDialog,
    handleCloseDeleteDialog,
    handleDeleteAccount,
    handlePageChange,
    handleRowsPerPageChange,
    handleSortChange,
    handleFiltersChange,
    handleResetFilters,
    handleResetPassword,
    fetchAccounts
  } = useAccounts();

  const goToLogs = useNavigateToLogs();
  const [selectedAccountId, setSelectedAccountId] = useState(null);

  // Register search segments with GlobalSearchContext
  const accountSegments = useMemo(() => [
    { name: 'name', label: 'Name', type: 'string' },
    { name: 'email', label: 'Email', type: 'string' },
    { name: 'enabled', label: 'Status', type: 'select', data: [{ uuid: 'true', name: 'Active' }, { uuid: 'false', name: 'Inactive' }] },
    { name: 'acl_uuid', label: 'ACL', type: 'select', data: acls },
    { name: 'meta', label: 'Tag', type: 'tag', url: '/api/accounts?action=meta_keys' },
  ], [acls]);

  // Bridge CentralizedSearch filter events to the hook's filter state
  const handleCentralizedFiltersChange = useCallback((filters) => {
    const mapped = {};
    if (filters.name !== undefined) mapped.search = filters.name;
    if (filters.search !== undefined) mapped.search = filters.search;
    if (filters.email !== undefined) mapped.email = filters.email;
    if (filters.enabled !== undefined) mapped.enabled = filters.enabled;
    if (filters.acl_uuid !== undefined) mapped.acl_uuid = filters.acl_uuid;
    if (Object.keys(mapped).length > 0) handleFiltersChange(mapped);
  }, [handleFiltersChange]);

  const handleCentralizedReset = useCallback(() => {
    handleResetFilters();
  }, [handleResetFilters]);

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
    onRefresh: fetchAccounts,
  });

  useEffect(() => {
    registerScreen('accounts', accountSegments, {
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
        handleFiltersChange({ search: '', email: '', enabled: '', acl_uuid: '' });
      },
    });
    return () => unregisterScreen();
  }, [accountSegments, registerScreen, unregisterScreen, handleFiltersChange]);

  // Listen for environment change events to refresh data
  useEffect(() => {
    const handleEnvironmentChange = () => {
      console.log('🔄 Environment changed, refreshing Accounts data...');
      fetchAccounts();
    };

    window.addEventListener('environmentChanged', handleEnvironmentChange);

    return () => {
      window.removeEventListener('environmentChanged', handleEnvironmentChange);
    };
  }, [fetchAccounts]);

  const handleSelectAccount = (accountId) => {
    setSelectedAccountId(accountId);
  };

  return (
    <Box
      className="accounts-container"
      sx={{
        display: 'flex',
        flexDirection: 'column',
        px: { xs: 0.5, sm: 1.5 },
        py: { xs: 0.5, sm: 1 },
        height: '100%',
        width: '100%'
      }}
    >
      {/* Accounts Table Area - Full width, no sidebar */}
      <Box sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
        {/* Accounts Table */}
        <Paper
          className="accounts-content"
          elevation={3}
          sx={{
            flexGrow: 1,
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0
          }}
        >
          {/* Header */}
          <Box sx={{ borderBottom: '1px solid var(--mui-palette-divider)', display: 'flex', alignItems: 'center', gap: 2 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <CentralizedSearch
                segments={accountSegments}
                currentSearchParams={currentSearchParams}
                onFilterChange={handleFilterChange}
                onQuickSearch={handleQuickSearch}
                onClearAllFilters={handleClearAllFilters}
                dateRange={dateRange}
                onDateRangeChange={handleDateRangeChange}
                onRefresh={handleRefresh}
                quickSearchText={quickSearchText}
                onQuickSearchChange={handleQuickSearchChange}
                placeholder="Search by name, email, or use field:value (e.g. enabled:true)"
              />
            </Box>
            {canWrite && (
              <Tooltip title="Add Account">
                <IconButton
                  size="small"
                  color="primary"
                  onClick={() => handleOpenDialog()}
                  disabled={loading}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Box>
          {/* Accounts Table */}
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
                      Created At
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'updated_at'}
                      direction={sortBy === 'updated_at' ? sortOrder : 'asc'}
                      onClick={() => handleSortChange('updated_at')}
                    >
                      Updated At
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
                  <TableCell>
                    <TableSortLabel
                      active={sortBy === 'email'}
                      direction={sortBy === 'email' ? sortOrder : 'asc'}
                      onClick={() => handleSortChange('email')}
                    >
                      Email
                    </TableSortLabel>
                  </TableCell>
                  <TableCell>ACL</TableCell>
                  <TableCell>Tags</TableCell>
                  <TableCell align="center">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {loading && accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <CircularProgress />
                    </TableCell>
                  </TableRow>
                ) : accounts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      <Typography variant="body2" color="text.secondary">
                        No accounts found
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  accounts.map((account) => {
                    const accountId = account.id || account.uuid;
                    const isSelected = selectedAccountId === accountId;

                    return (
                      <TableRow
                        key={accountId}
                        hover
                        selected={isSelected}
                        sx={{
                          ...stripedTableRowSx,
                          cursor: 'pointer',
                          '&.Mui-selected': {
                            bgcolor: '#e3f2fd !important'
                          }
                        }}
                        onClick={() => handleSelectAccount(accountId)}
                      >
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(account.created_at)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {formatDate(account.updated_at)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip {...getEnabledChipProps(account.enabled)} />
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2" fontWeight={600}>
                            {orEmpty(account.name)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            <CopyableEmail email={account.email} fallback={orEmpty(account.email)} />
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Typography variant="body2">
                            {orEmpty(account.acl?.name)}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <MetaTagChips meta={account.meta} />
                        </TableCell>
                        <TableCell align="center" onClick={(e) => e.stopPropagation()}>
                          <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5 }}>
                            {canWrite && (
                              <Tooltip title="Edit account">
                                <IconButton
                                  data-testid="edit-account-button"
                                  size="small"
                                  onClick={() => handleOpenDialog(account)}
                                  disabled={loading}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {canWrite && (
                              <Tooltip title="Delete account">
                                <IconButton
                                  data-testid="delete-account-button"
                                  size="small"
                                  onClick={() => handleOpenDeleteDialog(account)}
                                  disabled={loading}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            {!canWrite && (
                              <Tooltip title="View details">
                                <IconButton
                                  size="small"
                                  onClick={() => handleOpenDialog(account)}
                                  disabled={loading}
                                >
                                  <ViewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <Tooltip title="View Logs">
                              <IconButton
                                size="small"
                                onClick={() => goToLogs('account', account.uuid)}
                                disabled={loading}
                              >
                                <EventsIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </TableContainer>

            {/* Pagination */}
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

      </Box>

      {/* Create/Edit Dialog */}
      <AccountDialog
        open={dialogOpen}
        onClose={handleCloseDialog}
        onSave={handleSaveAccount}
        onResetPassword={handleResetPassword}
        account={selectedAccount}
        loading={dialogLoading || referenceDataLoading}
        environments={environments}
        environmentsLoading={referenceDataLoading}
        acls={acls}
        aclsLoading={referenceDataLoading}
        canWrite={canWrite}
      />

      {/* Delete Confirmation Dialog */}
      <DeleteConfirmDialog
        open={deleteDialogOpen}
        onClose={handleCloseDeleteDialog}
        onConfirm={handleDeleteAccount}
        account={accountToDelete}
        loading={dialogLoading}
      />
    </Box>
  );
};

export default Accounts;
