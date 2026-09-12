import { useState, useCallback, useEffect } from 'react';
import {
  Dialog, DialogTitle, DialogContent, DialogActions,
  Button, TextField, Box, Alert, MenuItem,
} from '@mui/material';
import SqlQueryEditor from '../SqlQueryEditor/SqlQueryEditor';
import { reportsApi } from '../../../services/api/reportsApi';

// Extract column names from a SELECT clause
const parseFields = (sql) => {
  const m = sql.match(/SELECT\s+(.+?)\s+FROM/is);
  if (!m) return ['result'];
  return m[1].split(',').map(c => {
    const alias = c.match(/\s+AS\s+["']?([\w.]+)["']?\s*$/i);
    return alias ? alias[1].trim() : c.trim().replace(/^.*\./, '').replace(/["']/g, '');
  }).filter(Boolean);
};

const CreateReportDialog = ({ open, onClose, onSave, queries = [] }) => {
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [type, setType] = useState('table');
  const [types, setTypes] = useState([]);
  // Guardrail overrides — empty = engine defaults (10k rows / 15s / 60s cache)
  const [rowLimit, setRowLimit] = useState('');
  const [timeoutMs, setTimeoutMs] = useState('');
  const [cacheTtl, setCacheTtl] = useState('');
  // Blazer-style: start from a queries.yml template — seeds the SQL + name.
  // `seedKey` bumps to remount the editor with the chosen statement.
  const [templateName, setTemplateName] = useState('');
  const [seedStatement, setSeedStatement] = useState('');
  const [seedKey, setSeedKey] = useState(0);
  const templates = (queries || []).filter((q) => q && q.name && q.statement);

  useEffect(() => {
    if (!open || types.length) return;
    reportsApi.getTypes()
      .then((result) => setTypes(Array.isArray(result) ? result : []))
      .catch((err) => console.error('Failed to fetch report types:', err));
  }, [open, types.length]);

  const handleTemplate = useCallback((qName) => {
    setTemplateName(qName);
    const tpl = templates.find((q) => q.name === qName);
    if (tpl) {
      setSeedStatement(tpl.statement);
      setSeedKey((k) => k + 1);
      setName((prev) => prev || tpl.name);
      setType(tpl.type || 'table');
    }
  }, [templates]);

  const handleSave = useCallback(async (statement) => {
    if (!name.trim()) { setError('Report name is required'); return; }
    if (!statement?.trim()) { setError('Query cannot be empty'); return; }

    setSaving(true);
    setError(null);
    try {
      const fields = parseFields(statement);
      const meta = {};
      if (rowLimit.trim())  meta.row_limit  = rowLimit.trim();
      if (timeoutMs.trim()) meta.timeout_ms = timeoutMs.trim();
      if (cacheTtl.trim())  meta.cache_ttl  = cacheTtl.trim();
      await onSave?.({
        name: name.trim(),
        type,
        enabled: true,
        statement,
        fields,
        params: ['call.created_at'],
        ...(templateName ? { query: templateName } : {}),
        ...(Object.keys(meta).length ? { meta } : {}),
      });
      handleClose();
    } catch (err) {
      const body = err?.response?.data || err?.body;
      setError(typeof body === 'string' ? body : body?.message || err.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  }, [name, type, templateName, rowLimit, timeoutMs, cacheTtl, onSave]);

  const handleClose = useCallback(() => {
    setName('');
    setError(null);
    setTemplateName('');
    setSeedStatement('');
    setType('table');
    onClose?.();
  }, [onClose]);

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth
      PaperProps={{ sx: { height: '85vh' } }}>
      <DialogTitle>New Report</DialogTitle>
      <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2, overflow: 'hidden', pb: 0 }}>
        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            label="Report name" size="small" value={name}
            onChange={e => setName(e.target.value)}
            sx={{ width: 260 }}
          />
          <TextField select label="Display" size="small" value={type}
            onChange={e => setType(e.target.value)} sx={{ width: 140 }}>
            {(types.length ? types : [type]).map((displayType) => (
              <MenuItem key={displayType} value={displayType}>
                {displayType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
              </MenuItem>
            ))}
          </TextField>
          {templates.length > 0 && (
            <TextField
              select label="Start from template" size="small" value={templateName}
              onChange={e => handleTemplate(e.target.value)}
              sx={{ width: 220 }}
              helperText="queries.yml catalog"
            >
              <MenuItem value=""><em>Blank query</em></MenuItem>
              {templates.map((q) => (
                <MenuItem key={q.name} value={q.name}>{q.name}</MenuItem>
              ))}
            </TextField>
          )}
          {/* Limits / TTL — per-report guardrail overrides */}
          <TextField label="Row limit" size="small" type="number" value={rowLimit}
            onChange={e => setRowLimit(e.target.value)} placeholder="10000" sx={{ width: 120 }} />
          <TextField label="Timeout (ms)" size="small" type="number" value={timeoutMs}
            onChange={e => setTimeoutMs(e.target.value)} placeholder="15000" sx={{ width: 130 }} />
          <TextField label="Cache TTL (s)" size="small" type="number" value={cacheTtl}
            onChange={e => setCacheTtl(e.target.value)} placeholder="60" sx={{ width: 130 }} />
        </Box>
        {error && <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>}
        <Box sx={{ flex: 1, minHeight: 480, overflow: 'hidden', position: 'relative' }}>
          <SqlQueryEditor key={seedKey} initialStatement={seedStatement} onSave={handleSave} />
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={saving}>Cancel</Button>
      </DialogActions>
    </Dialog>
  );
};

export default CreateReportDialog;
