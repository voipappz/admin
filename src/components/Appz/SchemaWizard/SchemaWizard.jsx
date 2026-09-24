import { useState, useEffect, useMemo } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Box, Typography, TextField, FormControl, InputLabel, Select, MenuItem,
  Switch, FormControlLabel, Button, Stepper, Step, StepLabel, StepButton,
  Chip, Tooltip, IconButton, Alert, CircularProgress,
  Card, CardActionArea,
} from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import CloseIcon from '@mui/icons-material/Close';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import { useCustomerEnvironment } from '../../../context/CustomerEnvironmentContext';
import { apiService } from '../../../services/apiService';
import SecretField from '../../common/SecretField.jsx';

const STEPS = ['Type', 'Application', 'Details', 'Review'];

// Per-step help shown in the right-hand help panel (same pattern as ServiceWizard).
const STEP_HELP = {
  0: { title: 'Pick what to create', body: 'Everything here comes from the server catalog (config/schemas.yaml). The category tabs group related resources — telephony, billing, access, integrations.' },
  1: { title: 'Where does it go?', body: 'Resources are provisioned into an application (environment). Creating an Environment names a new application; anything else targets an existing one.' },
  2: { title: 'Fill in the details', body: 'These fields come from the catalog for the chosen type. Required fields are marked. Use “Add another” to provision several at once (e.g. a batch of devices).' },
  3: { title: 'Review & create', body: 'Check everything below. Click any “Edit” to jump back. Create sends one request — the server provisions everything and logs a SchemaProvisioned event.' },
};

// The catalog `example` encodes the ready-to-POST payload shape for each type:
// its first non-meta key is the section key (extension / did / plans / services /
// vml ...) and its value is either an indexed list or a name-keyed hash.
const payloadTemplate = (schema) => {
  const example = schema?.example || {};
  const key = Object.keys(example).find((k) => !['environment_name', 'profile'].includes(k));
  return key ? { key, shape: example[key] } : { key: null, shape: null };
};

const emptyEntry = (schema) => {
  const entry = {};
  (schema?.fields || []).forEach((f) => {
    entry[f.key] = f.default !== undefined && f.default !== null ? String(f.default) : '';
  });
  return entry;
};

const fieldLabel = (key) => key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// The line-item title for a review manifest entry: whichever identifier the
// entry actually filled in, in order of how a person would recognize it.
const entryTitle = (entry) =>
  entry.username || entry.name || entry.email || entry.number || entry.src ||
  Object.values(entry || {}).find((v) => v) || '';

/**
 * SchemaWizard — step-by-step, catalog-driven provisioning. The catalog
 * (GET /api/schemas?action=catalog, i.e. the API's config/schemas.yaml) is the
 * single source of truth: type cards, form fields, required flags, defaults
 * and the POST payload shape all come from it. Modeled on ServiceWizard.
 */
