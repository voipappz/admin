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
import { formatDate } from '../../../utils/dateUtils';

/**
 * EnvironmentsList Component
 * Displays a list of environments in the sidebar with filters
 */
const EnvironmentsList = ({
  environments,
  loading,
  error,
  selectedEnvironmentId,
  onSelect,
  onAdd,
  filters,
  onFiltersChange,
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
      enabled: '',
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

  if (loading && environments.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 1 }} variant="body2">
          Loading environments...
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

  const hasActiveFilters = filters.search || filters.enabled ||
    filters.created_at || filters.updated_at;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--mui-palette-background-paper)' }}>
      {/* Add New Environment Button */}
      <Box sx={{ p: 2, borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          fullWidth
          disabled={loading}
        >
          Add Application
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
                placeholder="Name or type..."
                value={filters.search || ''}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />

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

      {/* Environments Count */}
      <Box sx={{ px: 2, py: 1, bgcolor: 'var(--mui-palette-surface-muted)', borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Typography variant="caption" color="text.secondary">
          {`Total: ${environments.length}`}
        </Typography>
      </Box>

      {/* Environments List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {environments.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {hasActiveFilters ? 'No environments found' : 'No environments yet'}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {environments.map((env) => {
              const envId = env.id || env.uuid;
              const isSelected = selectedEnvironmentId === envId;

              return (
                <ListItem key={envId} disablePadding sx={{ borderBottom: '1px solid var(--mui-palette-divider)' }}>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelect(envId)}
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
                          {env.name}
                        </Typography>
                        <Chip
                          label={env.enabled ? 'Active' : 'Disabled'}
                          size="small"
                          color={env.enabled ? 'success' : 'default'}
                          sx={{ height: 20, fontSize: '0.65rem', fontWeight: 600 }}
                        />
                      </Box>
                      {/* Created At */}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block', mb: 0.25 }}
                      >
                        Created: {formatDate(env.created_at)}
                      </Typography>
                      {/* Updated At */}
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ display: 'block' }}
                      >
                        Updated: {formatDate(env.updated_at)}
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

export default EnvironmentsList;
