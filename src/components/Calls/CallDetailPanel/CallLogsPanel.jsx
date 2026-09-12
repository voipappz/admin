import React, { useState, useEffect } from 'react';
import { Box, Typography, IconButton, CircularProgress } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CloseIcon from '@mui/icons-material/Close';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import moment from 'moment';
import { callsApi } from '../../../services/api/callsApi';
import './CallDetailPanel.css';

// Normalize whatever the logs endpoint returns into a flat list of entries.
const normalizeLogs = (data) => {
  const raw = Array.isArray(data)
    ? data
    : data?.logs || data?.data || data?.events || data?.items || [];
  if (!Array.isArray(raw)) return [];
  return raw.map((entry) => {
    if (typeof entry === 'string') return { message: entry };
    const time = entry.timestamp || entry.time || entry.created_at || entry.date || null;
    const message =
      entry.message || entry.event || entry.description || entry.text || entry.line ||
      (typeof entry === 'object' ? JSON.stringify(entry) : String(entry));
    const level = entry.level || entry.severity || entry.type || null;
    return { time, message, level };
  });
};

const levelColor = (level) => {
  const l = String(level || '').toLowerCase();
  if (l.includes('error') || l.includes('fail')) return '#ef4444';
  if (l.includes('warn')) return '#f59e0b';
  if (l.includes('info')) return '#3b82f6';
  return 'var(--theme-text-secondary)';
};

const CallLogsPanel = ({ call, onBack, onClose, isMobile }) => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [error, setError] = useState(null);

  const callId = call?.uuid || call?.id;
  const caller = call?.profile?.caller || 'Unknown';

  useEffect(() => {
    if (!callId) return;
    let cancelled = false;

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      setLogs([]);
      try {
        const data = await callsApi.getCallLogs(callId);
        if (!cancelled) setLogs(normalizeLogs(data));
      } catch (err) {
        if (!cancelled) setError(err?.message || 'Failed to load logs');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchLogs();
    return () => { cancelled = true; };
  }, [callId]);

  return (
    <Box className={`call-detail-panel ${isMobile ? 'mobile' : ''}`}>
      {/* Header */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        p: 1.5,
        borderBottom: '1px solid var(--border-light)',
        backgroundColor: 'var(--bg-secondary)',
      }}>
        <IconButton onClick={onBack} size="small">
          <ArrowBackIcon />
        </IconButton>
        <ReceiptLongIcon sx={{ color: 'var(--accent-primary)' }} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" noWrap sx={{ fontWeight: 600, fontFamily: 'Rubik, sans-serif' }}>
            Call Logs
          </Typography>
          <Typography variant="caption" noWrap sx={{ color: 'var(--theme-text-secondary)', fontFamily: 'Rubik, sans-serif' }}>
            {caller}
          </Typography>
        </Box>
        <IconButton onClick={onClose} size="small">
          <CloseIcon />
        </IconButton>
      </Box>

      {/* Body */}
      <Box sx={{ flex: 1, overflowY: 'auto', p: 1.5 }}>
        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress size={28} />
          </Box>
        )}

        {!loading && error && (
          <Typography variant="body2" sx={{ color: '#ef4444', fontFamily: 'Rubik, sans-serif', p: 2 }}>
            {error}
          </Typography>
        )}

        {!loading && !error && logs.length === 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--theme-text-secondary)', gap: 1 }}>
            <ReceiptLongIcon sx={{ fontSize: 40, opacity: 0.4 }} />
            <Typography variant="body2" sx={{ fontFamily: 'Rubik, sans-serif' }}>
              No logs for this call
            </Typography>
          </Box>
        )}

        {!loading && !error && logs.length > 0 && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            {logs.map((entry, i) => (
              <Box
                key={i}
                sx={{
                  display: 'flex',
                  gap: 1,
                  px: 1,
                  py: 0.75,
                  borderRadius: '6px',
                  borderLeft: `3px solid ${levelColor(entry.level)}`,
                  backgroundColor: 'var(--theme-bg-secondary)',
                }}
              >
                {entry.time && (
                  <Typography
                    component="span"
                    sx={{
                      flexShrink: 0,
                      fontFamily: 'monospace',
                      fontSize: '0.72rem',
                      color: 'var(--theme-text-secondary)',
                      pt: '1px',
                    }}
                  >
                    {moment(entry.time).isValid() ? moment(entry.time).format('HH:mm:ss') : String(entry.time)}
                  </Typography>
                )}
                <Typography
                  component="span"
                  sx={{
                    fontFamily: 'monospace',
                    fontSize: '0.78rem',
                    color: 'var(--theme-text-primary)',
                    wordBreak: 'break-word',
                    whiteSpace: 'pre-wrap',
                  }}
                >
                  {entry.message}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default CallLogsPanel;
