import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem,
  Switch, FormControlLabel, Button, Stepper, Step, StepLabel, StepButton,
  Tooltip, IconButton, Alert, CircularProgress,
  Card, CardActionArea,
} from '@mui/material';
import HubIcon from '@mui/icons-material/Hub';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import DynamicProfileEditor from '../../common/DynamicProfileEditor/DynamicProfileEditor';

const STEPS = ['Type', 'Details', 'Configuration', 'Review'];

// Types where a tariff is meaningful — a rate table only applies to something
// that carries billable traffic.
const TARIFF_TYPES = ['sip', 'did'];

const STEP_HELP = {
  0: { title: 'Pick a provider type', body: 'The type decides what the provider does and which fields you’ll configure next. It comes from the server and can’t be changed after creation.' },
  1: { title: 'Name your provider', body: 'Give it a clear, unique name. A tariff is only offered for types that carry billable traffic (SIP, DID). Notes are optional.' },
  2: { title: 'Type-specific settings', body: 'These fields come from the server for the chosen type — an SMTP provider needs a host and credentials, an LLM provider needs an API key. Secrets are encrypted at rest and come back masked; reveal is only available after the provider exists.' },
  3: { title: 'Review & create', body: 'Check everything below. Click any “Edit” to jump back. Create sends it to the server, which validates it one more time.' },
};

const emptyForm = { name: '', type: '', enabled: true, notes: '', tariff_uuid: '', profile: {} };

/**
 * ProviderWizard — step-by-step, validated provider creation, the same shape as
 * ServiceWizard: type cards → details → server-driven fields → review, with a
 * per-step help panel and a review that can jump back.
 *
 * The type step reads the catalog `label` and `description` that
 * providersApi.getProviderTypes now normalizes out of `?action=catalog`, so the
 * cards describe themselves instead of showing a bare upcased key. The
 * Configuration step reuses DynamicProfileEditor with type="provider" — the same
 * component and the same profile.yml-driven fields the quick dialog uses, so
 * there is one definition of a provider's fields, not two.
 */
