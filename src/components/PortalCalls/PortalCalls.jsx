// PortalCalls — the portal user's call history (/my-calls).
//
// Built from the admin Calls screen's parts (src/components/Calls): the same
// column renderers, mobile cards, detail panel and recording dialog, so a call
// looks the same on both surfaces. The focused direction/cause filters and
// summary use the same server-side call search and aggregate paths as admin.
//
// Reads /api/calls — the same endpoint the admin Calls screen pages through,
// with the same `search[created_at]` range format. For a portal user the API
// answers with its :portal_list serializer, where the call's facts (caller,
// callee, direction, cause, durations) are nested under `profile` exactly as
// in the admin :list shape — so the rows go to the shared renderers as-is.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, IconButton, InputAdornment, MenuItem,
  Paper, Stack, TextField, Tooltip, Typography, useMediaQuery, useTheme
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import SearchIcon from '@mui/icons-material/Search';
import CallIcon from '@mui/icons-material/Call';
import PageHeader from '../common/PageHeader.jsx';
import { callsApi } from '../../services/api/callsApi';
import { useSoftphone } from '../../context/SoftphoneContext';
import useColumnHandlers from '../Calls/ColumnHandlers/useColumnHandlers.jsx';
import useRecordingHandlers from '../Calls/RecordingHandlers/useRecordingHandlers.js';
import { DirectionIcon, CauseIcon, RecordingControls } from '../Calls/CallIcons.jsx';
import CallMobileView from '../Calls/CallMobileView/CallMobileView.jsx';
import CallDetailPanel from '../Calls/CallDetailPanel/CallDetailPanel.jsx';
import RecordingDialog from '../Calls/RecordingDialog/RecordingDialog.jsx';
import CallStatCard from '../Calls/CallStatCard.jsx';
import '../Calls/Calls.css';
import '../Calls/CellWithHover/CellWithHover.css';

const PER_PAGE = 25;

const RANGES = [
  { value: 1, label: 'Today' },
  { value: 7, label: 'Last 7 days' },
  { value: 30, label: 'Last 30 days' },
  { value: 0, label: 'All time' }
];

// The admin column definitions (voipappz-api Call.columns) that make sense to
// an end user, in the same shape the admin grid gets from ?action=columns —
// which the portal-user branch of the API does not serve. `actions` renders
// the call-back button below.
const PORTAL_COLUMNS = [
  { name: 'Created At', type: 'date', field: 'call.created_at', prop: 'created_at', sort_by: 'created_at', selected: true },
  { name: 'Direction', type: 'sub_object', field: 'call.direction', prop: 'profile', sub_prop: 'direction', selected: true },
  { name: 'Caller', type: 'sub_object', field: 'call.caller', prop: 'profile', sub_prop: 'caller', selected: true },
  { name: 'Callee', type: 'sub_object', field: 'call.callee', prop: 'profile', sub_prop: 'callee', selected: true },
  { name: 'Talk Duration', type: 'sub_object', field: 'call.talk_duration', prop: 'profile', sub_prop: 'talk_duration', selected: true },
  { name: 'Cause', type: 'sub_object', field: 'call.cause', prop: 'profile', sub_prop: 'cause', selected: true },
  { name: '', type: 'special', field: 'actions', prop: 'actions', selected: true },
];

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

// The other party: whoever called in, or whoever was called.
const counterparty = (call) => {
  const p = call?.profile || {};
  const inbound = /^in/i.test(p.direction || '');
  return (inbound ? p.caller : p.callee) || p.caller || p.callee || '';
};

const segmentOptions = (segments, name, fallback = []) => {
  const values = segments.find((segment) => segment.name === name)?.data;
  if (!Array.isArray(values) || values.length === 0) return fallback;
  return values.map((item) => typeof item === 'object'
    ? { value: String(item.value ?? item.uuid ?? item.name ?? ''), label: item.name ?? item.value ?? item.uuid }
    : { value: String(item), label: String(item).replaceAll('_', ' ') }
  ).filter((item) => item.value);
};

