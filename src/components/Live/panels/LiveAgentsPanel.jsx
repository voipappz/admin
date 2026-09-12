import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, Alert, Button, Chip, Paper, IconButton, TextField, InputAdornment } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import PeopleIcon from '@mui/icons-material/People';
import CloseIcon from '@mui/icons-material/Close';
import { useLiveAgents } from '../useLiveAgents';
import { useCustomerEnvironment } from '../../../context/CustomerEnvironmentContext';
import { stripedDataGridSx } from '../../shared/tableTheme.jsx';
import LiveChartStrip from '../LiveChartStrip';

const gridSx = {
  ...stripedDataGridSx,
  backgroundColor: '#fff', color: '#333', border: '1px solid #e0e0e0',
  '& .MuiDataGrid-cell': { color: '#333', borderColor: '#e0e0e0', cursor: 'pointer' },
  '& .MuiDataGrid-columnHeader': { backgroundColor: '#f5f5f5', color: '#333', borderColor: '#e0e0e0' },
  '& .MuiDataGrid-footerContainer': { backgroundColor: '#f5f5f5', color: '#333', borderColor: '#e0e0e0' },
};

const getRowId = (row) => row.id || row.uuid || `row-${Math.random().toString(36).slice(2, 11)}`;

const statusColor = (v) =>
  v === 'Available' || v === 'available' ? 'success' :
  v === 'Busy' || v === 'busy' ? 'error' :
  v === 'On Break' ? 'warning' : 'default';

const AGENT_COLUMNS = [
  { field: 'fullname', headerName: 'Name', width: 180 },
  { field: 'username', headerName: 'Device', width: 120 },
  { field: 'status_name', headerName: 'Status', width: 140, renderCell: (p) => <Chip label={p.value || 'Unknown'} size="small" color={statusColor(p.value)} /> },
  { field: 'state', headerName: 'State', width: 160, renderCell: (p) => p.value ? <Chip label={p.value} size="small" variant="outlined" color={p.value === 'Waiting' ? 'success' : p.value === 'In a queue call' ? 'error' : p.value === 'On Break' ? 'warning' : 'default'} /> : '' },
];

const AgentDetail = ({ row, onClose }) => (
  <Paper elevation={0} sx={{ width: 300, flexShrink: 0, border: '1px solid #e0e0e0', borderRadius: 2, p: 2, backgroundColor: '#fff', overflowY: 'auto' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: '#333', flexGrow: 1 }}>Agent Detail</Typography>
      <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
    </Box>
    {Object.entries(row).filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object').map(([k, v]) => (
      <Box key={k} sx={{ display: 'flex', py: 0.5, borderBottom: '1px solid #f1f5f9' }}>
        <Typography variant="caption" sx={{ width: 110, flexShrink: 0, color: '#6b7280', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{k}</Typography>
        <Typography variant="caption" sx={{ color: '#111', wordBreak: 'break-all' }}>{String(v)}</Typography>
      </Box>
    ))}
  </Paper>
);

/**
 * LiveAgentsPanel — self-contained live-agents monitor. Extracted from the Home
 * "Live Agents" tab so it can pop out on the Users screen. Requires a selected
 * Application (environment), same as Home.
 */
const LiveAgentsPanel = ({ open = true }) => {
  const { selectedEnvironments } = useCustomerEnvironment();
  const environmentUuid = selectedEnvironments?.[0]?.uuid || null;
  const { agents, loading, error, totalCount, statistics, refresh } = useLiveAgents(open, environmentUuid);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const timer = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    timer.current = setInterval(() => refresh(), 30000);
    return () => clearInterval(timer.current);
  }, [open, refresh]);

  const filtered = useMemo(() => {
    if (!search) return agents;
    const q = search.toLowerCase();
    return agents.filter((row) => Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q)));
  }, [agents, search]);

  if (!environmentUuid) {
    return (
      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 8, color: '#999' }}>
        <PeopleIcon sx={{ fontSize: 48, mb: 1, opacity: 0.4 }} />
        <Typography variant="body1" sx={{ fontWeight: 500 }}>Select an Application to view live agents</Typography>
        <Typography variant="body2" sx={{ mt: 0.5, color: '#bbb' }}>Use the Application selector in the top header</Typography>
      </Box>
    );
  }

  return (
    <Box>
      <LiveChartStrip
        chartType="user_stats"
        title="Agent Call Activity"
        series={[
          { field: 'call_incoming_count', name: 'Incoming', color: '#10b981' },
          { field: 'call_outgoing_count', name: 'Outgoing', color: '#8b5cf6' },
          { field: 'live_calls_counter', name: 'Live Calls', color: '#f59e0b' },
        ]}
      />

      <Box sx={{ display: 'flex', gap: 0.5, my: 1, flexWrap: 'wrap' }}>
        {statistics.available > 0 && <Chip label={`${statistics.available} Available`} size="small" color="success" variant="outlined" />}
        {statistics.onCall > 0 && <Chip label={`${statistics.onCall} On Call`} size="small" color="error" variant="outlined" />}
        {statistics.onBreak > 0 && <Chip label={`${statistics.onBreak} On Break`} size="small" color="warning" variant="outlined" />}
      </Box>

      <TextField
        size="small"
        placeholder="Filter agents..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ mb: 2, width: { xs: '100%', sm: 320 } }}
        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: '#999' }} /></InputAdornment>) }}
      />

      {error && <Alert severity="error" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={refresh}>Retry</Button>}>{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flexGrow: 1, height: 'calc(100vh - 340px)', minHeight: 300 }}>
          <DataGrid
            rows={filtered}
            columns={AGENT_COLUMNS}
            pageSize={50}
            rowsPerPageOptions={[25, 50, 100]}
            loading={loading}
            disableSelectionOnClick
            getRowId={getRowId}
            rowHeight={44}
            onRowClick={(params) => setSelectedRow(params.row)}
            sx={gridSx}
          />
          <Typography variant="caption" sx={{ color: '#999', mt: 0.5, display: 'block' }}>
            {search ? `Showing ${filtered.length} of ${totalCount}` : `${totalCount} agent${totalCount === 1 ? '' : 's'}`} · auto-refreshes every 30s
          </Typography>
        </Box>
        {selectedRow && <AgentDetail row={selectedRow} onClose={() => setSelectedRow(null)} />}
      </Box>
    </Box>
  );
};

export default LiveAgentsPanel;
