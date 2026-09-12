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
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import { useState } from 'react';

/**
 * ServicesList Component
 * Displays a list of services in the sidebar with filters
 */
const ServicesList = ({
  services,
  loading,
  error,
  selectedServiceId,
  onSelect,
  onAdd,
  filters,
  onFiltersChange,
  serviceTypes = [], // API-fetched service types
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
      type: '',
      enabled: '',
      created_at: '',
      updated_at: ''
    });
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

  if (loading && services.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 1 }} variant="body2">
          Loading services...
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

  // Production-ready service types only
  const PRODUCTION_TYPES = ['webhook', 'workflow', 'rule', 'monitor', 'provider', 'notification', 'powerlink', 'fireberry', 'transcribe', 'report', 'caller_id_number'];

  const getTypeColor = (type) => {
    const colorMap = {
      webhook: 'info',
      workflow: 'primary',
      rule: 'secondary',
      monitor: 'warning',
      provider: 'error',
      notification: 'success',
      powerlink: 'primary',
      fireberry: 'primary',
      transcribe: 'info',
      report: 'secondary',
    };
    return colorMap[type] || 'default';
  };

  const hasActiveFilters = filters.search || filters.type || filters.enabled ||
    filters.created_at || filters.updated_at;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      {/* Add New Service Button */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Button
          variant="contained"
          startIcon={<SettingsIcon />}
          onClick={onAdd}
          fullWidth
          disabled={loading}
        >
          Add Service
        </Button>
      </Box>

      {/* Filters Section */}
      <Box sx={{ borderBottom: '1px solid #e0e0e0' }}>
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
                placeholder="Service name..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />

              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type || ''}
                  label="Type"
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  {(serviceTypes.length > 0 ? serviceTypes : PRODUCTION_TYPES).map((type) => (
                    <MenuItem key={type} value={type}>
                      {type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.enabled || ''}
                  label="Status"
                  onChange={(e) => handleFilterChange('enabled', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">Enabled</MenuItem>
                  <MenuItem value="false">Disabled</MenuItem>
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

      {/* Services Count */}
      <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          {`Total: ${services.length}`}
        </Typography>
      </Box>

      {/* Services List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {services.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {hasActiveFilters ? 'No services found' : 'No services yet'}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {services.map((service) => {
              const serviceId = service.id || service.uuid;
              const isSelected = selectedServiceId === serviceId;

              return (
                <ListItem key={serviceId} disablePadding sx={{ borderBottom: '1px solid #f0f0f0' }}>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelect(serviceId)}
                    sx={{
                      py: 1.5,
                      px: 2,
                      transition: 'background-color 0.2s',
                      '&:hover': { bgcolor: '#f5f5f5' },
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
                          {service.display_name || service.name}
                        </Typography>
                        <Chip
                          label={service.type}
                          size="small"
                          color={getTypeColor(service.type)}
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
                        {service.notes || 'No description'}
                      </Typography>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                          {service.uuid ? service.uuid.substring(0, 8) + '...' : 'N/A'}
                        </Typography>
                        <Chip
                          label={service.enabled ? 'Enabled' : 'Disabled'}
                          size="small"
                          color={service.enabled ? 'success' : 'default'}
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

export default ServicesList;