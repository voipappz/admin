import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Box, Typography, Alert, Button, Paper, IconButton, TextField, InputAdornment } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import { useLiveRegistrations } from '../useLiveRegistrations';
import { stripedDataGridSx } from '../../shared/tableTheme.jsx';
import LiveChartStrip from '../LiveChartStrip';

const gridSx = {
  ...stripedDataGridSx,
  backgroundColor: 'var(--mui-palette-background-paper)', color: 'var(--mui-palette-text-primary)', border: '1px solid var(--mui-palette-divider)',
  '& .MuiDataGrid-cell': { color: 'var(--mui-palette-text-primary)', borderColor: 'var(--mui-palette-divider)', cursor: 'pointer' },
  '& .MuiDataGrid-columnHeader': { backgroundColor: 'var(--mui-palette-surface-muted)', color: 'var(--mui-palette-text-primary)', borderColor: 'var(--mui-palette-divider)' },
  '& .MuiDataGrid-footerContainer': { backgroundColor: 'var(--mui-palette-surface-muted)', color: 'var(--mui-palette-text-primary)', borderColor: 'var(--mui-palette-divider)' },
};

const getRowId = (row) => row.id || row.uuid || `row-${Math.random().toString(36).slice(2, 11)}`;

const RegDetail = ({ row, onClose }) => (
  <Paper elevation={0} sx={{ width: 300, flexShrink: 0, border: '1px solid var(--mui-palette-divider)', borderRadius: 2, p: 2, backgroundColor: 'var(--mui-palette-background-paper)', overflowY: 'auto' }}>
    <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'var(--mui-palette-text-primary)', flexGrow: 1 }}>Registration Detail</Typography>
      <IconButton size="small" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
    </Box>
    {Object.entries(row).filter(([, v]) => v !== null && v !== undefined && v !== '' && typeof v !== 'object').map(([k, v]) => (
      <Box key={k} sx={{ display: 'flex', py: 0.5, borderBottom: '1px solid var(--mui-palette-divider)' }}>
        <Typography variant="caption" sx={{ width: 110, flexShrink: 0, color: 'var(--mui-palette-text-secondary)', fontFamily: 'monospace', fontSize: 11, fontWeight: 600 }}>{k}</Typography>
        <Typography variant="caption" sx={{ color: '#111', wordBreak: 'break-all' }}>{String(v)}</Typography>
      </Box>
    ))}
  </Paper>
);

/**
 * LiveRegistrationsPanel — self-contained SIP-registrations monitor. Extracted
 * from the Home "SIP Registrations" tab so it can pop out on the Devices screen.
 */
const LiveRegistrationsPanel = ({ open = true }) => {
  const { registrations, columns: regColumns, loading, error, isNodeError, totalCount, refresh } = useLiveRegistrations(open);
  const [search, setSearch] = useState('');
  const [selectedRow, setSelectedRow] = useState(null);

  const timer = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    timer.current = setInterval(() => refresh(), 30000);
    return () => clearInterval(timer.current);
  }, [open, refresh]);

  const filtered = useMemo(() => {
    if (!search) return registrations;
    const q = search.toLowerCase();
    return registrations.filter((row) => Object.values(row).some((v) => v != null && String(v).toLowerCase().includes(q)));
  }, [registrations, search]);

  return (
    <Box>
      <LiveChartStrip
        chartType="live_registrations"
        title="SIP Registrations Over Time"
        series={[{ field: 'registrations', name: 'Registrations', color: '#06b6d4' }]}
      />

      <TextField
        size="small"
        placeholder="Filter registrations..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        sx={{ my: 2, width: { xs: '100%', sm: 320 } }}
        InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon sx={{ color: 'var(--mui-palette-text-secondary)' }} /></InputAdornment>) }}
      />

      {error && (
        <Alert severity={isNodeError ? 'info' : 'error'} sx={{ mb: 2 }} action={!isNodeError && <Button color="inherit" size="small" onClick={refresh}>Retry</Button>}>
          {isNodeError ? 'No switch node is assigned to this customer. Assign a FreeSwitch node (Home → Registrations) to view SIP registrations.' : error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2 }}>
        <Box sx={{ flexGrow: 1, height: 'calc(100vh - 320px)', minHeight: 300 }}>
          <DataGrid
            rows={filtered}
            columns={regColumns}
            pageSize={50}
            rowsPerPageOptions={[25, 50, 100]}
            loading={loading}
            disableSelectionOnClick
            getRowId={getRowId}
            rowHeight={44}
            onRowClick={(params) => setSelectedRow(params.row)}
            sx={gridSx}
          />
          <Typography variant="caption" sx={{ color: 'var(--mui-palette-text-secondary)', mt: 0.5, display: 'block' }}>
            {search ? `Showing ${filtered.length} of ${totalCount}` : `${totalCount} registration${totalCount === 1 ? '' : 's'}`} · auto-refreshes every 30s
          </Typography>
        </Box>
        {selectedRow && <RegDetail row={selectedRow} onClose={() => setSelectedRow(null)} />}
      </Box>
    </Box>
  );
};

export default LiveRegistrationsPanel;
