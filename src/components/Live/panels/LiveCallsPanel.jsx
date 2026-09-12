import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Box, Typography, Alert, Button, IconButton, Tooltip, Menu, MenuItem,
  ListItemIcon, ListItemText, Paper, TextField, InputAdornment, Chip,
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import HearingIcon from '@mui/icons-material/Hearing';
import RecordVoiceOverIcon from '@mui/icons-material/RecordVoiceOver';
import GroupsIcon from '@mui/icons-material/Groups';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import MicOffIcon from '@mui/icons-material/MicOff';
import MicIcon from '@mui/icons-material/Mic';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import PauseIcon from '@mui/icons-material/Pause';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useLiveCalls } from '../useLiveCalls';
import { liveApi } from '../../../services/api/liveApi';
import { useNotification } from '../../../context/NotificationContext';
import { stripedDataGridSx } from '../../shared/tableTheme.jsx';
import LiveChartStrip from '../LiveChartStrip';

const gridSx = {
  ...stripedDataGridSx,
  backgroundColor: '#fff',
  color: '#333',
  border: '1px solid #e0e0e0',
  '& .MuiDataGrid-cell': { color: '#333', borderColor: '#e0e0e0', cursor: 'pointer' },
  '& .MuiDataGrid-columnHeader': { backgroundColor: '#f5f5f5', color: '#333', borderColor: '#e0e0e0' },
  '& .MuiDataGrid-footerContainer': { backgroundColor: '#f5f5f5', color: '#333', borderColor: '#e0e0e0' },
};

const getRowId = (row) => row.id || row.uuid || row.call_uuid || `row-${Math.random().toString(36).slice(2, 11)}`;

// Fields worth grouping the live calls by (columns FreeSWITCH reports)
const GROUP_BY_OPTIONS = [
  { key: 'direction', label: 'Direction' },
  { key: 'callstate', label: 'State' },
  { key: 'application', label: 'Application' },
  { key: 'dest', label: 'Destination' },
];

