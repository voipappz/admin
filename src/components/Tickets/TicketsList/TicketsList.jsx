import {
  Box,
  Typography,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useState } from 'react';

/**
 * TicketsList Component
 * Displays filters for tickets in the sidebar
 */
const TicketsList = ({
  loading,
  filters,
  onFiltersChange,
  onAdd,
  onResetFilters,
}) => {
  const [filtersExpanded, setFiltersExpanded] = useState(true);
  const [localSearch, setLocalSearch] = useState(filters.search || '');

  // Status options matching Zendesk statuses
  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'new', label: 'New' },
    { value: 'open', label: 'Open' },
    { value: 'pending', label: 'Pending' },
    { value: 'hold', label: 'On Hold' },
    { value: 'solved', label: 'Solved' },
    { value: 'closed', label: 'Closed' },
  ];

  // Priority options
  const priorityOptions = [
    { value: '', label: 'All Priorities' },
    { value: 'low', label: 'Low' },
    { value: 'normal', label: 'Normal' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' },
  ];

  const handleFilterChange = (field, value) => {
    onFiltersChange({ [field]: value });
  };

  const handleSearchKeyDown = (e) => {
    if (e.key === 'Enter') {
      onFiltersChange({ search: localSearch });
    }
  };

  const handleClearFilters = () => {
    setLocalSearch('');
    onResetFilters();
  };

  const hasActiveFilters = filters.status || filters.priority || filters.search;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--mui-palette-background-paper)' }}>
      {/* Add New Ticket Button */}
      <Box sx={{ p: 2, borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          fullWidth
          disabled={loading}
        >
          New Ticket
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
              {/* Search */}
              <TextField
                fullWidth
                size="small"
                label="Search"
                placeholder="Search tickets..."
                value={localSearch}
                onChange={(e) => setLocalSearch(e.target.value)}
                onKeyDown={handleSearchKeyDown}
                onBlur={() => handleFilterChange('search', localSearch)}
              />

              {/* Status filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.status || ''}
                  label="Status"
                  onChange={(e) => handleFilterChange('status', e.target.value)}
                >
                  {statusOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Priority filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Priority</InputLabel>
                <Select
                  value={filters.priority || ''}
                  label="Priority"
                  onChange={(e) => handleFilterChange('priority', e.target.value)}
                >
                  {priorityOptions.map((option) => (
                    <MenuItem key={option.value} value={option.value}>
                      {option.label}
                    </MenuItem>
                  ))}
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

      {/* Quick Filters (Status Shortcuts) */}
      <Box sx={{ p: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Quick Filters
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          <Chip
            label="New"
            size="small"
            variant={filters.status === 'new' ? 'filled' : 'outlined'}
            color={filters.status === 'new' ? 'primary' : 'default'}
            onClick={() => handleFilterChange('status', filters.status === 'new' ? '' : 'new')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label="Open"
            size="small"
            variant={filters.status === 'open' ? 'filled' : 'outlined'}
            color={filters.status === 'open' ? 'warning' : 'default'}
            onClick={() => handleFilterChange('status', filters.status === 'open' ? '' : 'open')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label="Pending"
            size="small"
            variant={filters.status === 'pending' ? 'filled' : 'outlined'}
            color={filters.status === 'pending' ? 'info' : 'default'}
            onClick={() => handleFilterChange('status', filters.status === 'pending' ? '' : 'pending')}
            sx={{ cursor: 'pointer' }}
          />
          <Chip
            label="Solved"
            size="small"
            variant={filters.status === 'solved' ? 'filled' : 'outlined'}
            color={filters.status === 'solved' ? 'success' : 'default'}
            onClick={() => handleFilterChange('status', filters.status === 'solved' ? '' : 'solved')}
            sx={{ cursor: 'pointer' }}
          />
        </Box>
      </Box>
    </Box>
  );
};

export default TicketsList;
