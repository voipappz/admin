import React from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  FormControl,
  FormGroup,
  FormControlLabel,
  Checkbox,
  RadioGroup,
  Radio,
  Button,
  Divider,
  InputAdornment,
  IconButton,
  Chip,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterIcon,
} from '@mui/icons-material';

const LOG_LEVELS = [
  { key: 'fatal', label: 'Fatal', color: '#F08080' },
  { key: 'error', label: 'Error', color: '#FFA07A' },
  { key: 'warn', label: 'Warn', color: '#F0E68C' },
  { key: 'info', label: 'Info', color: '#00FA9A' },
  { key: 'debug', label: 'Debug', color: '#ADD8E6' },
  { key: 'trace', label: 'Trace', color: '#D3D3D3' },
];

const TIME_PERIODS = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'all', label: 'All Time' },
];

const CallsLogSidebar = ({
  apps,
  filters,
  searchQuery,
  selectedApp,
  timePeriod,
  tagFilters,
  onSearchChange,
  onAppChange,
  onTimePeriodChange,
  onToggleLogLevel,
  onRemoveTagFilter,
  onApply,
  onClear,
}) => {
  return (
    <Paper
      className="calls-log-sidebar"
      sx={{
        width: 280,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 0,
        borderRight: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Header */}
      <Box sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FilterIcon fontSize="small" />
          Filters
        </Typography>
      </Box>

      {/* Scrollable Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 2 }}>
        {/* Search */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Search
          </Typography>
          <TextField
            size="small"
            fullWidth
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: searchQuery && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => onSearchChange('')}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Application Filter */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Application
          </Typography>
          <FormControl component="fieldset" size="small">
            <RadioGroup
              value={selectedApp}
              onChange={(e) => onAppChange(e.target.value)}
            >
              <FormControlLabel
                value=""
                control={<Radio size="small" />}
                label="All Apps"
              />
              {apps.map((app) => (
                <FormControlLabel
                  key={app}
                  value={app}
                  control={<Radio size="small" />}
                  label={app}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Log Level Filter */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Log Level
          </Typography>
          <FormGroup>
            {LOG_LEVELS.map((level) => (
              <FormControlLabel
                key={level.key}
                control={
                  <Checkbox
                    size="small"
                    checked={filters.logLevels[level.key] || false}
                    onChange={() => onToggleLogLevel(level.key)}
                    sx={{
                      color: level.color,
                      '&.Mui-checked': { color: level.color },
                    }}
                  />
                }
                label={
                  <Chip
                    label={level.label}
                    size="small"
                    sx={{
                      backgroundColor: level.color,
                      color: 'black',
                      fontWeight: 500,
                    }}
                  />
                }
              />
            ))}
          </FormGroup>
        </Box>

        <Divider sx={{ mb: 2 }} />

        {/* Time Period Filter */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle2" color="text.secondary" gutterBottom>
            Time Period
          </Typography>
          <FormControl component="fieldset" size="small">
            <RadioGroup
              value={timePeriod}
              onChange={(e) => onTimePeriodChange(e.target.value)}
            >
              {TIME_PERIODS.map((period) => (
                <FormControlLabel
                  key={period.value}
                  value={period.value}
                  control={<Radio size="small" />}
                  label={period.label}
                />
              ))}
            </RadioGroup>
          </FormControl>
        </Box>

        {/* Active Tag Filters */}
        {tagFilters.length > 0 && (
          <>
            <Divider sx={{ mb: 2 }} />
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Active Tags
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {tagFilters.map((tag, index) => (
                  <Chip
                    key={`${tag.key}-${tag.value}-${index}`}
                    label={`${tag.key}: ${tag.value}`}
                    size="small"
                    onDelete={() => onRemoveTagFilter(index)}
                    variant="outlined"
                  />
                ))}
              </Box>
            </Box>
          </>
        )}
      </Box>

      {/* Footer Actions */}
      <Box
        sx={{
          p: 2,
          borderTop: '1px solid',
          borderColor: 'divider',
          display: 'flex',
          gap: 1,
        }}
      >
        <Button
          variant="contained"
          size="small"
          fullWidth
          onClick={onApply}
        >
          Apply
        </Button>
        <Button
          variant="outlined"
          size="small"
          fullWidth
          onClick={onClear}
        >
          Clear
        </Button>
      </Box>
    </Paper>
  );
};

export default CallsLogSidebar;
