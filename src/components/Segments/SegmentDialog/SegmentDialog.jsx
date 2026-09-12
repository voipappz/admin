import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Link
} from '@mui/material';
import {
  FilterList as SegmentIcon,
  Close as CloseIcon,
  AutoAwesome as AutoIcon
} from '@mui/icons-material';
import {
  useSegmentDialog,
  SEGMENT_FIELDS,
  SEGMENT_TEMPLATES,
  getOperatorsForField,
  getDefaultOperatorForField,
  generateAutoName,
  isMultiValueOperator,
  isRangeOperator
} from './SegmentDialog.js';
import { Z, menuProps } from '../../../utils/zIndex.js';

// Week day labels for time.weekday (0 = Sunday)
const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
];

// Month labels for time.month
const MONTH_OPTIONS = [
  { value: '1', label: 'Jan' }, { value: '2', label: 'Feb' },
  { value: '3', label: 'Mar' }, { value: '4', label: 'Apr' },
  { value: '5', label: 'May' }, { value: '6', label: 'Jun' },
  { value: '7', label: 'Jul' }, { value: '8', label: 'Aug' },
  { value: '9', label: 'Sep' }, { value: '10', label: 'Oct' },
  { value: '11', label: 'Nov' }, { value: '12', label: 'Dec' }
];

// SegmentDialog is a leaf dialog (L3 in the nesting hierarchy).
const MENU_PROPS = menuProps(Z.L3);

/**
 * SegmentDialog — simplified time / caller-id rule editor.
 *
 * Props:
 * - open, onClose, onSave, segment, mode = 'create' | 'edit'
 * - segmentType: optional API type tag
 */
