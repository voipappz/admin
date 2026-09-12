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
  Business as BusinessIcon,
} from '@mui/icons-material';
import { useState } from 'react';
import { formatDate } from '../../../utils/dateUtils';

/**
 * ProvidersList Component
 * Displays a list of providers in the sidebar with filters
 */
const ProvidersList = ({
  providers,
  loading,
  error,
  selectedProviderId,
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
      type: '',
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

  if (loading && providers.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', p: 3 }}>
        <CircularProgress size={24} />
        <Typography sx={{ ml: 1 }} variant="body2">
          Loading providers...
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

  const getTypeColor = (type) => {
    const colorMap = {
      sip: 'primary',
      did: 'secondary',
      sms: 'success',
      gateway: 'info',
      webhook: 'warning',
      tts: 'primary',
      stt: 'secondary',
      smtp: 'info',
      caller_id_number: 'success',
      llm: 'warning',
    };
    return colorMap[type] || 'default';
  };

  const hasActiveFilters = filters.search || filters.type ||
    filters.created_at || filters.updated_at;

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', bgcolor: '#fff' }}>
      {/* Add New Provider Button */}
      <Box sx={{ p: 2, borderBottom: '1px solid #e0e0e0' }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={onAdd}
          fullWidth
          disabled={loading}
        >
          Add Provider
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
                placeholder="Name or type..."
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
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="sip">SIP</MenuItem>
                  <MenuItem value="did">DID</MenuItem>
                  <MenuItem value="sms">SMS</MenuItem>
                  <MenuItem value="gateway">Gateway</MenuItem>
                  <MenuItem value="webhook">Webhook</MenuItem>
                  <MenuItem value="caller_id_number">Caller ID Number</MenuItem>
                  <MenuItem value="tts">TTS</MenuItem>
                  <MenuItem value="stt">STT</MenuItem>
                  <MenuItem value="smtp">SMTP</MenuItem>
                  <MenuItem value="llm">LLM</MenuItem>
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

      {/* Providers Count */}
      <Box sx={{ px: 2, py: 1, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
        <Typography variant="caption" color="text.secondary">
          {`Total: ${providers.length}`}
        </Typography>
      </Box>

      {/* Providers List */}
      <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
        {providers.length === 0 ? (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {hasActiveFilters ? 'No providers found' : 'No providers yet'}
            </Typography>
          </Box>
        ) : (
          <List dense sx={{ p: 0 }}>
            {providers.map((provider) => {
              const providerId = provider.id || provider.uuid;
              const isSelected = selectedProviderId === providerId;

              return (
                <ListItem key={providerId} disablePadding sx={{ borderBottom: '1px solid #f0f0f0' }}>
                  <ListItemButton
                    selected={isSelected}
                    onClick={() => onSelect(providerId)}
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
                        <BusinessIcon fontSize="small" color="action" />
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
                          {String(provider.name || 'Unnamed')}
                        </Typography>
                        <Chip
                          label={String(provider.type || 'N/A')}
                          size="small"
                          color={getTypeColor(provider.type)}
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
                        {provider.profile && typeof provider.profile === 'object'
                          ? Object.entries(provider.profile).map(([k, v]) => `${k}: ${v}`).join(', ') || 'No profile'
                          : String(provider.profile || 'No profile')}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {formatDate(provider.created_at)}
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

export default ProvidersList;
