import { useEffect, useState, useCallback } from 'react';
import {
  Box, Typography, CircularProgress, Alert, Tabs, Tab, Chip,
  Table, TableBody, TableRow, TableCell, List, ListItemButton, ListItemText, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiService } from '../../services/apiService';

const mono = { fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: '0.8rem' };

// Renders the raw YAML text of one config file (fetched on demand).
export const YamlView = ({ name }) => {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    apiService.get(`/api/settings/yaml/${name}`, {}, `loading ${name}.yml`, false)
      .then((res) => { if (alive) setText(typeof res === 'string' ? res : JSON.stringify(res, null, 2)); })
      .catch((e) => { if (alive) setText(`# failed to load: ${e.message}`); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [name]);
  if (loading) return <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={22} /></Box>;
  return (
    <Box component="pre" sx={{
      ...mono, m: 0, p: 1.5, borderRadius: 1, overflow: 'auto', maxHeight: '60vh',
      bgcolor: 'var(--theme-bg-secondary)', border: '1px solid var(--theme-border)', whiteSpace: 'pre',
    }}>{text}</Box>
  );
};

/**
 * AppConfig — read-only view of the API's settings surface (GET /api/settings):
 * effective Config.* values, the YAML config files (each rendered as a YAML
 * view), and the registered Yabeda metrics.
 */
const AppConfig = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tab, setTab] = useState(0);
  const [yamlName, setYamlName] = useState(null);

  const load = useCallback(() => {
    setLoading(true); setError(null);
    apiService.get('/api/settings', {}, 'loading settings', false)
      .then((res) => {
        setData(res);
        if (res?.yaml?.length) setYamlName(res.yaml[0].name);
      })
      .catch((e) => setError(e.message || 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (loading) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>;
  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return null;

  const config = data.config || {};
  const yaml = data.yaml || [];
  const metrics = data.metrics || [];
  const system = data.system || {};

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ flex: 1, minHeight: 40 }}>
          <Tab label="Config" sx={{ minHeight: 40 }} />
          <Tab label={`YAML (${yaml.length})`} sx={{ minHeight: 40 }} />
          <Tab label={`Metrics (${metrics.length})`} sx={{ minHeight: 40 }} />
          <Tab label="System" sx={{ minHeight: 40 }} />
        </Tabs>
        <Tooltip title="Refresh"><IconButton size="small" onClick={load}><RefreshIcon fontSize="small" /></IconButton></Tooltip>
      </Box>

      {/* Config.* values */}
      {tab === 0 && (
        <Box sx={{ overflow: 'auto' }}>
          <Typography variant="caption" color="text.secondary">Effective runtime configuration (secrets hidden, credentials masked).</Typography>
          <Table size="small" sx={{ mt: 1 }}>
            <TableBody>
              {Object.entries(config).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ ...mono, color: 'text.secondary', width: '35%', borderColor: 'var(--theme-border)' }}>{k}</TableCell>
                  <TableCell sx={{ ...mono, borderColor: 'var(--theme-border)', wordBreak: 'break-all' }}>{String(v)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* YAML files — list on the left, viewer on the right */}
      {tab === 1 && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <List dense sx={{ width: 200, flexShrink: 0, border: '1px solid var(--theme-border)', borderRadius: 1, maxHeight: '60vh', overflow: 'auto' }}>
            {yaml.map((y) => (
              <ListItemButton key={y.name} selected={yamlName === y.name} onClick={() => setYamlName(y.name)}>
                <ListItemText primary={y.file}
                  secondary={y.entries != null ? `${y.entries} entries` : null}
                  primaryTypographyProps={{ sx: { ...mono, fontSize: '0.78rem' } }}
                  secondaryTypographyProps={{ sx: { fontSize: 10 } }} />
                {y.redacted && <Chip size="small" label="masked" variant="outlined" sx={{ height: 18, fontSize: 9 }} />}
              </ListItemButton>
            ))}
          </List>
          <Box sx={{ flex: 1, minWidth: 0 }}>{yamlName && <YamlView name={yamlName} />}</Box>
        </Box>
      )}

      {/* Yabeda metrics */}
      {tab === 2 && (
        <Box sx={{ overflow: 'auto', maxHeight: '60vh' }}>
          <Typography variant="caption" color="text.secondary">Metrics the API registers (Yabeda).</Typography>
          <Table size="small" sx={{ mt: 1 }}>
            <TableBody>
              {metrics.map((m) => (
                <TableRow key={m.name}>
                  <TableCell sx={{ ...mono, borderColor: 'var(--theme-border)', whiteSpace: 'nowrap' }}>{m.name}</TableCell>
                  <TableCell sx={{ borderColor: 'var(--theme-border)' }}><Chip size="small" label={m.type} variant="outlined" /></TableCell>
                  <TableCell sx={{ ...mono, borderColor: 'var(--theme-border)', textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 600 }}>
                    {m.value != null ? m.value.toLocaleString() : '—'}
                  </TableCell>
                  <TableCell sx={{ ...mono, fontSize: '0.72rem', color: 'text.secondary', borderColor: 'var(--theme-border)' }}>{(m.tags || []).join(', ')}</TableCell>
                  <TableCell sx={{ fontSize: '0.75rem', color: 'text.secondary', borderColor: 'var(--theme-border)' }}>{m.comment}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}

      {/* Verbose system info */}
      {tab === 3 && (
        <Box sx={{ overflow: 'auto', maxHeight: '60vh' }}>
          <Typography variant="caption" color="text.secondary">Runtime system status.</Typography>
          <Table size="small" sx={{ mt: 1 }}>
            <TableBody>
              {Object.entries(system).map(([k, v]) => (
                <TableRow key={k}>
                  <TableCell sx={{ ...mono, color: 'text.secondary', width: '35%', borderColor: 'var(--theme-border)' }}>{k}</TableCell>
                  <TableCell sx={{ ...mono, borderColor: 'var(--theme-border)', wordBreak: 'break-all' }}>
                    {k === 'db_connected'
                      ? <Chip size="small" label={v ? 'connected' : 'down'} color={v ? 'success' : 'error'} variant="outlined" />
                      : k === 'uptime_seconds'
                        ? `${Math.floor(v / 3600)}h ${Math.floor((v % 3600) / 60)}m`
                        : String(v)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
};

export default AppConfig;