const SchemaWizard = ({ open, onClose, catalog, onCreated, canWrite = true, initialSchema = null }) => {
  const { environments, selectedCustomer, fetchEnvironments } = useCustomerEnvironment();
  const [active, setActive] = useState(0);
  const [schema, setSchema] = useState(null);          // selected catalog entry
  const [appName, setAppName] = useState('');          // environment name (new or existing)
  const [profile, setProfile] = useState({ domain: '', timezone: '' });
  const [entries, setEntries] = useState([{}]);
  const [meta, setMeta] = useState([]);                // [{key, value}] -> meta[key]=value
  const [errors, setErrors] = useState({});
  const [apiError, setApiError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      // Opened from a gallery square -> pre-select that type and skip straight
      // to the Application step; opened bare -> start on the Type step.
      setSchema(initialSchema || null);
      setActive(initialSchema ? 1 : 0);
      setAppName('');
      setProfile({ domain: '', timezone: '' });
      setEntries([emptyEntry(initialSchema)]); setMeta([]); setErrors({}); setApiError('');
    }
  }, [open, initialSchema]);

  const isEnvironment = schema?.name === 'environment';
  const tabs = Array.isArray(catalog) ? catalog : [];

  const pickType = (s) => {
    setSchema(s);
    setEntries([emptyEntry(s)]);
    setErrors({});
  };

  // Validate a step; returns an errors object (empty = valid).
  const validateStep = (step) => {
    const e = {};
    if (step === 0 && !schema) e.type = 'Choose what to create';
    if (step === 1 && !appName.trim()) e.appName = isEnvironment ? 'Name the new application' : 'Pick an application';
    if (step === 2 && !isEnvironment) {
      (schema?.fields || []).forEach((f) => {
        if (f.required) {
          entries.forEach((entry, i) => {
            if (!String(entry[f.key] ?? '').trim()) e[`${i}.${f.key}`] = `${fieldLabel(f.key)} is required`;
          });
        }
      });
    }
    return e;
  };

  const stepValid = useMemo(() => Object.keys(validateStep(active)).length === 0,
    [active, schema, appName, entries]);

  const goNext = () => {
    const e = validateStep(active);
    setErrors(e);
    if (Object.keys(e).length === 0) setActive((s) => Math.min(s + 1, STEPS.length - 1));
  };
  const goBack = () => setActive((s) => Math.max(s - 1, 0));
  const goTo = (step) => { if (step < active) setActive(step); };

  const setEntryField = (i, key, value) => {
    setEntries((prev) => prev.map((en, idx) => (idx === i ? { ...en, [key]: value } : en)));
    if (errors[`${i}.${key}`]) setErrors((p) => ({ ...p, [`${i}.${key}`]: null }));
  };

  // Flatten nested objects/arrays into the form-encoded shape the API accepts
  // (extension[0][username]=..., ivr[Main Menu][timeout]=...).
  const appendFlat = (fd, prefix, value) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => appendFlat(fd, `${prefix}[${i}]`, v));
    } else if (typeof value === 'object') {
      Object.entries(value).forEach(([k, v]) => appendFlat(fd, `${prefix}[${k}]`, v));
    } else {
      fd.append(prefix, String(value));
    }
  };

  // Build one entry payload: start from the catalog example item (it carries
  // fixed keys like services' type/profile.handler_type), overlay form values.
  const buildEntryPayload = (entry) => {
    const { shape } = payloadTemplate(schema);
    let template = {};
    if (Array.isArray(shape) && shape.length) template = shape[0];
    else if (shape && typeof shape === 'object') template = Object.values(shape)[0] || {};

    const item = JSON.parse(JSON.stringify(template));
    Object.entries(entry).forEach(([k, v]) => {
      if (v === '' || v === undefined || v === null) return;
      if (k in item || !item.profile || typeof item.profile !== 'object') item[k] = v;
      else item.profile[k] = v; // unknown-to-template keys ride on profile (e.g. powerlink token)
    });
    return item;
  };

  const setMetaRow = (i, field, value) =>
    setMeta((p) => p.map((row, idx) => (idx === i ? { ...row, [field]: value } : row)));

  const filledMeta = () => meta.filter((m) => m.key.trim() !== '');

  const buildFormData = () => {
    const fd = new URLSearchParams();
    fd.append('type', 'environment');
    fd.append('environment_name', appName.trim());

    // Schema-level meta: the API writes it to the environment and passes it down
    // to whatever the schema builds that carries meta (a vml and its template).
    filledMeta().forEach(({ key, value }) => fd.append(`meta[${key.trim()}]`, value));

    if (isEnvironment) {
      if (profile.domain) fd.append('profile[domain]', profile.domain);
      if (profile.timezone) fd.append('profile[timezone]', profile.timezone);
      return fd;
    }

    const { key, shape } = payloadTemplate(schema);
    if (!key) return fd;

    if (shape && !Array.isArray(shape) && typeof shape === 'object') {
      // name-keyed hash (ivr, vml): the entry's name/email field becomes the key
      entries.forEach((entry, i) => {
        const item = buildEntryPayload(entry);
        const nameKey = entry.name || entry.email || `Entry ${i + 1}`;
        delete item.name;
        appendFlat(fd, `${key}[${nameKey}]`, item);
      });
    } else {
      entries.forEach((entry, i) => appendFlat(fd, `${key}[${i}]`, buildEntryPayload(entry)));
    }
    return fd;
  };

  const handleCreate = async () => {
    const all = { ...validateStep(0), ...validateStep(1), ...validateStep(2) };
    if (Object.keys(all).length) {
      setErrors(all);
      setActive(all.type ? 0 : all.appName ? 1 : 2);
      return;
    }
    setApiError('');
    setLoading(true);
    try {
      await apiService.post('/api/schemas', buildFormData(), { timeout: 180000 }, `creating ${schema.name} schema`);
      if (isEnvironment && selectedCustomer && fetchEnvironments) {
        await fetchEnvironments(selectedCustomer.uuid);
      }
      if (onCreated) onCreated(schema);
      onClose();
    } catch (err) {
      setApiError(err?.message || `Failed to create ${schema?.label || 'schema'}`);
    } finally {
      setLoading(false);
    }
  };

  const renderField = (f, i, entry) => {
    const err = errors[`${i}.${f.key}`];
    const common = {
      key: f.key, label: fieldLabel(f.key), value: entry[f.key] ?? '', fullWidth: true, size: 'small',
      required: !!f.required, error: !!err, helperText: err || f.help || '',
      onChange: (e) => setEntryField(i, f.key, e.target.value),
    };
    if (f.type === 'select' && Array.isArray(f.options)) {
      return (
        <FormControl fullWidth size="small" key={f.key} error={!!err}>
          <InputLabel>{fieldLabel(f.key)}</InputLabel>
          <Select label={fieldLabel(f.key)} value={entry[f.key] ?? ''} onChange={(e) => setEntryField(i, f.key, e.target.value)}>
            {f.options.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
          </Select>
        </FormControl>
      );
    }
    if (f.type === 'boolean') {
      return (
        <FormControlLabel key={f.key}
          control={<Switch checked={String(entry[f.key]) === 'true'} onChange={(e) => setEntryField(i, f.key, String(e.target.checked))} />}
          label={fieldLabel(f.key)} />
      );
    }
    if (f.type === 'password') return <SecretField {...common} />;
    if (f.type === 'number') return <TextField {...common} type="number" />;
    if (f.type === 'text') return <TextField {...common} multiline rows={3} />;
    return <TextField {...common} />;
  };

  const help = STEP_HELP[active];

  // Optional key/value meta, sent as meta[key]=value alongside the resource data.
  const metaEditor = (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>Meta (optional)</Typography>
      <Typography variant="caption" color="text.secondary">
        Custom key/value pairs kept on the application and on what this schema creates
        (an SMS auto-reply and its template inherit them) — e.g. a CRM or campaign id.
      </Typography>
      {meta.map((row, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField size="small" label="Key" value={row.key} sx={{ flex: 1 }}
            onChange={(e) => setMetaRow(i, 'key', e.target.value)} />
          <TextField size="small" label="Value" value={row.value} sx={{ flex: 1 }}
            onChange={(e) => setMetaRow(i, 'value', e.target.value)} />
          <IconButton size="small" onClick={() => setMeta((p) => p.filter((_, idx) => idx !== i))}>
            <DeleteOutlineIcon fontSize="small" />
          </IconButton>
        </Box>
      ))}
      <Button startIcon={<AddIcon />} onClick={() => setMeta((p) => [...p, { key: '', value: '' }])}
        sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
        Add meta property
      </Button>
    </Box>
  );

  // A label/value line in the review manifest. Edit is offered per group
  // (the card header), so the line itself stays quiet. `step` is unused here
  // but kept in call sites for readability of which step owns the value.
  const Row = ({ label, value }) => (
    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 1, py: 0.4 }}>
      <Typography variant="caption" sx={{ minWidth: 96, color: 'text.secondary', fontWeight: 600 }}>{label}</Typography>
      <Typography variant="body2" sx={{ flex: 1, wordBreak: 'break-word', fontVariantNumeric: 'tabular-nums' }}>
        {value || <span style={{ opacity: 0.4 }}>—</span>}
      </Typography>
    </Box>
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth
      PaperProps={{ sx: { height: '88vh', display: 'flex', flexDirection: 'column' } }}>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>
        <AutoFixHighIcon color="primary" />
        <Typography variant="h6" sx={{ flex: 1 }}>New Schema</Typography>
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
            <Box>
              {tabs.map((tab) => (
                <Box key={tab.category} sx={{ mb: 2 }}>
                  <Typography variant="overline" color="text.secondary">{tab.category}</Typography>
                  <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 1.5, mt: 0.5 }}>
                    {(tab.schemas || []).map((s) => (
                      <Card key={s.name} variant="outlined"
                        sx={{ borderColor: schema?.name === s.name ? 'primary.main' : 'var(--theme-border)', borderWidth: schema?.name === s.name ? 2 : 1 }}>
                        <CardActionArea onClick={() => pickType(s)} sx={{ p: 1.5, height: '100%' }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                            <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>{s.label || s.name}</Typography>
                            {schema?.name === s.name && <CheckCircleIcon color="primary" sx={{ fontSize: 18 }} />}
                          </Box>
                          {s.description && <Typography variant="caption" color="text.secondary">{s.description}</Typography>}
                        </CardActionArea>
                      </Card>
                    ))}
                  </Box>
                </Box>
              ))}
              {errors.type && <Typography color="error" variant="caption">{errors.type}</Typography>}
            </Box>
          )}

          {active === 1 && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {isEnvironment ? (
                <>
                  <TextField label="Application Name" value={appName} onChange={(e) => setAppName(e.target.value)}
                    error={!!errors.appName} helperText={errors.appName} required fullWidth autoFocus />
                  <TextField label="Domain" value={profile.domain} onChange={(e) => setProfile((p) => ({ ...p, domain: e.target.value }))}
                    helperText="SIP domain for the new application (optional — defaults from the customer)" fullWidth />
                  <TextField label="Timezone" value={profile.timezone} onChange={(e) => setProfile((p) => ({ ...p, timezone: e.target.value }))}
                    placeholder="Asia/Jerusalem" fullWidth />
                </>
              ) : (
                <FormControl fullWidth error={!!errors.appName}>
                  <InputLabel>Application</InputLabel>
                  <Select value={appName} label="Application" onChange={(e) => setAppName(e.target.value)}>
                    {(environments || []).map((env) => (
                      <MenuItem key={env.uuid} value={env.name}>{env.name}</MenuItem>
                    ))}
                  </Select>
                  {errors.appName && <Typography color="error" variant="caption" sx={{ mt: 0.5 }}>{errors.appName}</Typography>}
                </FormControl>
              )}
            </Box>
          )}

          {active === 2 && (
            isEnvironment ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <Alert severity="info">
                  Nothing else needed — the application will be provisioned with defaults.
                  You can add extensions, queues and DIDs afterwards with this wizard.
                </Alert>
                {metaEditor}
              </Box>
            ) : (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {entries.map((entry, i) => (
                  <Box key={i} sx={{ p: 1.5, border: '1px solid var(--theme-border)', borderRadius: '8px' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                      <Typography variant="subtitle2" sx={{ flex: 1 }}>{schema?.label} {entries.length > 1 ? `#${i + 1}` : ''}</Typography>
                      {entries.length > 1 && (
                        <IconButton size="small" onClick={() => setEntries((p) => p.filter((_, idx) => idx !== i))}>
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      )}
                    </Box>
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5 }}>
                      {(schema?.fields || []).map((f) => renderField(f, i, entry))}
                    </Box>
                  </Box>
                ))}
                <Button startIcon={<AddIcon />} onClick={() => setEntries((p) => [...p, emptyEntry(schema)])}
                  sx={{ alignSelf: 'flex-start', textTransform: 'none' }}>
                  Add another {schema?.label?.toLowerCase() || 'entry'}
                </Button>
                {metaEditor}
              </Box>
            )
          )}

          {active === 3 && (
            <Box>
              {/* Manifest header — one plain-language line for what the single
                  request will provision. */}
              <Box
                sx={{
                  display: 'flex', gap: 1.5, alignItems: 'flex-start', p: 2, mb: 2,
                  borderRadius: '10px', bgcolor: 'var(--theme-bg-secondary)',
                  border: '1px solid var(--theme-border)',
                }}
              >
                <CheckCircleIcon color="success" sx={{ mt: 0.25 }} />
                <Box sx={{ flex: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.3 }}>
                    You’re about to create
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {isEnvironment ? (
                      <>A new application named <strong>{appName || '—'}</strong>.</>
                    ) : (
                      <><strong>{entries.length}</strong> × {schema?.label} in application <strong>{appName || '—'}</strong>.</>
                    )}
                  </Typography>
                </Box>
                <Chip
                  size="small" color="primary" variant="outlined"
                  label={isEnvironment ? '1 application' : `${entries.length} ${entries.length === 1 ? 'item' : 'items'}`}
                />
              </Box>

              {/* Environment: the app itself + its profile */}
              {isEnvironment && (
                <Box sx={{ border: '1px solid var(--theme-border)', borderRadius: '8px', p: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700 }}>Application</Typography>
                    <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setActive(1)}>Edit</Button>
                  </Box>
                  <Row label="Name" value={appName} step={1} />
                  <Row label="Domain" value={profile.domain} step={1} />
                  <Row label="Timezone" value={profile.timezone} step={1} />
                </Box>
              )}

              {/* Meta rides along with whatever is being created */}
              {filledMeta().length > 0 && (
                <Box sx={{ border: '1px solid var(--theme-border)', borderRadius: '8px', p: 1.5, mt: 1.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700 }}>Meta</Typography>
                    <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setActive(2)}>Edit</Button>
                  </Box>
                  {filledMeta().map((m) => <Row key={m.key} label={m.key} value={m.value} step={2} />)}
                </Box>
              )}

              {/* Each resource entry as a manifest line item, titled by its own
                  identifier, with its filled fields underneath. */}
              {!isEnvironment && (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {entries.map((entry, i) => (
                    <Box key={i} sx={{ border: '1px solid var(--theme-border)', borderRadius: '8px', p: 1.5 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
                        <Chip size="small" label={`${schema?.label} ${entries.length > 1 ? `#${i + 1}` : ''}`.trim()} />
                        <Typography variant="subtitle2" sx={{ flex: 1, fontWeight: 700, wordBreak: 'break-word' }}>
                          {entryTitle(entry) || <span style={{ opacity: 0.5 }}>untitled</span>}
                        </Typography>
                        <Button size="small" sx={{ textTransform: 'none' }} onClick={() => setActive(2)}>Edit</Button>
                      </Box>
                      {(schema?.fields || [])
                        .filter((f) => String(entry[f.key] ?? '').trim() !== '')
                        .map((f) => (
                          <Row key={f.key} label={fieldLabel(f.key)}
                            value={f.type === 'password' ? '••••••' : entry[f.key]} step={2} />
                        ))}
                    </Box>
                  ))}
                </Box>
              )}
            </Box>
          )}
        </Box>

        {/* Help panel */}
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
            Create
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
};

export default SchemaWizard;
