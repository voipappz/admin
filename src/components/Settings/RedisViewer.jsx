import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, TextField, InputAdornment, IconButton, Tooltip,
  List, ListItemButton, ListItemText, Chip, CircularProgress, Alert, Divider,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import StorageIcon from '@mui/icons-material/Storage';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import { redisApi } from '../../services/api/redisApi';

/** Pretty-print a redis value (JSON if possible) */
const formatValue = (val) => {
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val, null, 2);
  try {
    return JSON.stringify(JSON.parse(val), null, 2);
  } catch {
    return String(val);
  }
};

/**
 * RedisViewer — a general Redis key browser (Settings → Redis Viewer).
 * Plain Redis only: scan by pattern, inspect a key's type/TTL/value.
 * Replaces the old Dashboard "Data Explorer" (whose Identities/TS view is
 * gone — dashboard widgets pick their data in the widget editor instead).
 */
const RedisViewer = () => {
  const [info, setInfo] = useState(null);
  const [pattern, setPattern] = useState('*');
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedKey, setSelectedKey] = useState(null);
  const [keyData, setKeyData] = useState(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchInfo = useCallback(() => {
    redisApi.getInfo().then(setInfo).catch(() => setInfo(null));
  }, []);

  const fetchKeys = useCallback(async (p = pattern) => {
    setLoading(true);
    setError(null);
    try {
      const res = await redisApi.getKeys(p || '*', 500);
      setKeys(res?.keys || res || []);
    } catch (err) {
      setError(err.message || 'Failed to scan keys');
      setKeys([]);
    } finally {
      setLoading(false);
    }
  }, [pattern]);

  useEffect(() => { fetchInfo(); fetchKeys('*'); }, []);  

  const openKey = useCallback(async (key) => {
    setSelectedKey(key);
    setKeyLoading(true);
    setKeyData(null);
    try {
      const res = await redisApi.getValue(key);
      setKeyData(res);
    } catch (err) {
      setKeyData({ error: err.message || 'Failed to read key' });
    } finally {
      setKeyLoading(false);
    }
  }, []);

  const copyValue = () => {
    navigator.clipboard?.writeText(formatValue(keyData?.value ?? keyData));
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Box>
      {/* Server info strip */}
      <Box sx={{ display: 'flex', gap: 1.5, mb: 2, flexWrap: 'wrap', alignItems: 'center' }}>
        <StorageIcon sx={{ color: '#d32f2f' }} />
        {info ? (
          <>
            <Chip size="small" variant="outlined" label={`Redis ${info.version || '?'}`} />
            <Chip size="small" variant="outlined" label={`${info.total_keys ?? '?'} keys`} />
            <Chip size="small" variant="outlined" label={`Memory: ${info.used_memory || '?'}`} />
            <Chip size="small" variant="outlined" label={`Clients: ${info.connected_clients ?? '?'}`} />
          </>
        ) : (
          <Typography variant="caption" sx={{ color: '#999' }}>Server info unavailable</Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title="Refresh">
          <IconButton size="small" onClick={() => { fetchInfo(); fetchKeys(); }} disabled={loading}>
            <RefreshIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <TextField
        size="small"
        fullWidth
        placeholder="Key pattern (e.g. user:*, ts:queue:*)"
        value={pattern}
        onChange={(e) => setPattern(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') fetchKeys(); }}
        sx={{ mb: 2, maxWidth: 480 }}
        InputProps={{
          startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: '#999' }} /></InputAdornment>),
        }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2, minHeight: 400 }}>
        {/* Key list */}
        <Paper elevation={0} sx={{ width: 380, flexShrink: 0, border: '1px solid #e0e0e0', borderRadius: 2, overflow: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : (
            <List dense disablePadding>
              {keys.length === 0 && (
                <Typography variant="body2" sx={{ color: '#999', textAlign: 'center', py: 3 }}>
                  No keys match this pattern
                </Typography>
              )}
              {keys.map((k) => {
                const key = typeof k === 'string' ? k : k.key;
                return (
                  <ListItemButton key={key} selected={selectedKey === key} onClick={() => openKey(key)} sx={{ py: 0.5 }}>
                    <ListItemText
                      primary={key}
                      primaryTypographyProps={{ sx: { fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' } }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </Paper>

        {/* Key detail */}
        <Paper elevation={0} sx={{ flexGrow: 1, border: '1px solid #e0e0e0', borderRadius: 2, p: 2, overflow: 'auto', maxHeight: 'calc(100vh - 320px)' }}>
          {!selectedKey ? (
            <Typography variant="body2" sx={{ color: '#999', textAlign: 'center', py: 6 }}>
              Select a key to inspect its value
            </Typography>
          ) : keyLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={24} /></Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', wordBreak: 'break-all', flexGrow: 1 }}>
                  {selectedKey}
                </Typography>
                {keyData?.type && <Chip size="small" label={keyData.type} variant="outlined" />}
                {keyData?.ttl !== undefined && keyData?.ttl !== null && (
                  <Chip size="small" label={keyData.ttl === -1 ? 'no TTL' : `TTL ${keyData.ttl}s`} variant="outlined" />
                )}
                <Tooltip title={copied ? 'Copied!' : 'Copy value'}>
                  <IconButton size="small" onClick={copyValue}><ContentCopyIcon fontSize="small" /></IconButton>
                </Tooltip>
              </Box>
              <Divider sx={{ mb: 1.5 }} />
              {keyData?.error ? (
                <Alert severity="warning">{keyData.error}</Alert>
              ) : (
                <Box component="pre" sx={{
                  m: 0, p: 1.5, backgroundColor: '#f8f9fa', border: '1px solid #eee', borderRadius: 1,
                  fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
                }}>
                  {formatValue(keyData?.value ?? keyData)}
                </Box>
              )}
            </>
          )}
        </Paper>
      </Box>
    </Box>
  );
};

export default RedisViewer;
