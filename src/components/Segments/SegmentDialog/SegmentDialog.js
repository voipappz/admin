import { useState, useCallback } from 'react';
import { createSegment, updateSegment } from '../../../services/api/segmentsApi.js';

/**
 * Segment field definitions — kept intentionally minimal.
 * Only TIME-based rules and CALLER ID are exposed in the UI.
 *
 * Each field has: key, label, category, hint (helper text shown under field).
 */
export const SEGMENT_FIELDS = [
  // Time
  { key: 'time.weekday', label: 'Day of Week', category: 'Time',
    hint: 'Pick the days when this rule should apply (Mon–Sun).' },
  { key: 'time.hour', label: 'Hour of Day', category: 'Time',
    hint: 'Pick a single hour or a range, in 24-hour format (0–23).' },
  { key: 'time.monthday', label: 'Day of Month', category: 'Time',
    hint: 'Pick specific days of the month (1–31).' },
  { key: 'time.month', label: 'Month', category: 'Time',
    hint: 'Pick the months when this rule should apply.' },
  // Call
  { key: 'call.caller', label: 'Caller ID', category: 'Caller',
    hint: 'Match by the incoming caller phone number.' },
];

/**
 * All available operators (only the ones we actually use).
 */
export const ALL_OPERATORS = [
  { key: 'IN',      label: 'is one of' },
  { key: 'NOT_IN',  label: 'is not one of' },
  { key: 'IS',      label: 'equals' },
  { key: 'BETWEEN', label: 'between' },
  { key: 'PREFIX',  label: 'starts with' },
  { key: 'CONTAINS',label: 'contains' },
];

/**
 * Returns relevant operators for a given field.
 */
export const getOperatorsForField = (field) => {
  if (!field) return [];

  // Multi-pick time fields → IN / NOT_IN
  if (['time.weekday', 'time.month', 'time.monthday'].includes(field)) {
    return ALL_OPERATORS.filter(op => ['IN', 'NOT_IN'].includes(op.key));
  }

  // Hour → BETWEEN (range) or IS (single)
  if (field === 'time.hour') {
    return ALL_OPERATORS.filter(op => ['BETWEEN', 'IS'].includes(op.key));
  }

  // Caller ID → equals / starts with / contains / one-of
  if (field === 'call.caller') {
    return ALL_OPERATORS.filter(op =>
      ['IS', 'PREFIX', 'CONTAINS', 'IN', 'NOT_IN'].includes(op.key)
    );
  }

  return ALL_OPERATORS;
};

/**
 * Default operator suggestion for a field — used to auto-pick when the
 * user selects a field, so they don't need to think about it.
 */
export const getDefaultOperatorForField = (field) => {
  switch (field) {
    case 'time.weekday':  return 'IN';
    case 'time.month':    return 'IN';
    case 'time.monthday': return 'IN';
    case 'time.hour':     return 'BETWEEN';
    case 'call.caller':   return 'IS';
    default:              return '';
  }
};

// ---------------------------------------------------------------------------
// Quick templates — one-click presets for the most common rules.
// ---------------------------------------------------------------------------
export const SEGMENT_TEMPLATES = [
  {
    id: 'business-hours',
    label: 'Business Hours (9–17)',
    name: 'Business Hours',
    field: 'time.hour',
    operator: 'BETWEEN',
    value: ['9', '17'],
  },
  {
    id: 'weekdays',
    label: 'Weekdays (Mon–Fri)',
    name: 'Weekdays',
    field: 'time.weekday',
    operator: 'IN',
    value: ['1', '2', '3', '4', '5'],
  },
  {
    id: 'weekend',
    label: 'Weekend (Sat–Sun)',
    name: 'Weekend',
    field: 'time.weekday',
    operator: 'IN',
    value: ['0', '6'],
  },
  {
    id: 'after-hours',
    label: 'After Hours (17–23)',
    name: 'After Hours',
    field: 'time.hour',
    operator: 'BETWEEN',
    value: ['17', '23'],
  },
];

// ---------------------------------------------------------------------------
// Auto-name generator — builds a friendly name from field/operator/value.
// ---------------------------------------------------------------------------
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_LABELS   = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export const generateAutoName = (field, operator, value) => {
  const arr = Array.isArray(value) ? value : [value].filter(Boolean);
  if (!field || !operator || arr.length === 0) return '';

  if (field === 'time.weekday') {
    const days = arr.map(v => WEEKDAY_LABELS[parseInt(v, 10)] || v);
    return (operator === 'NOT_IN' ? 'Not ' : '') + days.join(', ');
  }
  if (field === 'time.month') {
    const months = arr.map(v => MONTH_LABELS[parseInt(v, 10) - 1] || v);
    return (operator === 'NOT_IN' ? 'Not ' : '') + months.join(', ');
  }
  if (field === 'time.monthday') {
    return (operator === 'NOT_IN' ? 'Not days ' : 'Days ') + arr.join(', ');
  }
  if (field === 'time.hour') {
    if (operator === 'BETWEEN' && arr.length === 2) {
      return `${pad(arr[0])}:00–${pad(arr[1])}:00`;
    }
    return `Hour ${arr.join(', ')}`;
  }
  if (field === 'call.caller') {
    if (operator === 'PREFIX')   return `Caller starts with ${arr[0]}`;
    if (operator === 'CONTAINS') return `Caller contains ${arr[0]}`;
    if (operator === 'IS')       return `Caller ${arr[0]}`;
    if (operator === 'IN')       return `Caller in ${arr.join(', ')}`;
    if (operator === 'NOT_IN')   return `Caller not in ${arr.join(', ')}`;
  }
  return '';
};

const pad = (n) => String(n).padStart(2, '0');

/**
 * Check if operator expects multiple values
 */
export const isMultiValueOperator = (operator) => {
  return ['IN', 'NOT_IN'].includes(operator);
};

/**
 * Check if operator expects a range (exactly 2 values)
 */
export const isRangeOperator = (operator) => {
  return operator === 'BETWEEN';
};

/**
 * Get unique field categories (in order)
 */
export const getFieldCategories = () => {
  const seen = new Set();
  return SEGMENT_FIELDS.reduce((categories, f) => {
    if (!seen.has(f.category)) {
      seen.add(f.category);
      categories.push(f.category);
    }
    return categories;
  }, []);
};

/**
 * useSegmentDialog Hook
 * State management and API calls for the SegmentDialog component.
 */
export const useSegmentDialog = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const clearError = useCallback(() => setError(null), []);

  /**
   * Save (create) a new segment
   */
  const saveSegment = useCallback(async (formData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await createSegment(formData);
      return result;
    } catch (err) {
      const msg = err.message || 'Failed to create segment';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Update an existing segment
   */
  const editSegment = useCallback(async (uuid, formData) => {
    setLoading(true);
    setError(null);
    try {
      const result = await updateSegment(uuid, formData);
      return result;
    } catch (err) {
      const msg = err.message || 'Failed to update segment';
      setError(msg);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reset hook state
   */
  const reset = useCallback(() => {
    setLoading(false);
    setError(null);
  }, []);

  return {
    loading,
    error,
    clearError,
    saveSegment,
    editSegment,
    reset
  };
};

export default useSegmentDialog;