export const SegmentDialog = ({
  open,
  onClose,
  onSave,
  segment = null,
  mode = 'create',
  segmentType = ''
}) => {
  const { loading, error, clearError, saveSegment, editSegment, reset } = useSegmentDialog();

  const [field, setField] = useState('');
  const [operator, setOperator] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [notes, setNotes] = useState('');
  const [showNotes, setShowNotes] = useState(false);

  // Value state — different shapes per operator
  const [singleValue, setSingleValue] = useState('');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [multiValues, setMultiValues] = useState([]);

  const [formErrors, setFormErrors] = useState({});

  // -------------------------------------------------------------------------
  // Initialize on open
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!open) return;

    if (mode === 'edit' && segment) {
      setField(segment.field || '');
      setOperator(segment.operator || '');
      setName(segment.name || '');
      setNameTouched(true); // don't overwrite user's existing name
      setNotes(segment.notes || '');
      setShowNotes(!!segment.notes);

      const vals = segment.value || segment.val || [];
      const valArr = Array.isArray(vals) ? vals : [vals];
      if (segment.operator === 'BETWEEN' && valArr.length >= 2) {
        setRangeFrom(String(valArr[0] ?? ''));
        setRangeTo(String(valArr[1] ?? ''));
        setSingleValue('');
        setMultiValues([]);
      } else if (isToggleField(segment.field) && isMultiValueOperator(segment.operator)) {
        setMultiValues(valArr.map(String));
        setSingleValue('');
        setRangeFrom('');
        setRangeTo('');
      } else if (isMultiValueOperator(segment.operator)) {
        setSingleValue(valArr.join(', '));
        setMultiValues([]);
        setRangeFrom('');
        setRangeTo('');
      } else {
        setSingleValue(String(valArr[0] ?? ''));
        setMultiValues([]);
        setRangeFrom('');
        setRangeTo('');
      }
    } else {
      // Create mode — clean slate
      setField('');
      setOperator('');
      setName('');
      setNameTouched(false);
      setNotes('');
      setShowNotes(false);
      setSingleValue('');
      setRangeFrom('');
      setRangeTo('');
      setMultiValues([]);
    }
    setFormErrors({});
  }, [open, mode, segment]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      reset();
      setFormErrors({});
    }
  }, [open, reset]);

  // -------------------------------------------------------------------------
  // Build the value array (for API + auto-name)
  // -------------------------------------------------------------------------
  const valueArray = useMemo(() => {
    if (isRangeOperator(operator)) {
      return [rangeFrom.trim(), rangeTo.trim()].filter(Boolean);
    }
    if (isToggleField(field) && isMultiValueOperator(operator)) {
      return multiValues;
    }
    if (isMultiValueOperator(operator)) {
      return singleValue.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [singleValue.trim()].filter(Boolean);
  }, [operator, field, rangeFrom, rangeTo, multiValues, singleValue]);

  // -------------------------------------------------------------------------
  // Auto-generate name (unless user has typed one manually)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (nameTouched) return;
    const auto = generateAutoName(field, operator, valueArray);
    if (auto) setName(auto);
  }, [field, operator, valueArray, nameTouched]);

  // -------------------------------------------------------------------------
  // Field / operator handlers
  // -------------------------------------------------------------------------
  const handleFieldChange = (newField) => {
    setField(newField);
    // Auto-pick the most natural operator for this field
    const defaultOp = getDefaultOperatorForField(newField);
    setOperator(defaultOp);
    setSingleValue('');
    setRangeFrom('');
    setRangeTo('');
    setMultiValues([]);
    if (formErrors.field) setFormErrors(prev => ({ ...prev, field: null }));
  };

  const handleOperatorChange = (newOp) => {
    setOperator(newOp);
    setSingleValue('');
    setRangeFrom('');
    setRangeTo('');
    setMultiValues([]);
    if (formErrors.operator) setFormErrors(prev => ({ ...prev, operator: null }));
  };

  // Apply a quick template (one click → fully filled segment)
  const applyTemplate = (tpl) => {
    setField(tpl.field);
    setOperator(tpl.operator);
    setName(tpl.name);
    setNameTouched(false); // let auto-name keep updating if user tweaks values
    if (tpl.operator === 'BETWEEN') {
      setRangeFrom(tpl.value[0]);
      setRangeTo(tpl.value[1]);
      setMultiValues([]);
      setSingleValue('');
    } else if (isToggleField(tpl.field) && isMultiValueOperator(tpl.operator)) {
      setMultiValues(tpl.value);
      setRangeFrom('');
      setRangeTo('');
      setSingleValue('');
    } else {
      setSingleValue(tpl.value.join(', '));
      setMultiValues([]);
      setRangeFrom('');
      setRangeTo('');
    }
    setFormErrors({});
  };

  // -------------------------------------------------------------------------
  // Validate + submit
  // -------------------------------------------------------------------------
  const validateForm = () => {
    const errors = {};
    if (!field) errors.field = 'Choose what to match';
    if (!operator) errors.operator = 'Choose how to match';
    if (valueArray.length === 0) errors.value = 'Enter at least one value';
    if (isRangeOperator(operator) && valueArray.length !== 2) {
      errors.value = 'Enter both From and To values';
    }
    if (!name?.trim()) errors.name = 'Name is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;
    try {
      const payload = {
        name: name.trim(),
        field,
        operator,
        value: valueArray,
        notes: notes || ''
      };
      if (segmentType) payload.type = segmentType;

      const result = mode === 'edit' && segment?.uuid
        ? await editSegment(segment.uuid, payload)
        : await saveSegment(payload);
      onSave(result);
      onClose();
    } catch {
      // hook surfaces the error
    }
  };

  const fieldDef = SEGMENT_FIELDS.find(f => f.key === field);
  const availableOperators = getOperatorsForField(field);
  const isFormValid = field && operator && valueArray.length > 0 && name.trim();

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      sx={{ zIndex: Z.L3.DIALOG }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SegmentIcon color="primary" />
            <Typography variant="h6">
              {mode === 'edit' ? 'Edit Rule' : 'Create Rule'}
            </Typography>
          </Box>
          <Button onClick={onClose} size="small" sx={{ minWidth: 'auto' }}>
            <CloseIcon />
          </Button>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          Match calls by time of day or caller phone number.
        </Typography>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, mt: 1 }}>

          {/* Quick templates — only in create mode */}
          {mode === 'create' && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
                <AutoIcon sx={{ fontSize: 14 }} />
                Quick presets — click to fill in one tap
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                {SEGMENT_TEMPLATES.map(tpl => (
                  <Chip
                    key={tpl.id}
                    label={tpl.label}
                    onClick={() => applyTemplate(tpl)}
                    variant="outlined"
                    color="primary"
                    size="small"
                    sx={{ cursor: 'pointer' }}
                  />
                ))}
              </Box>
            </Box>
          )}

          {mode === 'create' && <Divider>or build manually</Divider>}

          {/* Field — what to match */}
          <FormControl fullWidth required error={!!formErrors.field} disabled={loading}>
            <InputLabel>What to match</InputLabel>
            <Select
              value={field}
              onChange={(e) => handleFieldChange(e.target.value)}
              label="What to match"
              MenuProps={MENU_PROPS}
            >
              <MenuItem value="time.weekday">Day of Week</MenuItem>
              <MenuItem value="time.hour">Hour of Day</MenuItem>
              <MenuItem value="time.monthday">Day of Month</MenuItem>
              <MenuItem value="time.month">Month</MenuItem>
              <MenuItem value="call.caller">Caller ID</MenuItem>
            </Select>
            {fieldDef?.hint && !formErrors.field && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.5 }}>
                {fieldDef.hint}
              </Typography>
            )}
            {formErrors.field && (
              <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.5 }}>
                {formErrors.field}
              </Typography>
            )}
          </FormControl>

          {/* Operator — only show if field selected and there's a real choice */}
          {field && availableOperators.length > 1 && (
            <FormControl fullWidth required error={!!formErrors.operator} disabled={loading}>
              <InputLabel>How to match</InputLabel>
              <Select
                value={operator}
                onChange={(e) => handleOperatorChange(e.target.value)}
                label="How to match"
                MenuProps={MENU_PROPS}
              >
                {availableOperators.map(op => (
                  <MenuItem key={op.key} value={op.key}>{op.label}</MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Value input — adapts to field + operator */}
          {field && operator && (
            <ValueInput
              field={field}
              operator={operator}
              singleValue={singleValue}
              onSingleValueChange={(v) => { setSingleValue(v); if (formErrors.value) setFormErrors(p => ({ ...p, value: null })); }}
              rangeFrom={rangeFrom}
              rangeTo={rangeTo}
              onRangeFromChange={(v) => { setRangeFrom(v); if (formErrors.value) setFormErrors(p => ({ ...p, value: null })); }}
              onRangeToChange={(v) => { setRangeTo(v); if (formErrors.value) setFormErrors(p => ({ ...p, value: null })); }}
              multiValues={multiValues}
              onMultiValuesChange={(v) => { setMultiValues(v); if (formErrors.value) setFormErrors(p => ({ ...p, value: null })); }}
              error={formErrors.value}
              disabled={loading}
            />
          )}

          {/* Name — auto-generated, editable */}
          {field && operator && (
            <TextField
              label="Name"
              value={name}
              onChange={(e) => { setName(e.target.value); setNameTouched(true); if (formErrors.name) setFormErrors(p => ({ ...p, name: null })); }}
              required
              fullWidth
              size="small"
              error={!!formErrors.name}
              helperText={formErrors.name || (nameTouched ? '' : 'Auto-generated — edit if you like')}
              disabled={loading}
              slotProps={{
                input: !nameTouched && name ? {
                  endAdornment: <AutoIcon fontSize="small" sx={{ color: 'text.secondary' }} />
                } : undefined
              }}
            />
          )}

          {/* Notes — collapsed by default */}
          {field && operator && (
            showNotes ? (
              <TextField
                label="Notes (optional)"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                fullWidth
                multiline
                rows={2}
                size="small"
                placeholder="Optional description"
                disabled={loading}
              />
            ) : (
              <Link
                component="button"
                variant="caption"
                onClick={() => setShowNotes(true)}
                sx={{ alignSelf: 'flex-start', textDecoration: 'none' }}
              >
                + Add notes
              </Link>
            )
          )}

          {error && (
            <Alert severity="error" onClose={clearError}>{error}</Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!isFormValid || loading}
          startIcon={loading ? <CircularProgress size={20} /> : <SegmentIcon />}
        >
          {loading
            ? (mode === 'edit' ? 'Updating...' : 'Creating...')
            : (mode === 'edit' ? 'Update Rule' : 'Create Rule')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

// ---------------------------------------------------------------------------
// Helper: which fields use chip-based multi-select
// ---------------------------------------------------------------------------
function isToggleField(field) {
  return ['time.weekday', 'time.month', 'time.monthday'].includes(field);
}

// ---------------------------------------------------------------------------
// ValueInput — renders the appropriate value editor for field + operator
// ---------------------------------------------------------------------------
function ValueInput({
  field, operator,
  singleValue, onSingleValueChange,
  rangeFrom, rangeTo, onRangeFromChange, onRangeToChange,
  multiValues, onMultiValuesChange,
  error, disabled
}) {
  // BETWEEN → two number inputs (only used by time.hour)
  if (isRangeOperator(operator)) {
    return (
      <Box>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
          Hour range (24-hour format):
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          <TextField
            label="From"
            value={rangeFrom}
            onChange={(e) => onRangeFromChange(e.target.value)}
            size="small"
            fullWidth
            disabled={disabled}
            error={!!error}
            type="number"
            placeholder="9"
            slotProps={{ htmlInput: { min: 0, max: 23 } }}
          />
          <Typography variant="body2" color="text.secondary">to</Typography>
          <TextField
            label="To"
            value={rangeTo}
            onChange={(e) => onRangeToChange(e.target.value)}
            size="small"
            fullWidth
            disabled={disabled}
            error={!!error}
            type="number"
            placeholder="17"
            slotProps={{ htmlInput: { min: 0, max: 23 } }}
          />
        </Box>
        {error && <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>{error}</Typography>}
      </Box>
    );
  }

  // Toggle-based multi-select for weekday / month / monthday
  if (isToggleField(field) && isMultiValueOperator(operator)) {
    return (
      <ToggleValueSelector
        field={field}
        selectedValues={multiValues}
        onChange={onMultiValuesChange}
        operator={operator}
        error={error}
        disabled={disabled}
      />
    );
  }

  // Hour with IS → single number
  if (field === 'time.hour') {
    return (
      <TextField
        label="Hour (0–23)"
        value={singleValue}
        onChange={(e) => onSingleValueChange(e.target.value)}
        fullWidth
        size="small"
        type="number"
        disabled={disabled}
        error={!!error}
        helperText={error}
        placeholder="9"
        slotProps={{ htmlInput: { min: 0, max: 23 } }}
      />
    );
  }

  // Caller ID → single field, multi-comma-separated for IN/NOT_IN
  if (field === 'call.caller') {
    if (isMultiValueOperator(operator)) {
      return (
        <Box>
          <TextField
            label="Phone numbers (comma-separated)"
            value={singleValue}
            onChange={(e) => onSingleValueChange(e.target.value)}
            fullWidth
            size="small"
            disabled={disabled}
            error={!!error}
            helperText={error || 'Example: +15551234, +15555678'}
            placeholder="+15551234, +15555678"
          />
          {singleValue && (
            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 1 }}>
              {singleValue.split(',').map(v => v.trim()).filter(Boolean).map((v, i) => (
                <Chip key={i} label={v} size="small" variant="outlined" />
              ))}
            </Box>
          )}
        </Box>
      );
    }

    const helperByOp = {
      IS:       'Example: +15551234',
      PREFIX:   'Matches numbers starting with this prefix. Example: +1555',
      CONTAINS: 'Matches numbers containing this substring. Example: 555',
    };
    return (
      <TextField
        label="Phone number"
        value={singleValue}
        onChange={(e) => onSingleValueChange(e.target.value)}
        fullWidth
        size="small"
        disabled={disabled}
        error={!!error}
        helperText={error || helperByOp[operator] || ''}
        placeholder="+15551234"
      />
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// ToggleValueSelector — chip-style multi-select for weekday / month / monthday
// ---------------------------------------------------------------------------
function ToggleValueSelector({ field, selectedValues, onChange, operator, error, disabled }) {
  let options;
  let label;

  if (field === 'time.weekday') {
    options = WEEKDAY_OPTIONS;
    label = operator === 'NOT_IN' ? 'Pick days to EXCLUDE:' : 'Pick days:';
  } else if (field === 'time.month') {
    options = MONTH_OPTIONS;
    label = operator === 'NOT_IN' ? 'Pick months to EXCLUDE:' : 'Pick months:';
  } else if (field === 'time.monthday') {
    options = Array.from({ length: 31 }, (_, i) => ({
      value: (i + 1).toString(),
      label: (i + 1).toString()
    }));
    label = operator === 'NOT_IN' ? 'Pick days of month to EXCLUDE:' : 'Pick days of month:';
  } else {
    return null;
  }

  const toggleValue = (val) => {
    const next = selectedValues.includes(val)
      ? selectedValues.filter(v => v !== val)
      : [...selectedValues, val].sort((a, b) => parseInt(a) - parseInt(b));
    onChange(next);
  };

  return (
    <Box>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {label}
      </Typography>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
        {options.map(opt => {
          const selected = selectedValues.includes(opt.value);
          return (
            <Chip
              key={opt.value}
              label={opt.label}
              onClick={() => !disabled && toggleValue(opt.value)}
              color={selected ? 'primary' : 'default'}
              variant={selected ? 'filled' : 'outlined'}
              disabled={disabled}
              sx={{
                cursor: disabled ? 'default' : 'pointer',
                minWidth: field === 'time.monthday' ? 36 : undefined
              }}
            />
          );
        })}
      </Box>
      {error && <Typography variant="caption" color="error" sx={{ mt: 0.5 }}>{error}</Typography>}
    </Box>
  );
}

export default SegmentDialog;
