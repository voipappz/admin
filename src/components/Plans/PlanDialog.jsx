import { useState, useEffect } from 'react';
import { plansApi } from '../../services/api/plansApi';
import { tariffsApi } from '../../services/api/tariffsApi';
import TariffSelect from '../common/TariffSelect/TariffSelect';
import { Z } from '../../utils/zIndex';
import {
  Box,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControlLabel,
  Switch,
  CircularProgress,
  MenuItem,
  Select,
  InputLabel,
  FormControl,
  Alert,
  Chip,
  Typography,
  Divider,
} from '@mui/material';
import { parseServerErrors, is406Error } from '../../utils/formValidation';
import { formatDate } from '../../utils/dateUtils';

/**
 * PlanDialog Component
 * Dialog for creating/editing plans
 */
const PlanDialog = ({ open, onClose, onSave, plan, loading }) => {
  const [formData, setFormData] = useState({
    name: '',
    notes: '',
    enabled: true,
    recurring: false,
    meta: '{}', // Storing meta as a JSON string for easy editing
    // API contract: period is the unit (hour/day/week/month/year), interval is the count.
    period: 'month',
    interval: 1,
    // MANDATORY routing strategy: plan.type IS how this plan's calls pick a
    // carrier — 'lcr' (cheapest rate) or 'weight' (carrier order).
    type: 'lcr',
    // Recurring fee — lives in plan.profile[:fee] (thin model, no fee column).
    fee: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [apiError, setApiError] = useState('');
  // Period units sourced from the API service (not hardcoded in the view).
  const [periods, setPeriods] = useState([]);
  // Routing-strategy options ([{val,name}]) — also sourced from the API.
  const [strategies, setStrategies] = useState([]);
  // Tariffs attached to this plan (stored server-side as plan items, val = tariff uuid).
  const [allTariffs, setAllTariffs] = useState([]);
  const [tariffs, setTariffs] = useState([]); // [{ uuid, name }]
  const [tariffToAdd, setTariffToAdd] = useState('');

  // Keyed on `open`, not [] — this ran once when the dialog first mounted, which
  // can be before the account is authenticated or while a different customer is
  // selected. The tariff list came back empty and never refilled, so "+ Add
  // tariff" offered nothing and a plan could not be given the tariff it prices by.
  useEffect(() => {
    if (!open) return;
    plansApi.getPeriods()
      .then((res) => setPeriods(Array.isArray(res) ? res : []))
      .catch(() => setPeriods([]));
    plansApi.getStrategies()
      .then((res) => setStrategies(Array.isArray(res) ? res : []))
      .catch(() => setStrategies([]));
    tariffsApi.getTariffs({ per_page: 9999 })
      .then((res) => setAllTariffs(Array.isArray(res) ? res : []))
      .catch(() => setAllTariffs([]));
  }, [open]);

  // Load the plan's current tariffs (its items) when editing.
  useEffect(() => {
    if (!open) return;
    if (plan?.uuid) {
      plansApi.getItems(plan.uuid)
        .then((items) => {
          const list = (Array.isArray(items) ? items : [])
            .filter((i) => i.val)
            .map((i) => ({ uuid: i.tariff?.uuid || i.val, name: i.tariff?.name || i.name }));
          setTariffs(list);
        })
        .catch(() => setTariffs([]));
    } else {
      setTariffs([]);
    }
    setTariffToAdd('');
  }, [plan, open]);

  useEffect(() => {
    if (plan) {
      setFormData({
        name: plan.name || '',
        notes: plan.notes || '',
        enabled: plan.enabled !== undefined ? plan.enabled : true,
        recurring: plan.recurring !== undefined ? plan.recurring : false,
        meta: plan.meta ? JSON.stringify(plan.meta, null, 2) : '{}',
        period: plan.period || 'month',
        interval: plan.interval || 1,
        type: plan.type || 'lcr',
        fee: (plan.profile && (plan.profile.fee ?? plan.profile['fee'])) ?? '',
      });
    } else {
      setFormData({
        name: '',
        notes: '',
        enabled: true,
        recurring: false,
        meta: '{}',
        period: 'month',
        interval: 1,
        type: 'lcr',
        fee: '',
      });
    }
    setFormErrors({}); // Reset errors when dialog opens or plan changes
    setSubmitAttempted(false);
    setApiError('');
  }, [plan, open]);

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const handleAddTariff = (uuid, tariffObj) => {
    if (!uuid) return;
    if (!tariffs.some((t) => t.uuid === uuid)) {
      const t = tariffObj || allTariffs.find((x) => x.uuid === uuid);
      if (t) setTariffs((prev) => [...prev, { uuid: t.uuid, name: t.name }]);
    }
    setTariffToAdd('');
  };

  const handleRemoveTariff = (uuid) => {
    setTariffs((prev) => prev.filter((t) => t.uuid !== uuid));
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.name.trim()) {
      errors.name = 'Name is required.';
    }
    if (!formData.period) {
      errors.period = 'Period unit is required.';
    }
    if (!(formData.interval > 0)) {
      errors.interval = 'Interval must be a positive number.';
    }
    try {
      JSON.parse(formData.meta);
    } catch {
      errors.meta = 'Meta must be a valid JSON object.';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async () => {
    setSubmitAttempted(true);
    setApiError('');

    if (!validateForm()) {
      return;
    }

    const { fee, ...rest } = formData;
    const dataToSave = {
      ...rest,
      meta: JSON.parse(formData.meta), // Convert meta string back to object
      // The recurring fee lives in the plan profile hstore (thin model).
      profile: { ...(plan?.profile || {}), fee: String(fee ?? '').trim() },
      tariffs, // reconciled into plan items (val = tariff uuid) by usePlans
    };

    try {
      await onSave(dataToSave);
      // The parent (usePlans) will close the dialog on success
    } catch (error) {
      console.error('Save error:', error);
      if (is406Error(error)) {
        const serverErrors = parseServerErrors(error);
        if (Object.keys(serverErrors).length > 0) {
          setFormErrors(prev => ({ ...prev, ...serverErrors }));
        }
      }
      setApiError(error?.response?.data?.message || error?.message || 'Failed to save plan');
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth sx={{ zIndex: Z.L3.DIALOG }}>
      <DialogTitle>{plan ? 'Edit Plan' : 'Create New Plan'}</DialogTitle>
      <DialogContent>
        {apiError && (
          <Alert severity="error" sx={{ mb: 2, mt: 1 }}>
            {apiError}
          </Alert>
        )}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: apiError ? 0 : 1 }}>
          {/* Identity block — uuid + timestamps, read-only, edit mode only */}
          {plan?.uuid && (
            <Box sx={{
              display: 'flex', flexDirection: 'column', gap: 0.25, px: 1.5, py: 1,
              border: '1px solid var(--theme-border)', borderRadius: '6px',
              backgroundColor: 'var(--theme-bg-secondary)',
            }}>
              <Typography sx={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '0.72rem', color: 'var(--theme-text-secondary)', userSelect: 'all' }}>
                {plan.uuid}
              </Typography>
              <Typography sx={{ fontSize: '0.7rem', color: 'var(--theme-text-secondary)' }}>
                Created {formatDate(plan.created_at)} · Updated {formatDate(plan.updated_at)}
              </Typography>
            </Box>
          )}
          <TextField
            label="Plan Name"
            value={formData.name}
            onChange={(e) => handleChange('name', e.target.value)}
            required
            fullWidth
            error={!!formErrors.name || (submitAttempted && !formData.name?.trim())}
            helperText={formErrors.name || (submitAttempted && !formData.name?.trim() ? 'Name is required' : '')}
          />
          <TextField
            label="Notes"
            value={formData.notes}
            onChange={(e) => handleChange('notes', e.target.value)}
            fullWidth
            multiline
            rows={3}
          />
          {/* Billing period = interval × period, e.g. "every 1 month".
              One field per row — the dialog reads top-to-bottom. */}
          <TextField
            label="Interval"
            type="number"
            value={formData.interval}
            onChange={(e) => handleChange('interval', parseInt(e.target.value, 10))}
            required
            fullWidth
            InputProps={{ inputProps: { min: 1 } }}
            error={!!formErrors.interval || (submitAttempted && !(formData.interval > 0))}
            helperText={formErrors.interval || 'count'}
          />
          <FormControl fullWidth required error={!!formErrors.period}>
            <InputLabel>Period</InputLabel>
            <Select
              value={formData.period}
              label="Period"
              onChange={(e) => handleChange('period', e.target.value)}
            >
              {periods.map((p) => (
                <MenuItem key={p} value={p}>
                  {p.charAt(0).toUpperCase() + p.slice(1)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Routing strategy — plan.type, read live by the API per call. */}
          <FormControl fullWidth required>
            <InputLabel>Routing Strategy</InputLabel>
            <Select
              value={formData.type}
              label="Routing Strategy"
              onChange={(e) => handleChange('type', e.target.value)}
            >
              {strategies.map((s) => (
                <MenuItem key={s.val} value={s.val}>{s.name}</MenuItem>
              ))}
            </Select>
          </FormControl>
          {/* Recurring fee — stored in the plan profile (profile[:fee]), billed
              each period on top of usage. */}
          <TextField
            label="Recurring Fee"
            type="number"
            value={formData.fee}
            onChange={(e) => handleChange('fee', e.target.value)}
            fullWidth
            inputProps={{ min: 0, step: '0.01' }}
            helperText="Charged each billing period (in addition to usage). Leave blank for none."
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.enabled}
                onChange={(e) => handleChange('enabled', e.target.checked)}
              />
            }
            label="Enabled"
          />
          <FormControlLabel
            control={
              <Switch
                checked={formData.recurring}
                onChange={(e) => handleChange('recurring', e.target.checked)}
              />
            }
            label="Recurring (auto-renew + bill each period)"
          />
          <TextField
            label="Meta (JSON)"
            value={formData.meta}
            onChange={(e) => handleChange('meta', e.target.value)}
            fullWidth
            multiline
            rows={4}
            variant="outlined"
            placeholder='e.g., { "key": "value" }'
            error={!!formErrors.meta}
            helperText={formErrors.meta}
            sx={{
              '& .MuiOutlinedInput-root': {
                fontFamily: 'monospace',
              },
            }}
          />

          {/* Tariffs — stored server-side as plan items (val = tariff uuid). */}
          <Divider />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Tariffs
            </Typography>
            {tariffs.length > 0 && (
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 1.5 }}>
                {tariffs.map((t) => (
                  <Chip
                    key={t.uuid}
                    label={t.name}
                    onDelete={() => handleRemoveTariff(t.uuid)}
                  />
                ))}
              </Box>
            )}
            <TariffSelect
              value={tariffToAdd}
              onChange={handleAddTariff}
              tariffs={allTariffs}
              label="Add tariff"
              onTariffCreated={(t) => {
                if (t?.uuid) {
                  setAllTariffs((prev) =>
                    prev.some((x) => x.uuid === t.uuid) ? prev : [...prev, t]
                  );
                  handleAddTariff(t.uuid, t);
                }
              }}
            />
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          {plan ? 'Update' : 'Create'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default PlanDialog;
