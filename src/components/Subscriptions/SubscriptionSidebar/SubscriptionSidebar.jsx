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
import { formatDate } from '../../../utils/dateUtils';
import './SubscriptionSidebar.css';

/**
 * SubscriptionSidebar Component
 * Displays a list of subscriptions in the sidebar with filters
 */
const SubscriptionSidebar = ({
  subscriptions,
  loading,
  error, // Assuming an error prop might be passed for general list errors
  selectedSubscriptionId,
  onSelect,
  onAdd,
  filters,
  onFiltersChange,
  plans,
  plansLoading,
  plansError,
}) => {
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  const handleFilterChange = (field, value) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      plan_uuid: '',
      status: '',
    });
  };

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

  if (error || plansError) {
    return (
      <Box sx={{ p: 2 }}>
        <Alert severity="error">{error || plansError}</Alert>
      </Box>
    );
  }

  const getStatusChipColor = (status) => {
    const colorMap = {
      active: 'success',
      suspended: 'warning',
      cancelled: 'error',
      pending: 'info'
    };
    return colorMap[status] || 'default';
  };

  const hasActiveFilters = filters.plan_uuid || filters.status;

  const getPlanNameFromUuid = (uuid) => {
    const plan = plans.find(p => p.uuid === uuid);
    return plan ? `${plan.name} (${plan.currency}/${plan.interval})` : 'Unknown Plan';
  };

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
              <FormControl fullWidth size="small" disabled={plansLoading}>
                <InputLabel>Plan</InputLabel>
                <Select
                  value={filters.plan_uuid || ''}
                  label="Plan"
                  onChange={(e) => handleFilterChange('plan_uuid', e.target.value)}
                >
                  <MenuItem value="">All Plans</MenuItem>
                  {plans.map((plan) => (
                    <MenuItem key={plan.uuid} value={plan.uuid}>
                      {plan.name} ({plan.currency}/{plan.interval})
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {plansError && <Typography color="error">{plansError}</Typography>}

              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  <MenuItem value="">All Statuses</MenuItem>
                  <MenuItem value="active">Active</MenuItem>
                  <MenuItem value="suspended">Suspended</MenuItem>
                  <MenuItem value="cancelled">Cancelled</MenuItem>
                  <MenuItem value="pending">Pending</MenuItem>
                </Select>
              </FormControl>

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
              {hasActiveFilters ? 'No subscriptions found' : 'No subscriptions yet.'}
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
                        {getPlanNameFromUuid(sub.plan_uuid) || sub.plan_name || sub.plan_uuid}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {`Created: ${formatDate(sub.created_at)}`}
                        </Typography>
                        <Chip
                          label={sub.status || 'active'}
                          size="small"
                          color={getStatusChipColor(sub.status || 'active')}
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

export default SubscriptionSidebar;
