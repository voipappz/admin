// PortalCalls — the portal user's call history (/my-calls).
//
// Deliberately NOT the admin Calls screen (src/components/Calls/Calls.jsx):
// that one is built around dynamic field configs, saved segments and 50+
// filter parameters, which is the opposite of what an end user needs. This
// is the four things they actually do: find a call, see how it went, play it
// back, call the person again.
//
// Reads /api/calls — the same endpoint the admin Calls screen pages through,
// with the same `search[created_at]` range format — so the portal's history
// and the console's agree. It used to read the InfluxDB `cdr` measurement,
// which is missing on older API builds and left this screen empty there.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, Drawer, IconButton, InputAdornment, MenuItem,
  Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import CallIcon from '@mui/icons-material/Call';
import CallMadeIcon from '@mui/icons-material/CallMade';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CloseIcon from '@mui/icons-material/Close';
import PageHeader from '../common/PageHeader.jsx';
import StatusChip from '../common/StatusChip.jsx';
import { callsApi } from '../../services/api/callsApi';
import { mapRecentCall } from '../Dashboard/useDashboardSnapshot.js';
import { useSoftphone } from '../../context/SoftphoneContext';

const PER_PAGE = 25;

const RANGES = [
  { value: 1, label: 'Today' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 0, label: 'All time' }
];

const fmtDateTime = (value) => {
  const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(String(value)) ? value : `${value}Z`);
  return Number.isNaN(d.getTime()) ? String(value || '—') : d.toLocaleString();
};

const fmtDuration = (seconds) => {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// Same range format the admin Calls screen sends: unix seconds, local day
// boundaries, "start - end". "All time" sends no range at all.
const createdAtRange = (days) => {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return `${Math.floor(start.getTime() / 1000)} - ${Math.floor(end.getTime() / 1000)}`;
};

const counterparty = (call) => {
  const inbound = /in/i.test(call.direction || '');
  return (inbound ? call.from_number : call.to_number) || call.from_number || call.to_number || '';
};

export default function PortalCalls() {
  const { dial, connected } = useSoftphone();
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(7);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: PER_PAGE };
      if (days > 0) params['search[created_at]'] = createdAtRange(days);
      const res = await callsApi.getCalls(params);
      const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setCalls(rows.map(mapRecentCall));
    } catch {
      // Never "no calls in this period" here — that reads as "you had none".
      setError('Could not load your calls. Please try again in a moment.');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [days, page]);

  useEffect(() => { load(); }, [load]);

  // No reliable total from this client, so a full page is the signal that
  // another one may exist.
  const hasNext = calls.length === PER_PAGE;

  // Filtering client-side keeps the box responsive on a list this size, and
  // avoids guessing which of the API's many search params maps to "number".
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter((c) =>
      [c.from_number, c.to_number, c.status, c.direction]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [calls, search]);

  const callBack = (number) => { if (number) dial(number).catch(() => { /* surfaced in the phone */ }); };

  return (
    <Box data-testid="portal-calls-page" sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        title="Calls"
        subtitle="Your call history"
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <TextField
              size="small" placeholder="Search number or status"
              value={search} onChange={(e) => setSearch(e.target.value)}
              data-testid="portal-calls-search"
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: 240 }}
            />
            <TextField
              select size="small" value={days} onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
              data-testid="portal-calls-range" sx={{ minWidth: 150 }}
            >
              {RANGES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </Stack>
        }
      />

      <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
        {error && (
          <Typography variant="body2" sx={{ p: 2, color: 'error.main' }}>{error}</Typography>
        )}

        {loading && calls.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={28} /></Box>
        ) : visible.length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
            {calls.length === 0 ? 'No calls in this period.' : 'No calls match that search.'}
          </Typography>
        ) : (
          <Box sx={{ overflowX: 'auto' }}>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Number</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 700 }} align="right">Duration</TableCell>
                  <TableCell />
                </TableRow>
              </TableHead>
              <TableBody>
                {visible.map((call) => {
                  const number = counterparty(call);
                  const inbound = /in/i.test(call.direction || '');
                  return (
                    <TableRow
                      key={call.id} hover sx={{ cursor: 'pointer' }}
                      onClick={() => setSelected(call)} data-testid="portal-calls-row"
                    >
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>{fmtDateTime(call.started_at)}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Stack direction="row" spacing={0.75} alignItems="center">
                          {inbound
                            ? <CallReceivedIcon fontSize="small" color="info" />
                            : <CallMadeIcon fontSize="small" color="success" />}
                          <span style={{ direction: 'ltr' }}>{number || '—'}</span>
                        </Stack>
                      </TableCell>
                      <TableCell><StatusChip status={call.status} variant="outlined" /></TableCell>
                      <TableCell align="right" sx={{ fontVariantNumeric: 'tabular-nums' }}>{fmtDuration(call.duration_sec)}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={connected ? `Call ${number}` : 'Phone not registered'}>
                          <span>
                            <IconButton
                              size="small" color="success" disabled={!number || !connected}
                              onClick={(e) => { e.stopPropagation(); callBack(number); }}
                              data-testid="portal-calls-dial"
                            >
                              <CallIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Box>
        )}

        {(page > 1 || hasNext) && !error && (
          <Stack
            direction="row" spacing={1} alignItems="center" justifyContent="flex-end"
            sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}
          >
            <Typography variant="body2" color="text.secondary">Page {page}</Typography>
            <Button
              size="small" disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))} data-testid="portal-calls-prev"
            >
              Previous
            </Button>
            <Button
              size="small" disabled={!hasNext || loading}
              onClick={() => setPage((p) => p + 1)} data-testid="portal-calls-next"
            >
              Next
            </Button>
          </Stack>
        )}
      </Paper>

      <Drawer anchor="right" open={Boolean(selected)} onClose={() => setSelected(null)}>
        <Box sx={{ width: { xs: '100vw', sm: 380 }, p: 2 }} data-testid="portal-call-detail">
          <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>Call detail</Typography>
            <IconButton size="small" onClick={() => setSelected(null)}><CloseIcon fontSize="small" /></IconButton>
          </Stack>
          {selected && (
            <Stack spacing={1.5}>
              <Detail label="When" value={fmtDateTime(selected.started_at)} />
              <Detail label="From" value={selected.from_number || '—'} />
              <Detail label="To" value={selected.to_number || '—'} />
              <Detail label="Direction" value={selected.direction || '—'} />
              <Detail label="Duration" value={fmtDuration(selected.duration_sec)} />
              <Box>
                <Typography variant="caption" color="text.secondary">Status</Typography>
                <Box sx={{ mt: 0.5 }}><StatusChip status={selected.status} /></Box>
              </Box>
              {selected.recording_url ? (
                <Box>
                  <Typography variant="caption" color="text.secondary">Recording</Typography>
                  <Box component="audio" controls src={selected.recording_url} sx={{ width: '100%', mt: 0.5 }} />
                </Box>
              ) : (
                <Chip size="small" variant="outlined" label="No recording" sx={{ alignSelf: 'flex-start' }} />
              )}
              <Button
                variant="contained" color="success" startIcon={<CallIcon />}
                disabled={!counterparty(selected) || !connected}
                onClick={() => callBack(counterparty(selected))}
              >
                Call back
              </Button>
            </Stack>
          )}
        </Box>
      </Drawer>
    </Box>
  );
}

function Detail({ label, value }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary">{label}</Typography>
      <Typography variant="body2" sx={{ direction: 'ltr' }}>{value}</Typography>
    </Box>
  );
}
