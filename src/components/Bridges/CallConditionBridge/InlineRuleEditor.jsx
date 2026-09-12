import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Box,
  TextField,
  Typography,
  Chip,
  Stack,
  Link,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  ToggleButtonGroup,
  ToggleButton,
  Alert
} from '@mui/material';
import { AccessTime as TimeIcon, CalendarMonth as CalendarIcon, Phone as PhoneIcon } from '@mui/icons-material';
import {
  getSegment,
  createSegment,
  updateSegment,
  deleteSegment
} from '../../../services/api/segmentsApi.js';
import { generateAutoName } from '../../Segments/SegmentDialog/SegmentDialog.js';
import { Z, menuProps } from '../../../utils/zIndex.js';

// Mon-first ordering, but '0' = Sunday in the API
const WEEKDAY_OPTIONS = [
  { value: '1', label: 'Mon' },
  { value: '2', label: 'Tue' },
  { value: '3', label: 'Wed' },
  { value: '4', label: 'Thu' },
  { value: '5', label: 'Fri' },
  { value: '6', label: 'Sat' },
  { value: '0', label: 'Sun' },
];

const DEBOUNCE_MS = 600;

/**
 * InlineRuleEditor
 *
 * SINGLE-rule editor for a call condition resource. The user picks ONE
 * rule type (days / hours / caller) and configures it. We silently
 * create / update / delete a single segment behind the scenes and hand
 * the parent ONE segment_uuid (string, not array).
 *
 * The user never sees the word "segment". Same UX pattern as the
 * number bridge: user types a value, we hand back a uuid.
 *
 * Switching rule type deletes the previous segment and creates a new
 * one when the new type is configured.
 */