/** Events-style detail reveal: a key/value list for a single live call. */
const LiveRowDetail = ({ row, onClose }) => (
  <Paper elevation={0} sx={{ width: 300, flexShrink: 0, border: '1px solid #e0e0e0', borderRadius: 2, p: 2, backgroundColor: '#fff', overflowY: 'auto' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#333', flexGrow: 1 }}>Call Detail</Typography>
      <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
    </Box>
    {Object.entries(row)
      .filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object')
      .map(([k, v]) => (
        <Box key={k} sx={{ display: 'flex', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
          <Typography variant="caption" sx={{ width: 110, flexShrink: 0, color: '#6b7280', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{k}</Typography>
          <Typography variant="caption" sx={{ color: '#111', wordBreak: 'break-all' }}>{String(v)}</Typography>
        </Box>
      ))}
  </Paper>
);

/**
 * LiveCallsPanel — self-contained live-calls monitor. Extracted from the Home
 * (/live) "Live Calls" tab so it can pop out on the Calls screen. Grid + spy
 * actions + live chart; row click reveals an Events-style detail panel.
 */
const LiveCallsPanel = ({ open = true }) => {
  const { calls, columns: callColumns, loading, error, isNodeError, totalCount, refresh } = useLiveCalls(open);
  const { showSuccess, showError } = useNotification();
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);
  const [actionAnchor, setActionAnchor] = useState(null);
  const [actionUuid, setActionUuid] = useState(null);
  // Group-by: live breakdown of the current calls (counts per value); a group
  // chip click narrows the grid to that group.
  const [groupBy, setGroupBy] = useState(null);
  const [groupFilter, setGroupFilter] = useState(null);

  // Auto-refresh every 30s while open
  const timer = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    timer.current = setInterval(() => refresh(), 30000);
    return () => clearInterval(timer.current);
  }, [open, refresh]);

  const handleCallAction = useCallback(async (uuid, action) => {
    try {
      if (action === 'hangup') { await liveApi.hangupCall(uuid); showSuccess('Call terminated'); }
      else if (['listen', 'whisper', 'barge'].includes(action)) { await liveApi.spyCall(uuid, action); showSuccess(`Spy (${action}) initiated`); }
      else { await liveApi.callAction(uuid, action); showSuccess(`Action "${action}" executed`); }
      setTimeout(() => refresh(), 1000);
    } catch (err) {
      showError(`Action failed: ${err.message}`);
    }
    setActionAnchor(null);
    setActionUuid(null);
  }, [refresh, showSuccess, showError]);

  const actionsColumn = useMemo(() => ({
    field: '_actions', headerName: 'Actions', width: 180, sortable: false, filterable: false,
    renderCell: (params) => {
      const uuid = params.row.uuid || params.row.call_uuid;
      if (!uuid) return null;
      const stop = (fn) => (e) => { e.stopPropagation(); fn(); };
      return (
        <Box sx={{ display: 'flex', gap: 0.25 }}>
          <Tooltip title="Listen"><IconButton size="small" onClick={stop(() => handleCallAction(uuid, 'listen'))} sx={{ color: '#2196f3' }}><HearingIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Whisper"><IconButton size="small" onClick={stop(() => handleCallAction(uuid, 'whisper'))} sx={{ color: '#ff9800' }}><RecordVoiceOverIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Barge"><IconButton size="small" onClick={stop(() => handleCallAction(uuid, 'barge'))} sx={{ color: '#9c27b0' }}><GroupsIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="Hangup"><IconButton size="small" onClick={stop(() => handleCallAction(uuid, 'hangup'))} sx={{ color: '#f44336' }}><CallEndIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title="More"><IconButton size="small" onClick={(e) => { e.stopPropagation(); setActionAnchor(e.currentTarget); setActionUuid(uuid); }} sx={{ color: '#666' }}><MoreVertIcon fontSize="small" /></IconButton></Tooltip>
        </Box>
      );
    },
  }), [handleCallAction]);

  const columns = useMemo(() => [actionsColumn, ...callColumns], [actionsColumn, callColumns]);

  const filtered = useMemo(() => {
    let rows = calls;
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((row) => Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q)));
    }
    if (groupBy && groupFilter) {
      rows = rows.filter((row) => String(row[groupBy] ?? '—') === groupFilter);
    }
    return rows;
  }, [calls, search, groupBy, groupFilter]);

  // Counts per value of the group-by field, over ALL current live calls
  // (search applies, the group filter itself doesn't — so counts stay stable).
  const groupCounts = useMemo(() => {
    if (!groupBy) return [];
    const base = search
      ? calls.filter((row) => Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(search.toLowerCase())))
      : calls;
    const counts = new Map();
    base.forEach((row) => {
      const key = String(row[groupBy] ?? '—');
      counts.set(key, (counts.get(key) || 0) + 1);
    });
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [calls, search, groupBy]);

  // Clear a stale group filter when switching group-by
  useEffect(() => { setGroupFilter(null); }, [groupBy]);

  return (
    <Box>
      <LiveChartStrip
        chartType="live_calls"
        title="Live Calls Over Time"
        series={[
          { field: 'incoming', name: 'Incoming', color: '#10b981' },
          { field: 'outgoing', name: 'Outgoing', color: '#8b5cf6' },
        ]}
      />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, my: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          placeholder="Filter live calls..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          sx={{ width: { xs: '100%', sm: 320 } }}
          InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: '#999' }} /></InputAdornment>) }}
        />
        <Typography variant="caption" sx={{ color: '#999', fontWeight: 600, ml: 1 }}>Group by</Typography>
        {GROUP_BY_OPTIONS.map((opt) => (
          <Chip
            key={opt.key}
            label={opt.label}
            size="small"
            variant={groupBy === opt.key ? 'filled' : 'outlined'}
            color={groupBy === opt.key ? 'primary' : 'default'}
            onClick={() => setGroupBy((prev) => (prev === opt.key ? null : opt.key))}
            sx={{ cursor: 'pointer', fontWeight: groupBy === opt.key ? 600 : 400 }}
          />
        ))}
      </Box>

      {/* Live breakdown of the current calls by the chosen field; clicking a
          group filters the grid to it (click again to clear). */}
      {groupBy && groupCounts.length > 0 && (
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          {groupCounts.map(([value, count]) => (
            <Chip
              key={value}
              label={`${value}: ${count}`}
              size="small"
              variant={groupFilter === value ? 'filled' : 'outlined'}
              color={groupFilter === value ? 'secondary' : 'default'}
              onClick={() => setGroupFilter((prev) => (prev === value ? null : value))}
              sx={{ cursor: 'pointer' }}
            />
          ))}
        </Box>
      )}

      {error && (
        <Alert severity={isNodeError ? 'info' : 'error'} sx={{ mb: 2 }} action={!isNodeError && <Button color="inherit" size="small" onClick={refresh}>Retry</Button>}>
          {isNodeError ? 'No switch node is assigned to this customer. Assign a FreeSwitch node (Home → Live Calls) to enable live monitoring.' : error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flexGrow: 1 }}>
          {!loading && filtered.length === 0 ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, color: '#999', border: '1px dashed #e0e0e0', borderRadius: 2, backgroundColor: '#fff' }}>
              <PhoneInTalkIcon sx={{ fontSize: 48, mb: 1, opacity: 0.35 }} />
              <Typography variant="body1" sx={{ fontWeight: 500 }}>
                {search ? 'No live calls match your filter' : 'No active calls right now'}
              </Typography>
              <Typography variant="body2" sx={{ mt: 0.5, color: '#bbb' }}>
                New calls appear here automatically · refreshes every 30s
              </Typography>
            </Box>
          ) : (
            <Box sx={{ height: 'calc(100vh - 320px)', minHeight: 300 }}>
              <DataGrid
                rows={filtered}
                columns={columns}
                pageSize={50}
                rowsPerPageOptions={[25, 50, 100]}
                loading={loading}
                disableSelectionOnClick
                getRowId={getRowId}
                rowHeight={44}
                onRowClick={(params) => setSelectedRow(params.row)}
                sx={gridSx}
              />
            </Box>
          )}
          <Typography variant="caption" sx={{ color: '#999', mt: 0.5, display: 'block' }}>
            {search ? `Showing ${filtered.length} of ${totalCount}` : `${totalCount} live call${totalCount === 1 ? '' : 's'}`} · auto-refreshes every 30s
          </Typography>
        </Box>
        {selectedRow && <LiveRowDetail row={selectedRow} onClose={() => setSelectedRow(null)} />}
      </Box>

      <Menu anchorEl={actionAnchor} open={Boolean(actionAnchor)} onClose={() => setActionAnchor(null)}>
        <MenuItem onClick={() => handleCallAction(actionUuid, 'mute')}><ListItemIcon><MicOffIcon fontSize="small" /></ListItemIcon><ListItemText>Mute</ListItemText></MenuItem>
        <MenuItem onClick={() => handleCallAction(actionUuid, 'unmute')}><ListItemIcon><MicIcon fontSize="small" /></ListItemIcon><ListItemText>Unmute</ListItemText></MenuItem>
        <MenuItem onClick={() => handleCallAction(actionUuid, 'hold')}><ListItemIcon><PauseIcon fontSize="small" /></ListItemIcon><ListItemText>Hold</ListItemText></MenuItem>
        <MenuItem onClick={() => handleCallAction(actionUuid, 'unhold')}><ListItemIcon><PlayArrowIcon fontSize="small" /></ListItemIcon><ListItemText>Unhold</ListItemText></MenuItem>
      </Menu>
    </Box>
  );
};

export default LiveCallsPanel;