const ProviderWizard = ({
  open, onClose, onSave, loading,
  providerTypes = [], allTariffs = [], canWrite = true,
}) => {
  const [active, setActive] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');

  useEffect(() => {
    if (open) { setActive(0); setForm(emptyForm); setErrors({}); setApiError(''); }
  }, [open]);

  const set = (field, value) => {
    setForm((p) => ({ ...p, [field]: value }));
    if (errors[field]) setErrors((p) => ({ ...p, [field]: null }));
  };

  // Tolerate a bare string as well as the normalized { value, label, … }, the
  // same way the shared ProviderDialog does.
  const types = useMemo(
    () => (providerTypes || []).map((t) => (
      typeof t === 'string'
        ? { value: t, label: t.toUpperCase(), description: '' }
        : { value: t.value, label: t.label || t.value, description: t.description || '' }
    )),
    [providerTypes]
  );

  const selectedType = types.find((t) => t.value === form.type);
  const showsTariff = TARIFF_TYPES.includes(form.type);

  const validateStep = (step) => {
    const e = {};
    if (step === 0 && !form.type) e.type = 'Choose a provider type';
    if (step === 1 && !form.name.trim()) e.name = 'Provider name is required';
    return e;
  };

  const stepValid = useMemo(() => Object.keys(validateStep(active)).length === 0, [active, form]);

  const goNext = () => {
    const e = validateStep(active);
    setErrors(e);
    if (Object.keys(e).length === 0) setActive((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setActive((s) => Math.max(s - 1, 0));
  const goTo = (step) => { if (step < active) setActive(step); };

  const buildPayload = () => {
    const payload = {
      name: form.name.trim(),
      type: form.type,
      enabled: form.enabled,
      notes: form.notes,
      profile: form.profile || {},
    };
    // Only send a tariff for a type that uses one, and only when chosen.
    if (showsTariff && form.tariff_uuid) payload.tariff_uuid = form.tariff_uuid;
    return payload;
  };

  const handleCreate = async () => {
    const all = { ...validateStep(0), ...validateStep(1) };
    if (Object.keys(all).length) {
      setErrors(all);
      setActive(all.type ? 0 : 1);
      return;
    }
    setApiError('');
    try {
      await onSave(buildPayload());
    } catch (err) {
      setApiError(err?.message || 'Failed to create provider');
    }
  };

  const help = STEP_HELP[active];

  const Row = ({ label, value, step }) => (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.5, borderBottom: '1px solid var(--theme-border)' }}>
      <Typography variant="caption" sx={{ minWidth: 110, color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
      <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-word' }}>{value || '—'}</Typography>
      <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setActive(step)}>Edit</Button>
    </Box>
  );

  // What the user actually filled in, secrets never echoed back.
  const configuredKeys = Object.entries(form.profile || {})
    .filter(([, v]) => v !== '' && v != null)
    .map(([k]) => k);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: '88vh', display: 'flex', flexDirection: 'column' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <HubIcon color="primary" />
        <Typography variant="h6" sx={{ flex: 1 }}>New Provider</Typography>
        <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </DialogTitle>

      <Box sx={{ px: 3, pt: 1 }}>
        <Stepper activeStep={active} alternativeLabel>
          {STEPS.map((label, i) => (
            <Step key={label} completed={i < active}>
              <StepButton onClick={() => goTo(i)} disabled={i > active}>
                <StepLabel>{label}</StepLabel>
              </StepButton>
            </Step>
          ))}
        </Stepper>
      </Box>

      <DialogContent dividers sx={{ display: 'flex', gap: 2, flex: 1, overflow: 'hidden' }}>
        <Box sx={{ flex: 1, overflow: 'auto', pr: 1 }}>
          {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}

          {active === 0 && (
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5 }}>
              {types.length === 0 && (
                <Alert severity="warning" sx={{ gridColumn: '1 / -1' }}>
                  No provider types came back from the server.
                </Alert>
              )}
              {types.map((t) => (
                <Card key={t.value} variant="outlined"
                  sx={{ borderColor: form.type === t.value ? 'primary.main' : 'var(--theme-border)', borderWidth: form.type === t.value ? 2 : 1 }}>
                  <CardActionArea onClick={() => set('type', t.value)} sx={{ p: 1.5, height: '100%' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>{t.label}</Typography>
                      {form.type === t.value && <CheckCircleIcon color="primary" sx={{ fontSize: 18 }} />}
                    </Box>
                    {t.description && <Typography variant="caption" color="text.secondary">{t.description}</Typography>}
                  </CardActionArea>
                </Card>
              ))}
              {errors.type && <Typography color="error" variant="caption">{errors.type}</Typography>}
            </Box>
          )}

          {active === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <FormControlLabel
                control={<Switch checked={form.enabled} onChange={(e) => set('enabled', e.target.checked)} />}
                label="Enabled" />
              <TextField label="Provider Name" value={form.name} onChange={(e) => set('name', e.target.value)}
                error={!!errors.name} helperText={errors.name} required fullWidth autoFocus />
              {showsTariff && (
                <FormControl fullWidth>
                  <InputLabel>Tariff</InputLabel>
                  <Select value={form.tariff_uuid || ''} label="Tariff"
                    onChange={(e) => set('tariff_uuid', e.target.value)}>
                    <MenuItem value=""><em>None</em></MenuItem>
                    {(allTariffs || []).map((t) => (
                      <MenuItem key={t.uuid} value={t.uuid}>{t.name}</MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
              <TextField label="Notes" value={form.notes} onChange={(e) => set('notes', e.target.value)}
                multiline rows={2} fullWidth />
            </Box>
          )}

          {active === 2 && (
            form.type ? (
              // type="provider": every provider field lives under profile.yml's
              // `provider` key, sectioned per sub-type — the same source the quick
              // dialog reads. No `onReveal`: there is nothing to reveal until the
              // provider exists.
              <DynamicProfileEditor
                type="provider"
                profile={form.profile}
                onChange={(profile) => set('profile', profile)}
                disabled={loading}
                title={`${selectedType?.label || form.type} Configuration`} />
            ) : <Alert severity="info">Pick a type first.</Alert>
          )}

          {active === 3 && (
            <Box>
              <Row label="Type" value={selectedType?.label || form.type} step={0} />
              <Row label="Name" value={form.name} step={1} />
              <Row label="Enabled" value={form.enabled ? 'Yes' : 'No'} step={1} />
              {showsTariff && (
                <Row label="Tariff"
                  value={(allTariffs || []).find((t) => t.uuid === form.tariff_uuid)?.name || 'None'}
                  step={1} />
              )}
              <Row label="Configured"
                value={configuredKeys.length ? configuredKeys.join(', ') : 'Nothing set'}
                step={2} />
              <Row label="Notes" value={form.notes} step={1} />
            </Box>
          )}
        </Box>

        <Box sx={{ width: 220, flexShrink: 0, p: 1.5, borderRadius: '8px', bgcolor: 'var(--theme-bg-secondary)', alignSelf: 'flex-start' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
            <HelpOutlineIcon sx={{ fontSize: 16, color: 'var(--accent-primary)' }} />
            <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>{help.title}</Typography>
          </Box>
          <Typography variant="caption" color="text.secondary">{help.body}</Typography>
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3 }}>
        <Button onClick={onClose} disabled={loading}>Cancel</Button>
        <Box sx={{ flex: 1 }} />
        <Button onClick={goBack} disabled={active === 0 || loading}>Back</Button>
        {active < STEPS.length - 1 ? (
          <Tooltip title={stepValid ? '' : 'Complete this step to continue'}>
            <span>
              <Button variant="contained" onClick={goNext} disabled={!stepValid || loading}>Next</Button>
            </span>
          </Tooltip>
        ) : (
          <Button variant="contained" color="success" onClick={handleCreate} disabled={!canWrite || loading}
            startIcon={loading ? <CircularProgress size={18} /> : null}>
            Create Provider
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default ProviderWizard;
