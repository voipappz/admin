import React, { useState, useEffect } from 'react';
import {
  Paper,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  IconButton,
  Typography,
  Alert,
  TextField,
  ToggleButton,
  ToggleButtonGroup
} from '@mui/material';
import {
  Delete as DeleteIcon
} from '@mui/icons-material';
import {
  validateTimeRange,
  getYearOptions
} from '../shared/TimeRangeValidator.js';
import { Z } from '../../../utils/zIndex.js';

/**
 * TimeEntryEditor Component
 * Editor for individual time condition entries
 *
 * Based on legacy AngularJS patterns from:
 * - /opt/src/va-voipbox-admin/src/views/call_conditions/new.html
 * - Uses toggle buttons (pill-style) for multi-select days/months
 *
 * Entry Types:
 * - time: HH:MM range with hour/minute selects
 * - week_day: Day of week (0-6) - toggle buttons
 * - month_day: Day of month (1-31) - toggle buttons
 * - month: Month (1-12) - toggle buttons
 * - year: Year - dropdown select
 */

// Generate hours array 00-23
const HOURS = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));

// Generate minutes array 00-59 in 5-minute increments
const MINUTES = Array.from({ length: 12 }, (_, i) => (i * 5).toString().padStart(2, '0'));

// Week day short names (0=Sun, 6=Sat)
const WEEK_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Month short names
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Days of month 1-31
const MONTH_DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

// MenuProps for Select components - ensures dropdowns appear above dialog
const SELECT_MENU_PROPS = {
  PaperProps: { sx: { zIndex: Z.L2.MENU } }
};

