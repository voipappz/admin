import React from 'react';
import { Box, Button, Popover, TextField, Typography } from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { primaryButtonStyle, secondaryButtonStyle } from '../../../theme/buttonStyles';
import { formatDateRangeDisplay } from './datePresets';
import useEnhancedDateRangePicker from './useEnhancedDateRangePicker';
import './EnhancedDateRangePicker.css';

const EnhancedDateRangePicker = ({ dateRange, setDateRange }) => {
  const {
    anchorEl,
    open,
    tempStart,
    tempEnd,
    selectedPreset,
    presets,
    setTempStart,
    setTempEnd,
    handleOpen,
    handleClose,
    handlePresetSelect,
    handleApply,
    handleCancel,
  } = useEnhancedDateRangePicker(dateRange, setDateRange);

  const displayText = formatDateRangeDisplay(dateRange);

  return (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Box
          className="enhanced-date-picker-trigger"
          onClick={handleOpen}
        >
          <CalendarTodayIcon sx={{ fontSize: 16, color: 'var(--accent-primary)' }} />
          <Typography
            variant="body2"
            sx={{ fontFamily: 'var(--font-family)', fontWeight: 500, fontSize: '0.8rem', color: 'var(--theme-text-primary)' }}
          >
            {displayText}
          </Typography>
        </Box>
      </Box>

      <Popover
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        PaperProps={{
          sx: {
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            mt: 1,
            overflow: 'hidden',
          }
        }}
      >
        <Box className="enhanced-date-picker-popover">
          {/* Presets sidebar */}
          <Box className="enhanced-date-picker-presets">
            {presets.map((preset) => (
              <Box
                key={preset.label}
                className={`enhanced-date-picker-preset-item ${selectedPreset === preset.label ? 'selected' : ''}`}
                onClick={() => handlePresetSelect(preset)}
              >
                {preset.label}
              </Box>
            ))}
          </Box>

          {/* Custom date inputs */}
          <Box className="enhanced-date-picker-custom">
            <Typography
              variant="subtitle2"
              sx={{ fontFamily: 'var(--font-family)', fontWeight: 600, color: 'var(--theme-text-primary)' }}
            >
              Custom Range
            </Typography>

            <Box className="enhanced-date-picker-inputs">
              <TextField
                size="small"
                label="Start"
                type="date"
                value={tempStart}
                onChange={(e) => setTempStart(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-family)',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    '& fieldset': { borderColor: 'var(--theme-border)' },
                    '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                    '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-family)',
                    fontSize: '0.85rem',
                    '&.Mui-focused': { color: 'var(--accent-primary)' },
                  },
                }}
              />
              <Typography variant="body2" sx={{ color: 'var(--theme-text-secondary)' }}>to</Typography>
              <TextField
                size="small"
                label="End"
                type="date"
                value={tempEnd}
                onChange={(e) => setTempEnd(e.target.value)}
                InputLabelProps={{ shrink: true }}
                sx={{
                  flex: 1,
                  '& .MuiOutlinedInput-root': {
                    fontFamily: 'var(--font-family)',
                    fontSize: '0.85rem',
                    borderRadius: '6px',
                    '& fieldset': { borderColor: 'var(--theme-border)' },
                    '&:hover fieldset': { borderColor: 'var(--accent-primary)' },
                    '&.Mui-focused fieldset': { borderColor: 'var(--accent-primary)' },
                  },
                  '& .MuiInputLabel-root': {
                    fontFamily: 'var(--font-family)',
                    fontSize: '0.85rem',
                    '&.Mui-focused': { color: 'var(--accent-primary)' },
                  },
                }}
              />
            </Box>

            <Box className="enhanced-date-picker-actions">
              <Button
                size="small"
                onClick={handleCancel}
                sx={{ ...secondaryButtonStyle, px: 2, py: 0.5 }}
              >
                Cancel
              </Button>
              <Button
                size="small"
                variant="contained"
                onClick={handleApply}
                disabled={!tempStart || !tempEnd}
                sx={{ ...primaryButtonStyle, px: 2, py: 0.5 }}
              >
                Apply
              </Button>
            </Box>
          </Box>
        </Box>
      </Popover>
    </>
  );
};

export default EnhancedDateRangePicker;
