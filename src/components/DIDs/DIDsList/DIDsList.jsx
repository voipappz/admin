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
} from '@mui/material';
import {
  Add as AddIcon,
  FilterList as FilterListIcon,
  Clear as ClearIcon,
  ExpandMore as ExpandMoreIcon,
} from '@mui/icons-material';
import { useState } from 'react';

/**
 * DIDsList Component
 * Displays filters panel for DIDs in the sidebar
 * Filters apply to the main DIDs table
 */
const DIDsList = ({
  loading,
  onAdd,
  filters,
  onFiltersChange,
  bridgeTypes = [],  // Pass bridge types for filter dropdown
}) => {
  const [filtersExpanded, setFiltersExpanded] = useState(true);

  const handleFilterChange = (field, value) => {
    onFiltersChange({ ...filters, [field]: value });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      name: '',
      number: '',
      bridge_type: '',
      type: '',
      enabled: ''
    });
  };

  const hasActiveFilters = filters.name || filters.number || filters.bridge_type || filters.type || filters.enabled !== '';

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: 'var(--mui-palette-background-paper)' }}>
      {/* Add New DID Button */}
      <Box sx={{ p: 2, borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          fullWidth
          disabled={loading}
          data-tour="did-create"
        >
          Create New DID
        </Button>
      </Box>

      {/* Filters Section */}
      <Box sx={{ borderBottom: '1px solid var(--mui-palette-divider)', flexGrow: 1, overflow: 'auto' }}>
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
                <Typography variant="caption" color="primary" sx={{ ml: 'auto' }}>
                  Active
                </Typography>
              )}
            </Box>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 2, pt: 0 }}>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {/* Name Search */}
              <TextField
                fullWidth
                size="small"
                label="Name"
                placeholder="Search by name..."
                value={filters.name || ''}
                onChange={(e) => handleFilterChange('name', e.target.value)}
              />

              {/* Number Search */}
              <TextField
                fullWidth
                size="small"
                label="Number"
                placeholder="Search by number..."
                value={filters.number || ''}
                onChange={(e) => handleFilterChange('number', e.target.value)}
              />

              {/* DID Type Filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Type</InputLabel>
                <Select
                  value={filters.type || ''}
                  label="Type"
                  onChange={(e) => handleFilterChange('type', e.target.value)}
                >
                  <MenuItem value="">All Types</MenuItem>
                  <MenuItem value="sip">SIP</MenuItem>
                  <MenuItem value="pstn">PSTN</MenuItem>
                  <MenuItem value="toll_free">Toll Free</MenuItem>
                </Select>
              </FormControl>

              {/* Bridge Type Filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Bridge Type</InputLabel>
                <Select
                  value={filters.bridge_type || ''}
                  label="Bridge Type"
                  onChange={(e) => handleFilterChange('bridge_type', e.target.value)}
                >
                  <MenuItem value="">All Bridge Types</MenuItem>
                  {bridgeTypes.map(type => (
                    <MenuItem key={type} value={type}>
                      {type.replace('_', ' ').toUpperCase()}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              {/* Enabled Filter */}
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={filters.enabled}
                  label="Status"
                  onChange={(e) => handleFilterChange('enabled', e.target.value)}
                >
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value={true}>Enabled</MenuItem>
                  <MenuItem value={false}>Disabled</MenuItem>
                </Select>
              </FormControl>

              {/* Clear Filters Button */}
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
    </Box>
  );
};

export default DIDsList;
