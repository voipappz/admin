import { useState, useCallback } from 'react';
import { format } from 'date-fns';
import { DATE_PRESETS, getMatchingPresetLabel } from './datePresets';

const useEnhancedDateRangePicker = (dateRange, setDateRange) => {
  const [anchorEl, setAnchorEl] = useState(null);
  const [tempStart, setTempStart] = useState('');
  const [tempEnd, setTempEnd] = useState('');
  const [selectedPreset, setSelectedPreset] = useState(null);

  const open = Boolean(anchorEl);

  const handleOpen = useCallback((event) => {
    // Initialize temp values from current range
    if (dateRange[0]) {
      setTempStart(format(new Date(dateRange[0]), 'yyyy-MM-dd'));
    }
    if (dateRange[1]) {
      setTempEnd(format(new Date(dateRange[1]), 'yyyy-MM-dd'));
    }
    setSelectedPreset(getMatchingPresetLabel(dateRange));
    setAnchorEl(event.currentTarget);
  }, [dateRange]);

  const handleClose = useCallback(() => {
    setAnchorEl(null);
  }, []);

  const handlePresetSelect = useCallback((preset) => {
    const [start, end] = preset.range();
    setTempStart(format(start, 'yyyy-MM-dd'));
    setTempEnd(format(end, 'yyyy-MM-dd'));
    setSelectedPreset(preset.label);
  }, []);

  const handleApply = useCallback(() => {
    if (tempStart && tempEnd) {
      setDateRange([new Date(tempStart), new Date(tempEnd)]);
    }
    setAnchorEl(null);
  }, [tempStart, tempEnd, setDateRange]);

  const handleCancel = useCallback(() => {
    setAnchorEl(null);
  }, []);

  return {
    anchorEl,
    open,
    tempStart,
    tempEnd,
    selectedPreset,
    presets: DATE_PRESETS,
    setTempStart: (val) => { setTempStart(val); setSelectedPreset(null); },
    setTempEnd: (val) => { setTempEnd(val); setSelectedPreset(null); },
    handleOpen,
    handleClose,
    handlePresetSelect,
    handleApply,
    handleCancel,
  };
};

export default useEnhancedDateRangePicker;