export default function PortalCalls() {
  const { dial, connected } = useSoftphone();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [calls, setCalls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [direction, setDirection] = useState('');
  const [cause, setCause] = useState('');
  const [days, setDays] = useState(7);
  const [sortModel, setSortModel] = useState([{ field: 'created_at', sort: 'desc' }]);
  const [summary, setSummary] = useState(null);
  const [segments, setSegments] = useState([]);
  const [page, setPage] = useState(1);
  const [selectedCall, setSelectedCall] = useState(null);

  const {
    recordingDialogOpen,
    selectedRecording,
    handleOpenRecording,
    handleCloseRecording,
  } = useRecordingHandlers();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = { page, per_page: PER_PAGE, order_by: 'created_at', order_type: sortModel[0]?.sort || 'desc' };
      if (days > 0) params['search[created_at]'] = createdAtRange(days);
      if (direction) params['search[call.direction][IS]'] = direction;
      if (cause === 'abandoned') params['search[call.disposition][IS]'] = cause;
      else if (cause) params['search[call.cause][IS]'] = cause;
      const res = await callsApi.getCalls(params);
      const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setCalls(rows.map((r, i) => ({ ...r, id: r.uuid || r.id || `${page}-${i}` })));
    } catch {
      // Never "no calls in this period" here — that reads as "you had none".
      setError('Could not load your calls. Please try again in a moment.');
      setCalls([]);
    } finally {
      setLoading(false);
    }
  }, [days, page, direction, cause, sortModel]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    callsApi.getSegments()
      .then((data) => setSegments(Array.isArray(data) ? data : data?.data || []))
      .catch(() => setSegments([]));
  }, []);

  const directionOptions = useMemo(() => segmentOptions(segments, 'call.direction', [
    { value: 'incoming', label: 'Incoming' },
    { value: 'outgoing', label: 'Outgoing' },
  ]), [segments]);
  const causeOptions = useMemo(() => {
    const options = segmentOptions(segments, 'call.cause', [
      { value: 'answer', label: 'Answered' },
      { value: 'no_answer', label: 'No answer' },
    ]);
    return options.some((option) => option.value === 'abandoned')
      ? options
      : [...options, { value: 'abandoned', label: 'Abandoned' }];
  }, [segments]);

  useEffect(() => {
    const params = { group_by: 'cause' };
    if (days > 0) {
      const [from, to] = createdAtRange(days).split(' - ');
      params.from = from;
      params.to = to;
    }
    if (direction) params['search[call.direction][IS]'] = direction;
    if (cause === 'abandoned') params['search[call.disposition][IS]'] = cause;
    else if (cause) params['search[call.cause][IS]'] = cause;
    callsApi.getAggregate(params)
      .then((data) => {
        const buckets = Array.isArray(data) ? data : data?.cause || [];
        const counts = buckets.reduce((total, bucket) => Object.entries(bucket).reduce(
          (sum, [key, value]) => key === 'time' ? sum : { ...sum, [key]: (sum[key] || 0) + (Number(value) || 0) }, total
        ), {});
        const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
        setSummary({ total, answered: counts.answer || 0, noAnswer: Math.max(total - (counts.answer || 0), 0) });
      })
      .catch(() => setSummary(null));
  }, [days, direction, cause]);

  // No reliable total from this client, so a full page is the signal that
  // another one may exist.
  const hasNext = calls.length === PER_PAGE;

  // Filtering client-side keeps the box responsive on a list this size, and
  // avoids guessing which of the API's many search params maps to "number".
  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return calls;
    return calls.filter(({ profile: p = {} }) =>
      (!direction || p.direction === direction) &&
      (!cause || (cause === 'abandoned' ? p.disposition === cause : p.cause === cause)) &&
      [p.caller, p.callee, p.cause, p.disposition, p.direction]
        .some((v) => String(v || '').toLowerCase().includes(q))
    );
  }, [calls, search, direction, cause]);

  const callBack = useCallback((number) => {
    if (number) dial(number).catch(() => { /* surfaced in the phone */ });
  }, [dial]);

  // The grid's `actions` column: CallActions' slot, filled with a call-back
  // button instead of the admin's note/transfer menu.
  const CallBackAction = useMemo(() => {
    const Action = ({ call }) => {
      const inbound = /^in/i.test(call.direction || '');
      const number = (inbound ? call.caller_number : call.destination_number)
        || call.caller_number || call.destination_number;
      return (
        <Tooltip title={connected ? `Call ${number || ''}` : 'Phone not registered'}>
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
      );
    };
    return Action;
  }, [connected, callBack]);

  const { visibleColumns, createGridColumns } = useColumnHandlers(handleOpenRecording, undefined, {}, PORTAL_COLUMNS, []);

  const gridColumns = useMemo(
    () => createGridColumns(visibleColumns, DirectionIcon, CauseIcon, RecordingControls, CallBackAction, undefined),
    [visibleColumns, createGridColumns, CallBackAction]
  );

  const selectedNumber = counterparty(selectedCall);
  const closeDetail = () => setSelectedCall(null);
  const detailPanel = selectedCall && (
    <CallDetailPanel
      call={selectedCall}
      onClose={closeDetail}
      onOpenRecording={handleOpenRecording}
      onCallBack={selectedNumber && connected ? () => callBack(selectedNumber) : undefined}
      isMobile={isMobile}
    />
  );

  const emptyText = calls.length === 0 ? 'No calls in this period.' : 'No calls match that search.';

  const renderList = () => {
    if (loading && calls.length === 0) {
      return <Box sx={{ py: 8, textAlign: 'center' }}><CircularProgress size={28} /></Box>;
    }
    if (error) {
      return <Typography variant="body2" sx={{ p: 2, color: 'error.main' }}>{error}</Typography>;
    }
    if (visible.length === 0) {
      return (
        <Typography variant="body2" color="text.secondary" sx={{ py: 8, textAlign: 'center' }}>
          {emptyText}
        </Typography>
      );
    }
    if (isMobile) {
      return (
        <CallMobileView
          rows={visible}
          onOpenRecording={handleOpenRecording}
          onRowClick={(call) => setSelectedCall(call)}
          hasNextPage={false}
        />
      );
    }
    return (
      <Box sx={{ display: 'flex', gap: 0, alignItems: 'stretch' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <DataGrid
            rows={visible}
            columns={gridColumns}
            loading={loading}
            onRowClick={(params) => setSelectedCall(params.row)}
            hideFooter
            autoHeight
            // One page is at most PER_PAGE rows: render them all, which also
            // keeps the grid measurable where there is no layout (tests).
            disableVirtualization
            disableRowSelectionOnClick
            sortingMode="server"
            sortModel={sortModel}
            onSortModelChange={(next) => { setSortModel(next.length ? next : [{ field: 'created_at', sort: 'desc' }]); setPage(1); }}
            rowHeight={44}
            sx={{
              border: 0,
              backgroundColor: 'var(--widget-content-bg)',
              fontSize: '12px',
              '& .MuiDataGrid-columnHeader': {
                backgroundColor: 'var(--widget-header-bg)',
                color: 'var(--theme-text-primary)',
              },
              '& .MuiDataGrid-columnHeaderTitle': { fontSize: '11px', fontWeight: 700, letterSpacing: '0.02em' },
              '& .MuiDataGrid-cell': {
                borderBottom: '1px solid var(--theme-border)',
                color: 'var(--theme-text-primary)',
              },
              '& .MuiDataGrid-row': {
                cursor: 'pointer',
                '&:nth-of-type(even)': { backgroundColor: 'var(--theme-bg-secondary)' },
                '&:hover': { backgroundColor: 'var(--theme-hover)' },
              },
            }}
          />
        </Box>
        {detailPanel}
      </Box>
    );
  };

  return (
    <Box data-testid="portal-calls-page" sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: 1440, mx: 'auto' }}>
      <PageHeader
        title="Calls"
        subtitle="Your call history"
        actions={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            <TextField
              size="small" placeholder="Search number or cause"
              value={search} onChange={(e) => setSearch(e.target.value)}
              data-testid="portal-calls-search"
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
              sx={{ minWidth: { sm: 240 } }}
            />
            <TextField
              select size="small" value={days} onChange={(e) => { setDays(Number(e.target.value)); setPage(1); }}
              data-testid="portal-calls-range" sx={{ minWidth: { sm: 150 } }}
            >
              {RANGES.map((r) => <MenuItem key={r.value} value={r.value}>{r.label}</MenuItem>)}
            </TextField>
          </Stack>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.25, flexWrap: { sm: 'wrap' } }}>
        <TextField select size="small" label="Direction" value={direction} onChange={(e) => { setDirection(e.target.value); setPage(1); }} sx={{ minWidth: 130, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All</MenuItem>
          {directionOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Cause" value={cause} onChange={(e) => { setCause(e.target.value); setPage(1); }} sx={{ minWidth: 150, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All</MenuItem>
          {causeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        {(direction || cause) && <Chip label="Clear filters" onDelete={() => { setDirection(''); setCause(''); setPage(1); }} />}
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.25, flexWrap: { sm: 'wrap' } }}>
        <CallStatCard label="Total" value={summary?.total} color="var(--counter-total)" tooltip="Calls matching the current filters" />
        <CallStatCard label="Answered" value={summary?.answered} color="var(--counter-answered)" tooltip="Answered calls matching the current filters" />
        <CallStatCard label="No Answer" value={summary?.noAnswer} color="var(--counter-no-answer)" tooltip="Unanswered calls matching the current filters" />
      </Stack>

      {/* On a phone the detail panel takes the whole screen, as on admin Calls. */}
      {isMobile && detailPanel ? detailPanel : (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          {renderList()}

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
      )}

      <RecordingDialog
        open={recordingDialogOpen}
        selectedRecording={selectedRecording}
        onClose={handleCloseRecording}
      />
    </Box>
  );
}