export const InlineRuleEditor = ({
  segmentUuid = '',
  onSegmentUuidChange,
  disabled = false
}) => {
  // 'none' = always matches, 'days'/'hours'/'caller' = active rule, 'custom' = unknown segment we loaded
  const [ruleType, setRuleType] = useState('none');
  const [loading, setLoading] = useState(false);
  const [hydratedFor, setHydratedFor] = useState(null); // tracks which uuid we've already hydrated

  // Per-rule-type state
  const [days, setDays] = useState([]); // ['1','2',...]
  const [hours, setHours] = useState({ from: '', to: '' });
  const [caller, setCaller] = useState({ operator: 'IS', value: '' });

  // Tracks the uuid we currently own (so we can update / delete it)
  const currentUuidRef = useRef('');

  // Pending save timer
  const timerRef = useRef(null);

  // Latest onChange callback in a ref so persist() can call it without
  // re-creating itself on every render
  const onChangeRef = useRef(onSegmentUuidChange);
  useEffect(() => { onChangeRef.current = onSegmentUuidChange; }, [onSegmentUuidChange]);

  // ---------------------------------------------------------------------------
  // Hydrate from existing segment_uuid
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    // Empty incoming uuid → clear state
    if (!segmentUuid) {
      currentUuidRef.current = '';
      setRuleType('none');
      setDays([]);
      setHours({ from: '', to: '' });
      setCaller({ operator: 'IS', value: '' });
      setHydratedFor(null);
      return;
    }

    // Already hydrated this uuid? skip
    if (segmentUuid === hydratedFor) return;

    const hydrate = async () => {
      setLoading(true);
      try {
        const seg = await getSegment(segmentUuid).catch(() => null);
        if (cancelled) return;

        if (!seg) {
          // Segment was deleted on the server — drop it
          currentUuidRef.current = '';
          onChangeRef.current('');
          setHydratedFor(segmentUuid);
          return;
        }

        currentUuidRef.current = segmentUuid;
        const valArr = Array.isArray(seg.value) ? seg.value : (seg.val || []);

        if (seg.field === 'time.weekday' && (seg.operator === 'IN' || !seg.operator)) {
          setRuleType('days');
          setDays(valArr.map(String));
        } else if (seg.field === 'time.hour' && seg.operator === 'BETWEEN') {
          setRuleType('hours');
          setHours({
            from: String(valArr[0] ?? ''),
            to: String(valArr[1] ?? '')
          });
        } else if (seg.field === 'call.caller') {
          setRuleType('caller');
          setCaller({
            operator: seg.operator || 'IS',
            value: valArr.join(', ')
          });
        } else {
          // Unknown / advanced segment — keep its uuid but show a notice
          setRuleType('custom');
        }

        setHydratedFor(segmentUuid);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    hydrate();
    return () => { cancelled = true; };
  }, [segmentUuid, hydratedFor]);

  // Cleanup pending timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Persist helpers
  // ---------------------------------------------------------------------------

  /**
   * Create / update / delete the single segment for this resource.
   * payloadOrNull === null means "delete the current segment".
   */
  const persistRule = useCallback(async (payloadOrNull) => {
    const currentUuid = currentUuidRef.current;

    try {
      // Empty payload → delete current segment if any
      if (!payloadOrNull) {
        if (currentUuid) {
          try { await deleteSegment(currentUuid); } catch { /* ignore */ }
          currentUuidRef.current = '';
          onChangeRef.current('');
        }
        return;
      }

      const autoName = generateAutoName(payloadOrNull.field, payloadOrNull.operator, payloadOrNull.value)
        || `${payloadOrNull.field} ${payloadOrNull.operator}`;
      const body = { ...payloadOrNull, name: autoName };

      if (currentUuid) {
        await updateSegment(currentUuid, body);
      } else {
        const created = await createSegment(body);
        if (created?.uuid) {
          currentUuidRef.current = created.uuid;
          setHydratedFor(created.uuid); // mark as hydrated so the effect doesn't refetch
          onChangeRef.current(created.uuid);
        }
      }
    } catch (err) {
      console.error('Failed to persist rule:', err);
    }
  }, []);

  const schedulePersist = useCallback((payloadOrNull) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      persistRule(payloadOrNull);
    }, DEBOUNCE_MS);
  }, [persistRule]);

  // Immediately delete the current segment (used when switching rule type)
  const deleteCurrentNow = useCallback(async () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    const currentUuid = currentUuidRef.current;
    if (currentUuid) {
      try { await deleteSegment(currentUuid); } catch { /* ignore */ }
      currentUuidRef.current = '';
      onChangeRef.current('');
    }
  }, []);

  // ---------------------------------------------------------------------------
  // Rule type change
  // ---------------------------------------------------------------------------
  const handleRuleTypeChange = (newType) => {
    if (disabled || !newType || newType === ruleType) return;

    // Clear local state for the new type
    setDays([]);
    setHours({ from: '', to: '' });
    setCaller({ operator: 'IS', value: '' });

    // Delete the previous segment immediately (don't wait for debounce)
    deleteCurrentNow();

    setRuleType(newType);
  };

  // ---------------------------------------------------------------------------
  // Days handlers
  // ---------------------------------------------------------------------------
  const toggleDay = (val) => {
    if (disabled) return;
    const next = days.includes(val)
      ? days.filter(v => v !== val)
      : [...days, val].sort((a, b) => parseInt(a) - parseInt(b));
    setDays(next);

    if (next.length === 0) {
      schedulePersist(null);
    } else {
      schedulePersist({
        field: 'time.weekday',
        operator: 'IN',
        value: next
      });
    }
  };

  const selectAllDays = () => {
    if (disabled) return;
    const all = ['1', '2', '3', '4', '5'];
    setDays(all);
    schedulePersist({ field: 'time.weekday', operator: 'IN', value: all });
  };

  const clearDays = () => {
    if (disabled) return;
    setDays([]);
    schedulePersist(null);
  };

  // ---------------------------------------------------------------------------
  // Hours handlers
  // ---------------------------------------------------------------------------
  const updateHours = (next) => {
    const merged = { ...hours, ...next };
    setHours(merged);

    if (merged.from === '' && merged.to === '') {
      schedulePersist(null);
    } else if (merged.from !== '' && merged.to !== '') {
      schedulePersist({
        field: 'time.hour',
        operator: 'BETWEEN',
        value: [String(merged.from), String(merged.to)]
      });
    }
    // If only one of from/to is filled, wait for the other
  };

  // ---------------------------------------------------------------------------
  // Caller handlers
  // ---------------------------------------------------------------------------
  const updateCaller = (next) => {
    const merged = { ...caller, ...next };
    setCaller(merged);

    if (!merged.value.trim()) {
      schedulePersist(null);
      return;
    }
    const isMulti = merged.operator === 'IN' || merged.operator === 'NOT_IN';
    const value = isMulti
      ? merged.value.split(',').map(v => v.trim()).filter(Boolean)
      : [merged.value.trim()];
    schedulePersist({
      field: 'call.caller',
      operator: merged.operator,
      value
    });
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Box>
        <Typography variant="subtitle2" fontWeight={600}>
          When should this rule apply?
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Pick one rule type. Choose &quot;Always&quot; to match anytime.
        </Typography>
      </Box>

      {/* Rule type picker */}
      <ToggleButtonGroup
        value={ruleType}
        exclusive
        onChange={(_, val) => handleRuleTypeChange(val)}
        size="small"
        disabled={disabled}
        sx={{ flexWrap: 'wrap' }}
      >
        <ToggleButton value="none">Always</ToggleButton>
        <ToggleButton value="days">
          <CalendarIcon sx={{ fontSize: 16, mr: 0.5 }} />
          Days
        </ToggleButton>
        <ToggleButton value="hours">
          <TimeIcon sx={{ fontSize: 16, mr: 0.5 }} />
          Hours
        </ToggleButton>
        <ToggleButton value="caller">
          <PhoneIcon sx={{ fontSize: 16, mr: 0.5 }} />
          Caller ID
        </ToggleButton>
      </ToggleButtonGroup>

      {loading && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CircularProgress size={16} />
          <Typography variant="caption" color="text.secondary">Loading rule…</Typography>
        </Box>
      )}

      {/* ---------- None ---------- */}
      {ruleType === 'none' && !loading && (
        <Typography variant="caption" color="text.disabled">
          This resource matches every call.
        </Typography>
      )}

      {/* ---------- Custom (unknown segment we loaded) ---------- */}
      {ruleType === 'custom' && !loading && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          This resource uses an advanced rule. Pick another type above to replace it.
        </Alert>
      )}

      {/* ---------- Days of week ---------- */}
      {ruleType === 'days' && (
        <Box>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Typography variant="caption" color="text.secondary" fontWeight={600}>
              SELECT DAYS
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Link
                component="button"
                variant="caption"
                onClick={selectAllDays}
                disabled={disabled}
                sx={{ textDecoration: 'none' }}
              >
                Mon–Fri
              </Link>
              {days.length > 0 && (
                <Link
                  component="button"
                  variant="caption"
                  onClick={clearDays}
                  disabled={disabled}
                  sx={{ textDecoration: 'none', color: 'text.secondary' }}
                >
                  Clear
                </Link>
              )}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {WEEKDAY_OPTIONS.map(opt => {
              const selected = days.includes(opt.value);
              return (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  onClick={() => toggleDay(opt.value)}
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  disabled={disabled}
                  size="small"
                  sx={{ cursor: disabled ? 'default' : 'pointer', minWidth: 48 }}
                />
              );
            })}
          </Box>
          {days.length === 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ mt: 0.5, display: 'block' }}>
              Pick at least one day
            </Typography>
          )}
        </Box>
      )}

      {/* ---------- Hours of day ---------- */}
      {ruleType === 'hours' && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
            HOUR RANGE
          </Typography>
          <Stack direction="row" spacing={1.5} alignItems="center">
            <TextField
              label="From"
              type="number"
              size="small"
              value={hours.from}
              onChange={(e) => updateHours({ from: e.target.value })}
              disabled={disabled}
              placeholder="9"
              sx={{ width: 100 }}
              slotProps={{ htmlInput: { min: 0, max: 23 } }}
            />
            <Typography variant="body2" color="text.secondary">to</Typography>
            <TextField
              label="To"
              type="number"
              size="small"
              value={hours.to}
              onChange={(e) => updateHours({ to: e.target.value })}
              disabled={disabled}
              placeholder="17"
              sx={{ width: 100 }}
              slotProps={{ htmlInput: { min: 0, max: 23 } }}
            />
            <Typography variant="caption" color="text.disabled">
              (24-hour format)
            </Typography>
          </Stack>
        </Box>
      )}

      {/* ---------- Caller ID ---------- */}
      {ruleType === 'caller' && (
        <Box>
          <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
            CALLER PHONE NUMBER
          </Typography>
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <FormControl size="small" sx={{ minWidth: 140 }} disabled={disabled}>
              <InputLabel>Match</InputLabel>
              <Select
                value={caller.operator}
                label="Match"
                onChange={(e) => updateCaller({ operator: e.target.value })}
                MenuProps={menuProps(Z.L2)}
              >
                <MenuItem value="IS">equals</MenuItem>
                <MenuItem value="PREFIX">starts with</MenuItem>
                <MenuItem value="CONTAINS">contains</MenuItem>
                <MenuItem value="IN">is one of</MenuItem>
                <MenuItem value="NOT_IN">is not one of</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Phone number"
              size="small"
              fullWidth
              value={caller.value}
              onChange={(e) => updateCaller({ value: e.target.value })}
              disabled={disabled}
              placeholder={caller.operator === 'IN' || caller.operator === 'NOT_IN' ? '+15551234, +15555678' : '+15551234'}
              helperText={
                caller.operator === 'PREFIX'   ? 'Matches numbers starting with this prefix' :
                caller.operator === 'CONTAINS' ? 'Matches numbers containing this substring' :
                (caller.operator === 'IN' || caller.operator === 'NOT_IN') ? 'Comma-separated list' : ''
              }
            />
          </Stack>
        </Box>
      )}
    </Box>
  );
};

export default InlineRuleEditor;
