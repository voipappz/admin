import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Select, MenuItem, FormControl, InputLabel,
  IconButton, Tooltip, CircularProgress, Alert, Chip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import { nodesApi } from '../../services/api/nodesApi';

// Same small monospace styling used by the syslog viewer — reused so all
// config/log text reads as one system.
const MONO = '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace';

/**
 * SystemConfig — Settings → System Config.
 * Pick a node and view its complete va.yaml (the config the voipappz CLI
 * pulls on `voipappz sync`). Read-only; copy / download for editing offline.
 */
const SystemConfig = () => {
  const [nodes, setNodes] = useState([]);
  const [nodeUuid, setNodeUuid] = useState('');
  const [yaml, setYaml] = useState('');
  const [loadingNodes, setLoadingNodes] = useState(false);
  const [loadingYaml, setLoadingYaml] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setLoadingNodes(true);
    nodesApi.getNodes()
      .then((res) => {
        if (cancelled) return;
        const list = Array.isArray(res) ? res : (res?.data || res?.items || []);
        setNodes(list);
        if (list.length > 0) setNodeUuid(list[0].uuid);
      })
      .catch((e) => { if (!cancelled) setError(e.message || 'Failed to load nodes'); })
      .finally(() => { if (!cancelled) setLoadingNodes(false); });
    return () => { cancelled = true; };
  }, []);

  const fetchYaml = useCallback((uuid) => {
    if (!uuid) return;
    setLoadingYaml(true);
    setError(null);
    nodesApi.getVaYaml(uuid)
      .then((text) => setYaml(typeof text === 'string' ? text : String(text ?? '')))
      .catch((e) => { setError(e.message || 'Failed to load va.yaml'); setYaml(''); })
      .finally(() => setLoadingYaml(false));
  }, []);

  useEffect(() => { fetchYaml(nodeUuid); }, [nodeUuid, fetchYaml]);

  const nodeName = nodes.find((n) => n.uuid === nodeUuid)?.name || 'node';

  const handleCopy = () => { navigator.clipboard?.writeText(yaml); };
  const handleDownload = () => {
    const blob = new Blob([yaml], { type: 'application/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `va-${nodeName}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Box sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 1.5 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>System Config</Typography>
        <Typography variant="body2" sx={{ color: 'var(--theme-text-secondary)' }}>
          The complete <code>va.yaml</code> a node pulls on <code>voipappz sync</code>.
        </Typography>
        <Box sx={{ flex: 1 }} />
        <FormControl size="small" sx={{ minWidth: 220 }}>
          <InputLabel>Node</InputLabel>
          <Select
            value={nodeUuid}
            label="Node"
            onChange={(e) => setNodeUuid(e.target.value)}
            disabled={loadingNodes || nodes.length === 0}
          >
            {nodes.map((n) => (
              <MenuItem key={n.uuid} value={n.uuid}>
                {n.name}{n.type ? ` · ${n.type}` : ''}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Tooltip title="Reload"><span>
          <IconButton size="small" onClick={() => fetchYaml(nodeUuid)} disabled={!nodeUuid || loadingYaml}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
        <Tooltip title="Copy"><span>
          <IconButton size="small" onClick={handleCopy} disabled={!yaml}>
            <ContentCopyIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
        <Tooltip title="Download .yaml"><span>
          <IconButton size="small" onClick={handleDownload} disabled={!yaml}>
            <DownloadIcon fontSize="small" />
          </IconButton>
        </span></Tooltip>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 1.5 }}>{error}</Alert>}

      <Paper
        variant="outlined"
        sx={{ flex: 1, minHeight: 0, overflow: 'auto', bgcolor: 'var(--widget-content-bg)', position: 'relative' }}
      >
        {loadingYaml ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 200 }}>
            <CircularProgress size={22} />
          </Box>
        ) : yaml ? (
          <Box component="pre" sx={{
            m: 0, p: 1.5, fontFamily: MONO, fontSize: '12px', lineHeight: 1.5,
            color: 'var(--theme-text-primary)', whiteSpace: 'pre', overflowWrap: 'normal',
          }}>
            {yaml}
          </Box>
        ) : (
          <Box sx={{ p: 3, textAlign: 'center' }}>
            <Chip label="No config" size="small" />
          </Box>
        )}
      </Paper>
    </Box>
  );
};

export default SystemConfig;
