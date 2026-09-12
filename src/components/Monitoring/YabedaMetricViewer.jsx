import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Chip, CircularProgress, FormControl, IconButton, InputLabel,
  MenuItem, Paper, Select, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { monitoringApi } from '../../services/api/monitoringApi';

const metricNamespace = (name) => name.split(/[_.]/, 1)[0] || 'other';

const formatValue = (value) => {
  if (typeof value === 'number') {
    return new Intl.NumberFormat(undefined, { maximumFractionDigits: 3 }).format(value);
  }
  return String(value ?? '—');
};

const labelText = (labels) => Object.entries(labels || {})
  .map(([key, value]) => `${key}=${value}`)
  .join(', ');

/** A compact, searchable view of the API's authenticated Yabeda registry. */
export default function YabedaMetricViewer() {
  const [payload, setPayload] = useState({ metrics: [] });
  const [query, setQuery] = useState('');
  const [namespace, setNamespace] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await monitoringApi.getYabedaMetrics();
      setPayload(response || { metrics: [] });
    } catch (err) {
      setError(err?.message || 'Unable to load API metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const metrics = Array.isArray(payload?.metrics) ? payload.metrics : [];
  const namespaces = useMemo(() => (
    [...new Set(metrics.map((metric) => metricNamespace(metric.name || 'other')))].sort()
  ), [metrics]);

  const rows = useMemo(() => metrics
    .filter((metric) => {
      const name = metric.name || '';
      const matchesQuery = !query.trim()
        || `${name} ${metric.description || ''}`.toLowerCase().includes(query.trim().toLowerCase());
      const matchesNamespace = namespace === 'all' || metricNamespace(name) === namespace;
      return matchesQuery && matchesNamespace;
    })
    .flatMap((metric) => {
      const samples = Array.isArray(metric.samples) && metric.samples.length
        ? metric.samples
        : [{ labels: {}, value: null }];
      return samples.map((sample, index) => ({
        id: `${metric.name}-${index}`,
        name: metric.name,
        type: metric.type || 'metric',
        description: metric.description || '',
        labels: labelText(sample.labels),
        value: formatValue(sample.value),
      }));
    }), [metrics, namespace, query]);

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 180 }}>
          {metrics.length} metric families · {rows.length} visible samples
        </Typography>
        <TextField
          size="small"
          label="Search metrics"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          sx={{ minWidth: 210 }}
        />
        <FormControl size="small" sx={{ minWidth: 145 }}>
          <InputLabel id="yabeda-namespace-label">Namespace</InputLabel>
          <Select
            labelId="yabeda-namespace-label"
            value={namespace}
            label="Namespace"
            onChange={(event) => setNamespace(event.target.value)}
          >
            <MenuItem value="all">All namespaces</MenuItem>
            {namespaces.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </Select>
        </FormControl>
        <Tooltip title="Refresh API metrics">
          <IconButton size="small" onClick={load} disabled={loading} aria-label="Refresh API metrics">
            {loading ? <CircularProgress size={18} /> : <RefreshIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 430 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>Metric</TableCell>
              <TableCell>Type</TableCell>
              <TableCell align="right">Value</TableCell>
              <TableCell>Labels</TableCell>
              <TableCell>Description</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && rows.length === 0 && (
              <TableRow><TableCell colSpan={5} align="center">No metrics match the filter.</TableCell></TableRow>
            )}
            {rows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'nowrap' }}>{row.name}</TableCell>
                <TableCell><Chip size="small" variant="outlined" label={row.type} /></TableCell>
                <TableCell align="right" sx={{ fontFamily: 'monospace' }}>{row.value}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{row.labels || '—'}</TableCell>
                <TableCell sx={{ color: 'text.secondary', fontSize: 12 }}>{row.description || '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
