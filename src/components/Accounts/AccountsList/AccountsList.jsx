import {
  List,
  ListItem,
  ListItemButton,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Chip,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Person as PersonIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { formatDate } from '../../../utils/dateUtils';

/**
 * AccountsList Component
 * Displays a list of accounts in the sidebar with filters
 * Filters use search[field] format matching legacy AngularJS pattern
 */
const AccountsList = ({
  accounts,
  loading,
  error,
  selectedAccountId,
  onSelect,
  onAdd,
  filters,
  onFiltersChange,
  acls = [],
}) => {
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  const handleFilterChange = (field, value) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  // Convert date range to API format: "start_timestamp-end_timestamp"
  const handleDateRangeChange = (field, startDate, endDate) => {
    if (!startDate && !endDate) {
      onFiltersChange({ ...filters, [field]: '' });
      return;
    }
    const start = startDate ? Math.floor(new Date(startDate).getTime() / 1000) : '';
    const end = endDate ? Math.floor(new Date(endDate).setHours(23, 59, 59, 999) / 1000) : '';
    const range = start && end ? `${start}-${end}` : '';
    onFiltersChange({ ...filters, [field]: range });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      email: '',
      enabled: '',
      acl_uuid: '',
      created_at: '',
      updated_at: ''
    });
    // Reset local date states
    setCreatedAtStart(null);
    setCreatedAtEnd(null);
    setUpdatedAtStart(null);
    setUpdatedAtEnd(null);
  };

  // Local state for date pickers
  const [createdAtStart, setCreatedAtStart] = useState(null);
  const [createdAtEnd, setCreatedAtEnd] = useState(null);
  const [updatedAtStart, setUpdatedAtStart] = useState(null);
  const [updatedAtEnd, setUpdatedAtEnd] = useState(null);

  if (loading && accounts.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 1 }} variant="body2">
          Loading accounts...
        </Typography>
      </Box>
    );
  }

  if (error) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  const hasActiveFilters = filters.search || filters.email || filters.enabled ||
    filters.acl_uuid || filters.created_at || filters.updated_at;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--mui-palette-background-paper)' }}>
      {/* Add New Account Button */}
      <Box sx={{ p: 2, borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          fullWidth
          disabled={loading}
        >
          Add Account
        </Button>
      </Box>

      {/* Filters Section */}
      <Box sx={{ borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Accordion
          expanded={filtersExpanded}
          onChange={() => setFiltersExpanded(!filtersExpanded)}
          elevation={0}
          sx={{ '&:before': { display: 'none' }, m: 0 }}
        >
          <AccordionSummary
            expandIcon={<ExpandMoreIcon />}
            sx={{ minHeight: 48, '&.Mui-expanded': { minHeight: 48 }, px: 2 }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
              <FilterListIcon fontSize="small" />
              <Typography variant="body2" fontWeight={600}>
                Filters
              </Typography>
              {hasActiveFilters && (
                <Chip
                  label="Active"
                  size="small"
                  color="primary"
                  sx={{ height: 20, fontSize: '0.7rem' }}
                />
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2, pt: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Name search */}
              <TextField
                fullWidth
                size="small"
                label="Name"
                placeholder="Search by name..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />

              {/* Email search */}
              <TextField
                fullWidth
                size="small"
                label="Email"
                placeholder="Search by email..."
                value={filters.email || ''}
                onChange={(e) => handleFilterChange('email', e.target.value)}
              />

              {/* Enabled filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Enabled</InputLabel>
                <Select
                  value={filters.enabled || ''}
                  label="Enabled"
                  onChange={(e) => handleFilterChange('enabled', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Yes</MenuItem>
                  <MenuItem value="false">No</MenuItem>
                </Select>
              </FormControl>

              {/* ACL/Role filter */}
              <FormControl fullWidth size="small">
                <InputLabel>ACL/Role</InputLabel>
                <Select
                  value={filters.acl_uuid || ''}
                  label="ACL/Role"
                  onChange={(e) => handleFilterChange('acl_uuid', e.target.value)}
                >
                  <MenuItem value="">All Roles</MenuItem>
                  {acls.map((acl) => (
                    <MenuItem key={acl.uuid || acl.id} value={acl.uuid || acl.id}>
                      {acl.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Created At Date Range */}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Created At
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  value={createdAtStart || ''}
                  onChange={(e) => {
                    setCreatedAtStart(e.target.value);
                    handleDateRangeChange('created_at', e.target.value, createdAtEnd);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  value={createdAtEnd || ''}
                  onChange={(e) => {
                    setCreatedAtEnd(e.target.value);
                    handleDateRangeChange('created_at', createdAtStart, e.target.value);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
              </Box>

              {/* Updated At Date Range */}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Updated At
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  value={updatedAtStart || ''}
                  onChange={(e) => {
                    setUpdatedAtStart(e.target.value);
                    handleDateRangeChange('updated_at', e.target.value, updatedAtEnd);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  value={updatedAtEnd || ''}
                  onChange={(e) => {
                    setUpdatedAtEnd(e.target.value);
                    handleDateRangeChange('updated_at', updatedAtStart, e.target.value);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
              </Box>

              {hasActiveFilters && (
                <Button
                  variant="outlined"
                  size="small"
                  color="inherit"
                  startIcon={<ClearIcon />}
                  onClick={handleClearFilters}
                  fullWidth
                >
                  Clear Filters
                </Button>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      </Box>

      {/* Accounts Count */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'var(--mui-palette-surface-muted)', borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Typography variant="caption" color="text.secondary">
          {`Total: ${accounts.length}`}
        </Typography>
      </Box>

      {/* Accounts List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {accounts.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {hasActiveFilters ? 'No accounts found' : 'No accounts yet'}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {accounts.map((account) => {
              const accountId = account.id || account.uuid;
              const isSelected = selectedAccountId === accountId;

              return (
                <ListItem key={accountId} disablePadding sx={{ borderBottom: '1px solid var(--mui-palette-divider)' }}>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelect(accountId)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      transition: 'background-color 0.2s',
                      '&:hover': { bgcolor: 'var(--mui-palette-surface-muted)' },
                      '&.Mui-selected': {
                        bgcolor: '#e3f2fd !important',
                        borderLeft: '3px solid',
                        borderLeftColor: 'primary.main',
                      },
                    }}
                  >
                    <Box sx={{ width: '100%' }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <PersonIcon fontSize="small" color="action" />
                        <Typography
                          variant="body2"
                          fontWeight={600}
                          sx={{
                            flexGrow: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {String(account.name || account.email || 'Unnamed')}
                        </Typography>
                        <Chip
                          label={account.enabled ? 'Active' : 'Inactive'}
                          size="small"
                          color={account.enabled ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                        />
                      </Box>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: 'block',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          mb: 0.5,
                        }}
                      >
                        {account.email || 'No email'}
                      </Typography>
                      {account.customer?.name && (
                        <Typography
                          variant="caption"
                          color="primary"
                          sx={{
                            display: 'block',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            mb: 0.5,
                          }}
                        >
                          {account.customer.name}
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(account.created_at)}
                      </Typography>
                    </Box>
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default AccountsList;