export const TimeEntryEditor = ({ entry, onChange, onRemove, disabled = false }) => {
  const [timeError, setTimeError] = useState(null);

  // Parse time string "HH:MM" into { hours, minutes }
  const parseTime = (timeStr) => {
    if (!timeStr || !timeStr.includes(':')) return { hours: '', minutes: '' };
    const [hours, minutes] = timeStr.split(':');
    return { hours: hours || '', minutes: minutes || '' };
  };

  // Build time string from hours and minutes
  const buildTime = (hours, minutes) => {
    if (!hours && !minutes) return '';
    return `${hours || '00'}:${minutes || '00'}`;
  };

  // Validate time range when entry changes
  useEffect(() => {
    if (entry.type === 'time' && entry.starts_at && entry.ends_at) {
      const validation = validateTimeRange(entry.starts_at, entry.ends_at);
      setTimeError(validation.error);
    } else {
      setTimeError(null);
    }
  }, [entry.type, entry.starts_at, entry.ends_at]);

  // Handle field update
  const updateField = (field, value) => {
    onChange({ ...entry, [field]: value });
  };

  // Handle type change - reset values
  const handleTypeChange = (newType) => {
    onChange({
      type: newType,
      starts_at: '',
      ends_at: '',
      value: '',
      operator: newType === 'call_caller' || newType === 'call_destination' ? 'IS' : ''
    });
  };

  // Handle time field update
  const handleTimeChange = (field, part, value) => {
    const currentTime = parseTime(entry[field]);
    const newTime = buildTime(
      part === 'hours' ? value : currentTime.hours,
      part === 'minutes' ? value : currentTime.minutes
    );
    updateField(field, newTime);
  };

  // Handle toggle button selection (multi-select)
  const handleToggleSelect = (newValues) => {
    if (newValues === null) {
      updateField('value', '');
    } else {
      // Sort values numerically and join with comma
      const sorted = [...newValues].sort((a, b) => parseInt(a) - parseInt(b));
      updateField('value', sorted.join(','));
    }
  };

  // Get current selected values as array
  const getSelectedValues = () => {
    if (!entry.value) return [];
    return entry.value.split(',').filter(v => v.trim());
  };

  const startTime = parseTime(entry.starts_at);
  const endTime = parseTime(entry.ends_at);

  return (
    <Paper sx={{ p: 2, border: '1px solid', borderColor: 'divider', mb: 2 }}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {/* Header Row: Type selector and delete button */}
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <FormControl sx={{ minWidth: 180 }} disabled={disabled}>
            <InputLabel>Condition Type</InputLabel>
            <Select
              value={entry.type || 'time'}
              onChange={(e) => handleTypeChange(e.target.value)}
              label="Condition Type"
              size="small"
              MenuProps={SELECT_MENU_PROPS}
            >
              <MenuItem value="time">Time Range</MenuItem>
              <MenuItem value="week_day">Day of Week</MenuItem>
              <MenuItem value="month_day">Day of Month</MenuItem>
              <MenuItem value="month">Month</MenuItem>
              <MenuItem value="year">Year</MenuItem>
              <MenuItem value="call_caller">Caller ID</MenuItem>
              <MenuItem value="call_destination">Destination</MenuItem>
            </Select>
          </FormControl>

          <IconButton onClick={onRemove} color="error" size="small" disabled={disabled}>
            <DeleteIcon />
          </IconButton>
        </Box>

        {/* Time Range - Hour/Minute selects like old admin */}
        {entry.type === 'time' && (
          <Box sx={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 50 }}>From:</Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={startTime.hours}
                  onChange={(e) => handleTimeChange('starts_at', 'hours', e.target.value)}
                  disabled={disabled}
                  displayEmpty
                  MenuProps={SELECT_MENU_PROPS}
                >
                  <MenuItem value=""><em>HH</em></MenuItem>
                  {HOURS.map(h => (
                    <MenuItem key={h} value={h}>{h}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography>:</Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={startTime.minutes}
                  onChange={(e) => handleTimeChange('starts_at', 'minutes', e.target.value)}
                  disabled={disabled}
                  displayEmpty
                  MenuProps={SELECT_MENU_PROPS}
                >
                  <MenuItem value=""><em>MM</em></MenuItem>
                  {MINUTES.map(m => (
                    <MenuItem key={m} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ minWidth: 50 }}>To:</Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={endTime.hours}
                  onChange={(e) => handleTimeChange('ends_at', 'hours', e.target.value)}
                  disabled={disabled}
                  displayEmpty
                  error={!!timeError}
                  MenuProps={SELECT_MENU_PROPS}
                >
                  <MenuItem value=""><em>HH</em></MenuItem>
                  {HOURS.map(h => (
                    <MenuItem key={h} value={h}>{h}</MenuItem>
                  ))}
                </Select>
              </FormControl>
              <Typography>:</Typography>
              <FormControl size="small" sx={{ minWidth: 80 }}>
                <Select
                  value={endTime.minutes}
                  onChange={(e) => handleTimeChange('ends_at', 'minutes', e.target.value)}
                  disabled={disabled}
                  displayEmpty
                  error={!!timeError}
                  MenuProps={SELECT_MENU_PROPS}
                >
                  <MenuItem value=""><em>MM</em></MenuItem>
                  {MINUTES.map(m => (
                    <MenuItem key={m} value={m}>{m}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          </Box>
        )}

        {/* Week Day - Toggle buttons (pill style like old admin) */}
        {entry.type === 'week_day' && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Select Days:
            </Typography>
            <ToggleButtonGroup
              value={getSelectedValues()}
              onChange={(e, newValues) => handleToggleSelect(newValues)}
              disabled={disabled}
              sx={{ flexWrap: 'wrap', gap: 0.5 }}
            >
              {WEEK_DAYS.map((day, index) => (
                <ToggleButton
                  key={index}
                  value={index.toString()}
                  sx={{
                    px: 2,
                    py: 0.5,
                    borderRadius: '20px !important',
                    border: '1px solid #65758a !important',
                    textTransform: 'capitalize',
                    '&.Mui-selected': {
                      backgroundColor: '#65758a',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: '#4a5568',
                      },
                    },
                  }}
                >
                  {day}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Month Day - Toggle buttons (1-31) */}
        {entry.type === 'month_day' && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Select Days of Month:
            </Typography>
            <ToggleButtonGroup
              value={getSelectedValues()}
              onChange={(e, newValues) => handleToggleSelect(newValues)}
              disabled={disabled}
              sx={{ flexWrap: 'wrap', gap: 0.5 }}
            >
              {MONTH_DAYS.map((day) => (
                <ToggleButton
                  key={day}
                  value={day.toString()}
                  sx={{
                    minWidth: 36,
                    px: 1,
                    py: 0.5,
                    borderRadius: '20px !important',
                    border: '1px solid #65758a !important',
                    '&.Mui-selected': {
                      backgroundColor: '#65758a',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: '#4a5568',
                      },
                    },
                  }}
                >
                  {day}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Month - Toggle buttons (Jan-Dec) */}
        {entry.type === 'month' && (
          <Box>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Select Months:
            </Typography>
            <ToggleButtonGroup
              value={getSelectedValues()}
              onChange={(e, newValues) => handleToggleSelect(newValues)}
              disabled={disabled}
              sx={{ flexWrap: 'wrap', gap: 0.5 }}
            >
              {MONTHS.map((month, index) => (
                <ToggleButton
                  key={index}
                  value={(index + 1).toString()}
                  sx={{
                    px: 2,
                    py: 0.5,
                    borderRadius: '20px !important',
                    border: '1px solid #65758a !important',
                    textTransform: 'capitalize',
                    '&.Mui-selected': {
                      backgroundColor: '#65758a',
                      color: '#fff',
                      '&:hover': {
                        backgroundColor: '#4a5568',
                      },
                    },
                  }}
                >
                  {month}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>
        )}

        {/* Year - Dropdown select */}
        {entry.type === 'year' && (
          <Box sx={{ display: 'flex', gap: 2 }}>
            <FormControl sx={{ minWidth: 120 }} size="small" disabled={disabled}>
              <InputLabel>From Year</InputLabel>
              <Select
                value={entry.starts_at || ''}
                onChange={(e) => updateField('starts_at', e.target.value)}
                label="From Year"
                MenuProps={SELECT_MENU_PROPS}
              >
                <MenuItem value=""><em>Select</em></MenuItem>
                {getYearOptions().map((year) => (
                  <MenuItem key={year} value={year.toString()}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <FormControl sx={{ minWidth: 120 }} size="small" disabled={disabled}>
              <InputLabel>To Year</InputLabel>
              <Select
                value={entry.ends_at || ''}
                onChange={(e) => updateField('ends_at', e.target.value)}
                label="To Year"
                MenuProps={SELECT_MENU_PROPS}
              >
                <MenuItem value=""><em>Select</em></MenuItem>
                {getYearOptions().map((year) => (
                  <MenuItem key={year} value={year.toString()}>
                    {year}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        )}

        {/* Caller ID matching */}
        {entry.type === 'call_caller' && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <FormControl size="small" sx={{ minWidth: 130 }} disabled={disabled}>
              <InputLabel>Operator</InputLabel>
              <Select
                value={entry.operator || 'IS'}
                onChange={(e) => updateField('operator', e.target.value)}
                label="Operator"
                MenuProps={SELECT_MENU_PROPS}
              >
                <MenuItem value="IS">IS</MenuItem>
                <MenuItem value="IN">IN</MenuItem>
                <MenuItem value="NOT_IN">NOT IN</MenuItem>
                <MenuItem value="PREFIX">PREFIX</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label={entry.operator === 'IN' || entry.operator === 'NOT_IN' ? 'Phone Numbers (comma-separated)' : 'Phone Number'}
              value={entry.value || ''}
              onChange={(e) => updateField('value', e.target.value)}
              size="small"
              fullWidth
              disabled={disabled}
              placeholder={entry.operator === 'IN' || entry.operator === 'NOT_IN' ? '+1234567890, +0987654321' : '+1234567890'}
              helperText={entry.operator === 'PREFIX' ? 'Matches numbers starting with this prefix' : ''}
            />
          </Box>
        )}

        {/* Destination matching */}
        {entry.type === 'call_destination' && (
          <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
            <FormControl size="small" sx={{ minWidth: 130 }} disabled={disabled}>
              <InputLabel>Operator</InputLabel>
              <Select
                value={entry.operator || 'IS'}
                onChange={(e) => updateField('operator', e.target.value)}
                label="Operator"
                MenuProps={SELECT_MENU_PROPS}
              >
                <MenuItem value="IS">IS</MenuItem>
                <MenuItem value="PREFIX">PREFIX</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Destination Number"
              value={entry.value || ''}
              onChange={(e) => updateField('value', e.target.value)}
              size="small"
              fullWidth
              disabled={disabled}
              placeholder="+1234567890"
              helperText={entry.operator === 'PREFIX' ? 'Matches destinations starting with this prefix' : ''}
            />
          </Box>
        )}
      </Box>

      {/* Error Display */}
      {timeError && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {timeError}
        </Alert>
      )}
    </Paper>
  );
};

export default TimeEntryEditor;
