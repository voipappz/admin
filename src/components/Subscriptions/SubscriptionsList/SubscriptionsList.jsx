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
} from '@mui/icons-material';
import { useState } from 'react';

/**
 * SubscriptionsList Component
 * Displays a list of subscriptions in the sidebar with filters
 */
const SubscriptionsList = ({
  subscriptions,
  loading,
  error,
  selectedSubscriptionId,
  onSelect,
  onAdd,
  filters,
  onFiltersChange,
  plans,
  plansLoading
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
      status: '',
      plan_uuid: '',
      created_at: '',
      updated_at: '',
      ends_at: ''
    });
    setCreatedAtStart(null);
    setCreatedAtEnd(null);
    setUpdatedAtStart(null);
    setUpdatedAtEnd(null);
    setEndsAtStart(null);
    setEndsAtEnd(null);
  };

  // Local state for date pickers
  const [createdAtStart, setCreatedAtStart] = useState(null);
  const [createdAtEnd, setCreatedAtEnd] = useState(null);
  const [updatedAtStart, setUpdatedAtStart] = useState(null);
  const [updatedAtEnd, setUpdatedAtEnd] = useState(null);
  const [endsAtStart, setEndsAtStart] = useState(null);
  const [endsAtEnd, setEndsAtEnd] = useState(null);

  if (loading && subscriptions.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 1 }} variant="body2">
          Loading subscriptions...
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

  const getStatusColor = (status) => {
    const colorMap = {
      active: 'success',
      suspended: 'warning',
      cancelled: 'error',
      pending: 'info',
    };
    return colorMap[status] || 'default';
  };

  const hasActiveFilters = filters.search || filters.status || filters.plan_uuid ||
    filters.created_at || filters.updated_at || filters.ends_at;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--mui-palette-background-paper)' }}>
      {/* Add New Subscription Button */}
      <Box sx={{ p: 2, borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          fullWidth
          disabled={loading}
        >
          Add Subscription
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
              <TextField
                fullWidth
                size="small"
                label="Search"
                placeholder="Customer or plan..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth size="small" disabled={plansLoading}>
                <InputLabel>Plan</InputLabel>
                <Select
                  value={filters.plan_uuid || ''}
                  label="Plan"
                  onChange={(e) => handleFilterChange('plan_uuid', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  {plans.map((plan) => (
                    <MenuItem key={plan.uuid} value={plan.uuid}>
                      {plan.name}
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

              {/* Ends At Date Range */}
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Ends At
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <TextField
                  size="small"
                  type="date"
                  label="From"
                  value={endsAtStart || ''}
                  onChange={(e) => {
                    setEndsAtStart(e.target.value);
                    handleDateRangeChange('ends_at', e.target.value, endsAtEnd);
                  }}
                  InputLabelProps={{ shrink: true }}
                  sx={{ flex: 1 }}
                />
                <TextField
                  size="small"
                  type="date"
                  label="To"
                  value={endsAtEnd || ''}
                  onChange={(e) => {
                    setEndsAtEnd(e.target.value);
                    handleDateRangeChange('ends_at', endsAtStart, e.target.value);
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

      {/* Subscriptions Count */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'var(--mui-palette-surface-muted)', borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Typography variant="caption" color="text.secondary">
          {`Total: ${subscriptions.length}`}
        </Typography>
      </Box>

      {/* Subscriptions List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {subscriptions.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {hasActiveFilters ? 'No subscriptions found' : 'No subscriptions yet'}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {subscriptions.map((sub) => {
              const subId = sub.id || sub.uuid;
              const isSelected = selectedSubscriptionId === subId;

              return (
                <ListItem key={subId} disablePadding sx={{ borderBottom: '1px solid var(--mui-palette-divider)' }}>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelect(subId)}
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
                          {sub.customer_name || sub.customer_uuid}
                        </Typography>
                        <Chip
                          label={sub.status || 'active'}
                          size="small"
                          color={getStatusColor(sub.status || 'active')}
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
                        {sub.plan_name || sub.plan_uuid}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {`${sub.price} ${sub.currency}`}
                        </Typography>
                        <Chip
                          label={sub.auto_renew ? 'Auto' : 'Manual'}
                          size="small"
                          color={sub.auto_renew ? 'success' : 'default'}
                          sx={{ height: 18, fontSize: '0.65rem' }}
                        />
                      </Box>
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

export default SubscriptionsList;
