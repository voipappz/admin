import React, { useRef, useEffect, useMemo, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Chip } from '@mui/material';
import {
  KeyboardArrowDown as ScrollDownIcon,
  ContentCopy as CopyIcon
} from '@mui/icons-material';

/**
 * Joplin-style Raw Log Viewer
 * Displays logs as colored text on white background (like terminal output)
 */
const RawLogViewer = ({
  logs,
  autoScroll = true,
  showLineNumbers = true,
  onLogClick = null
}) => {
  const containerRef = useRef();
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [selectedLine, setSelectedLine] = useState(null);

  // Severity color mapping - Joplin-inspired with white background
  const SEVERITY_STYLES = {
    emerg: { color: '#991b1b', fontWeight: 700, label: 'EMERG' },
    emergency: { color: '#991b1b', fontWeight: 700, label: 'EMERG' },
    alert: { color: '#b91c1c', fontWeight: 700, label: 'ALERT' },
    crit: { color: '#dc2626', fontWeight: 600, label: 'CRIT' },
    critical: { color: '#dc2626', fontWeight: 600, label: 'CRIT' },
    error: { color: '#ea580c', fontWeight: 600, label: 'ERROR' },
    err: { color: '#ea580c', fontWeight: 600, label: 'ERROR' },
    warning: { color: '#ca8a04', fontWeight: 500, label: 'WARN' },
    warn: { color: '#ca8a04', fontWeight: 500, label: 'WARN' },
    notice: { color: '#2563eb', fontWeight: 400, label: 'NOTICE' },
    info: { color: '#0891b2', fontWeight: 400, label: 'INFO' },
    debug: { color: '#16a34a', fontWeight: 400, label: 'DEBUG' },
    trace: { color: '#7c3aed', fontWeight: 400, label: 'TRACE' },
  };

  // Clean ANSI escape codes
  const cleanAnsiCodes = (text) => {
    if (!text) return '';
    // eslint-disable-next-line no-control-regex
    return text.replace(/\x1b\[[0-9;]*m/g, '');
  };

  // Parse a time value that can be ISO string, Unix seconds, or nanoseconds
  const parseTime = (val) => {
    if (!val) return null;
    const str = String(val);
    // ISO 8601 string (contains T or -)
    if (str.includes('T') || (str.includes('-') && str.length > 10)) {
      return new Date(str);
    }
    const num = Number(str);
    if (isNaN(num)) return new Date(str);
    // InfluxDB nanoseconds (> 1e15), or milliseconds (> 1e12), or seconds
    if (num > 1e15) return new Date(num / 1e6);
    if (num > 1e12) return new Date(num);
    return new Date(num * 1000);
  };

  // Format timestamp
  const formatTimestamp = (log) => {
    const timestamp = parseTime(log.time) || parseTime(log.timestamp) || (log.isodate ? new Date(log.isodate) : null);
    if (!timestamp || isNaN(timestamp.getTime())) return '-------- --:--:--.---';

    // Format: YYYY-MM-DD HH:MM:SS.mmm
    const pad = (n, len = 2) => String(n).padStart(len, '0');
    return `${timestamp.getFullYear()}-${pad(timestamp.getMonth() + 1)}-${pad(timestamp.getDate())} ${pad(timestamp.getHours())}:${pad(timestamp.getMinutes())}:${pad(timestamp.getSeconds())}.${pad(timestamp.getMilliseconds(), 3)}`;
  };

  // Format log line in Joplin style
  const formatLogLine = (log, index) => {
    const severity = (log.severity || log.level || 'info').toLowerCase();
    const style = SEVERITY_STYLES[severity] || SEVERITY_STYLES.info;
    const message = cleanAnsiCodes(log.message || log.msg || '');
    const timestamp = formatTimestamp(log);
    const host = log.host || log.actor || '-';
    const app = log.app || log.type || '-';
    const facility = log.facility || '-';
    const session = log.session || '';
    const tags = Array.isArray(log.tags) ? log.tags : [];

    return {
      index,
      timestamp,
      severity: style.label,
      severityColor: style.color,
      severityWeight: style.fontWeight,
      host,
      app,
      facility,
      session,
      tags,
      message,
      raw: log
    };
  };

  // Process logs
  const formattedLogs = useMemo(() => {
    if (!logs || logs.length === 0) return [];
    return logs.map((log, i) => formatLogLine(log, i));
  }, [logs]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && isAtBottom && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [formattedLogs, autoScroll, isAtBottom]);

  // Handle scroll
  const handleScroll = () => {
    if (!containerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
    setIsAtBottom(scrollHeight - scrollTop - clientHeight < 50);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  };

  // Copy log to clipboard
  const copyLog = (log) => {
    let text = `[${log.timestamp}] [${log.severity}] [${log.host}] [${log.app}]`;
    if (log.session) text += ` [${log.session}]`;
    if (log.tags && log.tags.length > 0) text += ` [${log.tags.join(', ')}]`;
    text += ` ${log.message}`;
    navigator.clipboard.writeText(text);
  };

  // Handle line click
  const handleLineClick = (log, e) => {
    setSelectedLine(log.index);
    if (onLogClick) {
      onLogClick(log.raw, e);
    }
  };

  if (!logs || logs.length === 0) {
    return (
      <Box sx={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: '#ffffff',
        border: '1px solid #e5e7eb',
        borderRadius: 1,
        fontFamily: 'monospace'
      }}>
        <Typography variant="body2" color="text.secondary">
          No logs to display
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Log Stats Bar */}
      <Box sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 0.5,
        bgcolor: '#f8fafc',
        borderBottom: '1px solid #e5e7eb',
        flexShrink: 0
      }}>
        <Typography variant="caption" sx={{ color: '#64748b', fontFamily: 'monospace' }}>
          {formattedLogs.length} entries
        </Typography>
        <Box sx={{ flexGrow: 1 }} />
        {Object.entries(
          formattedLogs.reduce((acc, log) => {
            acc[log.severity] = (acc[log.severity] || 0) + 1;
            return acc;
          }, {})
        ).map(([sev, count]) => (
          <Chip
            key={sev}
            label={`${sev}: ${count}`}
            size="small"
            sx={{
              height: 20,
              fontSize: '10px',
              fontFamily: 'monospace',
              bgcolor: SEVERITY_STYLES[sev.toLowerCase()]?.color + '20',
              color: SEVERITY_STYLES[sev.toLowerCase()]?.color,
              border: 'none'
            }}
          />
        ))}
      </Box>

      {/* Log Container - White Background */}
      <Box
        ref={containerRef}
        onScroll={handleScroll}
        sx={{
          flexGrow: 1,
          overflow: 'auto',
          bgcolor: '#ffffff',
          fontFamily: '"JetBrains Mono", "Fira Code", "SF Mono", Consolas, monospace',
          fontSize: '12px',
          lineHeight: 1.6,
          border: '1px solid #e5e7eb',
          borderTop: 'none',
          borderRadius: '0 0 4px 4px'
        }}
      >
        {formattedLogs.map((log) => (
          <Box
            key={log.index}
            onClick={(e) => handleLineClick(log, e)}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              px: 1,
              py: 0.25,
              cursor: 'pointer',
              bgcolor: selectedLine === log.index ? '#f0f9ff' : 'transparent',
              borderLeft: selectedLine === log.index ? '3px solid #3b82f6' : '3px solid transparent',
              '&:hover': {
                bgcolor: '#f8fafc'
              },
              transition: 'background-color 0.1s'
            }}
          >
            {/* Line Number */}
            {showLineNumbers && (
              <Box
                component="span"
                sx={{
                  width: 50,
                  flexShrink: 0,
                  color: '#9ca3af',
                  textAlign: 'right',
                  pr: 1.5,
                  userSelect: 'none',
                  borderRight: '1px solid #e5e7eb',
                  mr: 1.5
                }}
              >
                {log.index + 1}
              </Box>
            )}

            {/* Timestamp */}
            <Box
              component="span"
              sx={{
                color: '#6b7280',
                flexShrink: 0,
                mr: 1
              }}
            >
              {log.timestamp}
            </Box>

            {/* Severity Badge */}
            <Box
              component="span"
              sx={{
                color: log.severityColor,
                fontWeight: log.severityWeight,
                flexShrink: 0,
                width: 60,
                textAlign: 'center',
                mr: 1
              }}
            >
              [{log.severity}]
            </Box>

            {/* Host */}
            <Box
              component="span"
              sx={{
                color: '#8b5cf6',
                flexShrink: 0,
                mr: 1,
                maxWidth: 100,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {log.host}
            </Box>

            {/* App/Type */}
            <Box
              component="span"
              sx={{
                color: '#0ea5e9',
                flexShrink: 0,
                mr: 1,
                maxWidth: 80,
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              [{log.app}]
            </Box>

            {/* Session (if present) */}
            {log.session && log.session !== '-' && (
              <Box
                component="span"
                sx={{
                  color: '#9333ea',
                  flexShrink: 0,
                  mr: 1,
                  fontSize: '11px',
                  opacity: 0.8
                }}
              >
                [{log.session.length > 8 ? `${log.session.slice(0, 8)}...` : log.session}]
              </Box>
            )}

            {/* Tags (if present) */}
            {log.tags && log.tags.length > 0 && (
              <Box
                component="span"
                sx={{
                  flexShrink: 0,
                  mr: 1,
                  display: 'flex',
                  gap: 0.5
                }}
              >
                {log.tags.slice(0, 3).map((tag, i) => (
                  <Box
                    key={i}
                    component="span"
                    sx={{
                      bgcolor: '#e0f2fe',
                      color: '#0369a1',
                      px: 0.5,
                      py: 0,
                      borderRadius: '2px',
                      fontSize: '10px'
                    }}
                  >
                    {tag}
                  </Box>
                ))}
                {log.tags.length > 3 && (
                  <Box component="span" sx={{ color: '#64748b', fontSize: '10px' }}>
                    +{log.tags.length - 3}
                  </Box>
                )}
              </Box>
            )}

            {/* Message */}
            <Box
              component="span"
              sx={{
                color: '#1f2937',
                flexGrow: 1,
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap'
              }}
            >
              {log.message}
            </Box>

            {/* Copy Button (on hover) */}
            <Tooltip title="Copy log entry">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  copyLog(log);
                }}
                sx={{
                  opacity: 0,
                  ml: 1,
                  flexShrink: 0,
                  '.MuiBox-root:hover &': {
                    opacity: 1
                  }
                }}
              >
                <CopyIcon sx={{ fontSize: 14 }} />
              </IconButton>
            </Tooltip>
          </Box>
        ))}
      </Box>

      {/* Scroll to Bottom Button */}
      {!isAtBottom && (
        <Tooltip title="Scroll to bottom">
          <IconButton
            onClick={scrollToBottom}
            sx={{
              position: 'absolute',
              bottom: 16,
              right: 24,
              bgcolor: '#3b82f6',
              color: 'white',
              boxShadow: 2,
              '&:hover': {
                bgcolor: '#2563eb'
              }
            }}
          >
            <ScrollDownIcon />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
};

export default RawLogViewer;
