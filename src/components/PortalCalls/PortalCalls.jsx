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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import {
  Box, Button, Chip, CircularProgress, IconButton, MenuItem,
  Paper, Stack, TextField, Tooltip, Typography, useMediaQuery, useTheme
} from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';
import { usePortalPreferences } from '../../context/PortalPreferencesContext';
import TimeHistogram from '../../views/syslogs/TimeHistogram';
import { convertAggregateToHistogramFormat } from '../../utils/logFormatting';
import PortalColumnsSelector from './PortalColumnsSelector';
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
import EnhancedDateRangePicker from '../Calls/EnhancedDateRangePicker/EnhancedDateRangePicker.jsx';
import { format, isSameDay } from 'date-fns';
import '../Calls/Calls.css';
import '../Calls/CellWithHover/CellWithHover.css';

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
const PORTAL_COLUMN_KEYS = PORTAL_COLUMNS.map((column) => column.sub_prop ? `${column.prop}.${column.sub_prop}` : column.prop).concat('recording');

// The date range is the admin Calls screen's picker (presets and custom
// dates), carried in the URL as from/to (yyyy-MM-dd) so a filtered view can be
// shared or reloaded. No range in the URL means the preferred default window,
// calls_days back to today. The query format is the admin's: unix seconds,
// local day boundaries, "start - end".
const dayKey = (date) => format(date, 'yyyy-MM-dd');
const parseDay = (value) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
};
const defaultRange = (days) => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - (Math.max(1, days) - 1));
  return [start, end];
};
const createdAtRange = ([start, end]) => {
  const from = Math.floor(new Date(start).setHours(0, 0, 0, 0) / 1000);
  const to = Math.floor(new Date(end).setHours(23, 59, 59, 999) / 1000);
  return `${from} - ${to}`;
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
  const { preferences, ready, save } = usePortalPreferences();
  const [url, setUrl] = useSearchParams();
  const search = url.get('q') || '';
  const direction = url.get('direction') || '';
  const cause = url.get('cause') || '';
  // The memo's deps are the URL STRINGS, never parsed Dates: parseDay builds a
  // new Date on every render, so a Date in the dep list makes the memo miss
  // every time — new range, new filters, another fetch, another render. That
  // is an infinite loop, and it hung the test file rather than failing it.
  const fromParam = url.get('from');
  const toParam = url.get('to');
  const dateRange = useMemo(() => {
    const from = parseDay(fromParam);
    const to = parseDay(toParam);
    return from && to && from <= to ? [from, to] : defaultRange(Number(preferences.calls_days) || 7);
  }, [fromParam, toParam, preferences.calls_days]);
  const singleDay = isSameDay(dateRange[0], dateRange[1]);
  const perPage = Number(preferences.calls_page_size);
  const sort = url.get('sort') === 'asc' ? 'asc' : url.get('sort') === 'desc' ? 'desc' : preferences.calls_sort;
  const sortModel = useMemo(() => [{ field: 'created_at', sort }], [sort]);
  const requestedPage = Number(url.get('page'));
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const setFilters = (patch) => {
    const next = new URLSearchParams(url);
    next.delete('page');
    Object.entries(patch).forEach(([key, value]) => value === '' ? next.delete(key) : next.set(key, String(value)));
    setUrl(next);
    setSelectedCall(null);
  };
  const [summary, setSummary] = useState(null);
  const [buckets, setBuckets] = useState([]);
  const [summaryError, setSummaryError] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [segments, setSegments] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const requestId = useRef(0);
  const filters = useMemo(() => {
    const params = {};
    params['search[created_at]'] = createdAtRange(dateRange);
    if (search) params['search[inline]'] = search;
    if (direction) params['search[call.direction][IS]'] = direction;
    if (cause) params[cause === 'abandoned' ? 'search[call.disposition][IS]' : 'search[call.cause][IS]'] = cause;
    return params;
  }, [dateRange, search, direction, cause]);

  const {
    recordingDialogOpen,
    selectedRecording,
    handleOpenRecording,
    handleCloseRecording,
  } = useRecordingHandlers();

  const load = useCallback(async () => {
    if (!ready) return;
    const current = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const params = { ...filters, page, per_page: perPage, order_by: 'created_at', order_type: sort };
      const res = await callsApi.getCalls(params);
      if (current !== requestId.current) return;
      const rows = Array.isArray(res) ? res : Array.isArray(res?.data) ? res.data : [];
      setCalls(rows.map((r, i) => ({ ...r, id: r.uuid || r.id || `${page}-${i}` })));
    } catch {
      if (current !== requestId.current) return;
      // Never "no calls in this period" here — that reads as "you had none".
      setError('Could not load your calls. Please try again in a moment.');
      setCalls([]);
    } finally {
      if (current === requestId.current) setLoading(false);
    }
  }, [ready, filters, page, perPage, sort]);

  useEffect(() => { load(); return () => { requestId.current += 1; }; }, [load]);
  useEffect(() => { setSelectedCall(null); }, [filters, page]);

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
    if (!ready) return undefined;
    let active = true;
    setSummary(null);
    setBuckets([]);
    setSummaryError(false);
    setSummaryLoading(true);
    const params = { ...filters, group_by: 'cause', interval: singleDay ? 'hour' : 'day' };
    callsApi.getAggregate(params)
      .then((data) => {
        if (!active) return;
        const buckets = Array.isArray(data) ? data : data?.cause || [];
        setBuckets(buckets);
        const counts = buckets.reduce((total, bucket) => Object.entries(bucket).reduce(
          (sum, [key, value]) => key === 'time' ? sum : { ...sum, [key]: (sum[key] || 0) + (Number(value) || 0) }, total
        ), {});
        const total = Object.values(counts).reduce((sum, value) => sum + value, 0);
        setSummary({ total, answered: counts.answer || 0, noAnswer: Math.max(total - (counts.answer || 0), 0) });
      })
      .catch(() => { if (active) setSummaryError(true); })
      .finally(() => { if (active) setSummaryLoading(false); });
    return () => { active = false; };
  }, [ready, filters, singleDay]);

  // Aggregate totals cover the full result; fall back if statistics failed.
  const hasNext = summary ? page * perPage < summary.total : calls.length === perPage;

  // The server filters before pagination; the chart receives the same filters.
  const visible = calls;
  const histogram = useMemo(() => convertAggregateToHistogramFormat(buckets), [buckets]);

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

  const { createGridColumns } = useColumnHandlers(handleOpenRecording, undefined, {}, PORTAL_COLUMNS, []);
  const selectedColumns = useMemo(() => preferences.calls_columns.split(',').filter(Boolean), [preferences.calls_columns]);
  const orderedKeys = useMemo(() => [...selectedColumns, ...PORTAL_COLUMN_KEYS.filter((key) => !selectedColumns.includes(key))], [selectedColumns]);

  const gridColumns = useMemo(
    () => createGridColumns(orderedKeys, DirectionIcon, CauseIcon, RecordingControls, CallBackAction, undefined)
      .map((column) => ({ ...column, sortable: column.field === 'created_at' })),
    [orderedKeys, createGridColumns, CallBackAction]
  );
  const columnVisibilityModel = Object.fromEntries(gridColumns.map((column) => [column.field,
    ['recording', 'actions'].includes(column.field) || selectedColumns.includes(column.field)]));

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
      return <Box role="alert" sx={{ p: 2 }}><Typography color="error">{error}</Typography><Button onClick={load}>Retry</Button></Box>;
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
            columnVisibilityModel={columnVisibilityModel}
            onColumnVisibilityModelChange={(model) => save({ calls_columns: gridColumns.filter((column) => !['recording', 'actions'].includes(column.field) && model[column.field] !== false).map((column) => column.field).join(',') })}
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
            onSortModelChange={(next) => { const value = next[0]?.sort || 'desc'; setFilters({ sort: value }); save({ calls_sort: value }); }}
            rowHeight={preferences.calls_density === 'compact' ? 44 : 56}
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
        {detailPanel && <Box sx={{ flex: '0 0 360px', width: 360, '& .call-detail-panel': { width: '100%' } }}>{detailPanel}</Box>}
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
            <Box data-testid="portal-calls-range">
              <EnhancedDateRangePicker dateRange={dateRange} setDateRange={([start, end]) => setFilters({ from: dayKey(start), to: dayKey(end) })} />
            </Box>
          </Stack>
        }
      />

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.25, flexWrap: { sm: 'wrap' } }}>
        <TextField select size="small" label="Direction" value={direction} onChange={(e) => setFilters({ direction: e.target.value })} sx={{ minWidth: 130, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All</MenuItem>
          {directionOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        <TextField select size="small" label="Outcome" value={cause} onChange={(e) => setFilters({ cause: e.target.value })} sx={{ minWidth: 150, width: { xs: '100%', sm: 'auto' } }}>
          <MenuItem value="">All</MenuItem>
          {causeOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
        </TextField>
        <PortalColumnsSelector columns={gridColumns.filter((column) => !['recording', 'actions'].includes(column.field))} selected={selectedColumns} disabled={!ready} onChange={(keys) => save({ calls_columns: keys.join(',') })} />
        <Button disabled={!ready} onClick={() => save({ calls_chart: preferences.calls_chart === 'true' ? 'false' : 'true' })}>{preferences.calls_chart === 'true' ? 'Hide chart' : 'Show chart'}</Button>
        {(direction || cause) && <Chip label="Clear filters" onDelete={() => setFilters({ direction: '', cause: '' })} />}
        {search && <Chip label={`Search: ${search}`} onDelete={() => setFilters({ q: '' })} />}
      </Stack>

      {summaryError && <Typography role="alert" color="error" sx={{ mb: 2 }}>Call statistics are unavailable. Your call list is shown below.</Typography>}
      {preferences.calls_chart === 'true' && <Paper variant="outlined" sx={{ p: 2, mb: 2, borderRadius: 3 }}>
        <Typography fontWeight={700}>Calls over time</Typography>
        {summaryLoading ? <Box sx={{ p: 3, textAlign: 'center' }}><CircularProgress size={22} /></Box> : summaryError ? <Typography color="text.secondary">Chart could not be loaded.</Typography> : <TimeHistogram logs={[]} aggregateData={histogram} height={130} timeInterval={singleDay ? 'hour' : 'day'} />}
      </Paper>}

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mb: 1.25, flexWrap: { sm: 'wrap' } }}>
        <CallStatCard label="Total" value={summary?.total} color="var(--counter-total)" tooltip="Calls matching the current filters" />
        <CallStatCard label="Answered" value={summary?.answered} color="var(--counter-answered)" tooltip="Answered calls matching the current filters" />
        <CallStatCard label="Unanswered" value={summary?.noAnswer} color="var(--counter-no-answer)" tooltip="All calls that were not answered, including failed and busy calls" />
      </Stack>

      {/* On a phone the detail panel takes the whole screen, as on admin Calls. */}
      {isMobile && detailPanel ? detailPanel : (
        <Paper elevation={0} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 3, overflow: 'hidden' }}>
          {renderList()}

          {!error && (
            <Stack
              direction="row" spacing={1} alignItems="center" justifyContent="flex-end"
              sx={{ px: 2, py: 1, borderTop: '1px solid', borderColor: 'divider' }}
            >
              <Typography variant="body2" color="text.secondary">Page {page}</Typography>
              <TextField select size="small" label="Rows" value={perPage} disabled={!ready} onChange={(event) => { save({ calls_page_size: String(event.target.value) }); setFilters({}); }} sx={{ minWidth: 80 }}>{[25, 50, 100].map((size) => <MenuItem key={size} value={size}>{size}</MenuItem>)}</TextField>
              <Button
                size="small" disabled={page <= 1 || loading}
                onClick={() => setFilters({ page: Math.max(1, page - 1) })} data-testid="portal-calls-prev"
              >
                Previous
              </Button>
              <Button
                size="small" disabled={!hasNext || loading}
                onClick={() => setFilters({ page: page + 1 })} data-testid="portal-calls-next"
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
