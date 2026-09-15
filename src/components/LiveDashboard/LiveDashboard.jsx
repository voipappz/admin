import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Paper, Typography, Chip,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  CircularProgress, Alert, IconButton, Tooltip,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import PeopleIcon from '@mui/icons-material/People';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';

import { fetchAgents, fetchLiveCalls, summarize } from '../../services/api/liveDashboardApi';
import { useUserAuth } from '../../context/UserAuthContext';
import useCableHealth from '../../hooks/useCableHealth';
import useLiveEntities from '../../hooks/useLiveEntities';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import {
  getLiveSettings, setLiveSettingsScope, statusColor, stateColor,
} from '../../services/liveSettings';

/**
 * LiveDashboard — the `/live` screen.
 *
 * COLUMNS ARE BUILT ON THE FLY, not fetched. They used to come from
 * `/api/dashboards/live?action=widgets`, which cost a round trip on every load
 * to describe a layout that never changes between them — and that endpoint
 * answers 500 for a portal user's token, so the screen could only ever have
 * worked for an admin session. The definitions live in liveSettings instead,
 * where they are already per-tenant and user-editable, exactly like the
 * palette. `fetchWidgets` remains available in the API module for a dashboard
 * that genuinely is server-defined.
 *
 * THE ENVIRONMENT COMES FROM THE SESSION, not a picker. This is the end user's
 * dashboard — they have exactly one environment, and it is on the user object
 * the login returned. It also has to work this way: `/api/applications`
 * answers 401 for a user token, so a portal session could never have populated
 * a dropdown in the first place.
 *
 * Rows come from the live agent list, and that is the ONLY part that changes
 * when the va-crystal pipeline lands: LiveChannel will push whole documents
 * carrying these same field names, at which point the timer goes away and the
 * rendering below is untouched.
 *
 * Everything on screen besides the table — the pill row and the stat tiles — is
 * counted from the same rows. No second data source, which is what lets the
 * whole screen eventually run off one subscription.
 */

const POLL_MS = 5000;

// Two missed polls. One can be a slow request; two means the source stopped
// answering and the numbers on screen are no longer current.
const STALE_AFTER_S = Math.round((POLL_MS * 2) / 1000);

const CABLE_LABEL = {
  connected: 'connected',
  connecting: 'connecting…',
  error: 'unreachable',
  unconfigured: 'not configured',
  idle: 'idle',
};

/** Seconds since a unix timestamp, formatted HH:MM:SS — the deployed dashboard's format. */
function elapsedFrom(value, now) {
  const ts = parseInt(value, 10);
  if (!ts || Number.isNaN(ts) || ts <= 0) return '00:00:00';
  const s = Math.max(0, Math.floor(now / 1000) - ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** A missing count reads as `-`; a real zero reads as `0`. They mean different things. */
function renderCount(value) {
  return value === null || value === undefined || value === '' ? '-' : String(value);
}

function StatTile({ icon, value, label }) {
  return (
    <Paper variant="outlined" sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2, flex: '1 1 180px' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 44, height: 44, borderRadius: 2, bgcolor: 'action.hover' }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h5" sx={{ fontWeight: 600, lineHeight: 1.1 }}>{value}</Typography>
        <Typography variant="body2" color="text.secondary">{label}</Typography>
      </Box>
    </Paper>
  );
}

const LiveDashboard = () => {
  // A portal user has exactly one environment and it is on the session. An
  // admin has none on theirs, so fall back to the environment they selected in
  // the console. `/api/applications` is NOT fetched here: it answers 401 for a
  // user token, so it could never have served both surfaces.
  const { user } = useUserAuth();
  const { selectedEnvironments } = useCustomerEnvironment();
  // The console selector is multi-select; this screen is one environment at a
  // time, so it follows the first of the selection.
  const adminEnv = Array.isArray(selectedEnvironments) ? selectedEnvironments[0] : null;
  const environmentUuid = user?.environment?.uuid || adminEnv?.uuid || '';
  const environmentName = user?.environment?.name || adminEnv?.name || '';
  const [rows, setRows] = useState([]);
  const [calls, setCalls] = useState([]);
  // Distinguishes "no calls" from "could not ask" — see the empty-row copy.
  const [callsAvailable, setCallsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState(() => getLiveSettings());
  // Durations are relative to the clock, so the table re-renders on a tick of
  // its own rather than only when data arrives.
  const [now, setNow] = useState(() => Date.now());
  // When data last actually ARRIVED — not when we last asked. A dashboard that
  // keeps painting the last good numbers while its source is down is the
  // failure mode this screen exists to avoid; we spent an afternoon
  // discovering two dead hosts by hand rather than being told.
  const [lastDataAt, setLastDataAt] = useState(null);
  const cable = useCableHealth();

  // The cable carries whole documents the node materialised from the switch's
  // own events; the poll below is the fallback for when it is not there. When
  // the cable has rows they WIN — polling can only ever show what the API can
  // answer, and on this deployment that excludes calls in progress entirely.
  const live = useLiveEntities(environmentUuid, null);

  const timerRef = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  // Nothing to fetch before the first render: the environment is in the
  // session and the columns are local.
  useEffect(() => { setLoading(false); }, []);

  // Settings are scoped per environment, the same way dashboard definitions are.
  useEffect(() => {
    if (!environmentUuid) return;
    setLiveSettingsScope(environmentUuid);
    setSettings(getLiveSettings());
  }, [environmentUuid]);

  const load = useCallback(async () => {
    if (!environmentUuid) return;
    try {
      // Independent, so a failure in one does not blank the other — the agents
      // endpoint works while the switch-backed call query is unreliable here.
      const [agents, live] = await Promise.allSettled([
        fetchAgents(environmentUuid),
        fetchLiveCalls(environmentUuid),
      ]);
      if (agents.status === 'fulfilled') {
        setRows(agents.value);
        setLastDataAt(Date.now());
      }
      if (live.status === 'fulfilled') {
        setCalls(live.value);
        setCallsAvailable(true);
      } else {
        // Every call source on this deployment refuses a portal token:
        // /api/calls and ?action=live answer 500, and the portal's Influx path
        // is absent on this build. Saying "no calls in progress" would be a
        // claim we cannot make — an empty table and an unknown one look
        // identical and mean opposite things.
        setCallsAvailable(false);
      }
      setError(agents.status === 'rejected' ? (agents.reason?.message || 'Could not refresh agents') : null);
    } catch (e) {
      // Keep the last good rows: a blank table reads as "no agents", which is a
      // different and more alarming statement than "could not refresh".
      setError(e?.message || 'Could not refresh agents');
    }
  }, [environmentUuid]);

  useEffect(() => {
    if (!environmentUuid) return undefined;
    load();
    timerRef.current = setInterval(load, POLL_MS);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [environmentUuid, load]);

  // Built from settings, so a hidden or reordered column takes effect with no
  // server round trip and no deploy.
  const columns = useMemo(
    () => settings.columns.filter((c) => c.visible !== false),
    [settings.columns],
  );

  // Agent rows: the cable's if it has them, otherwise the polled ones.
  //
  // The switch never publishes a name or an extension, and it publishes a
  // status only when the agent changes it — so a live row can arrive with
  // those three blank. They come from the polled list instead (by uuid), and
  // everything that moves stays the cable's. An agent the poll does not know
  // is still shown, blanks and all: hiding live activity is worse.
  const liveAgents = live.byScope('user');
  const usingCable = live.connected && liveAgents.length > 0;
  const polledByUuid = useMemo(() => new Map(rows.map((r) => [r.uuid, r])), [rows]);
  const agentRows = useMemo(() => {
    if (!usingCable) return rows;
    return liveAgents.map((a) => {
      const uuid = a.uuid || a.id;
      const p = polledByUuid.get(uuid);
      return {
        ...a,
        uuid,
        user_name: a.user_name || p?.user_name || '',
        extension_username: a.extension_username || p?.extension_username || '',
        status: a.status || p?.status || '',
      };
    });
  }, [usingCable, liveAgents, rows, polledByUuid]);

  // Calls in progress come off the environment document's live_calls_* lists —
  // the only trustworthy source, since /api/calls holds a call only after it
  // has ended.
  const liveEnv = live.byScope('environment')[0];
  const cableCallCount = liveEnv
    ? [liveEnv.live_calls_incoming, liveEnv.live_calls_outgoing, liveEnv.live_calls_local]
        .reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0)
    : null;

  const stats = useMemo(() => summarize(agentRows), [agentRows]);
  // The cable is always current; only the poll can go stale.
  const dataAge = usingCable ? 0 : (lastDataAt === null ? null : Math.floor((now - lastDataAt) / 1000));

  const cell = (row, col) => {
    const value = row[col.key];
    switch (col.render) {
      case 'elapsed':
        return <Box component="span" sx={{ fontVariantNumeric: 'tabular-nums' }}>{elapsedFrom(value, now)}</Box>;
      case 'count':
        return renderCount(value);
      case 'status': {
        if (!value) return '-';
        const c = statusColor(value, settings);
        return <Chip size="small" label={value} sx={{ bgcolor: c || undefined, color: c ? '#fff' : undefined, fontWeight: 500 }} />;
      }
      case 'state': {
        if (!value) return '-';
        const c = stateColor(value, settings);
        return <Chip size="small" label={value} sx={{ bgcolor: c || undefined, color: c ? '#fff' : undefined, fontWeight: 500 }} />;
      }
      default:
        return value === '' || value === null || value === undefined ? '-' : String(value);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3, display: 'flex', flexDirection: 'column', gap: 2.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Live Dashboard</Typography>
        {environmentName && (
          <Chip label={environmentName} variant="outlined" sx={{ fontWeight: 600 }} />
        )}
        <Tooltip title="Refresh now">
          <IconButton onClick={load} size="small"><RefreshIcon /></IconButton>
        </Tooltip>
      </Box>

      {error && <Alert severity="warning">{error}</Alert>}

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Chip
          size="small"
          variant="outlined"
          label={`Data ${dataAge === null ? 'never received' : dataAge > STALE_AFTER_S ? `stale — ${dataAge}s old` : `fresh — ${dataAge}s ago`}`}
          sx={{
            borderColor: dataAge === null || dataAge > STALE_AFTER_S ? 'warning.main' : 'success.main',
            color: dataAge === null || dataAge > STALE_AFTER_S ? 'warning.main' : 'success.main',
            fontWeight: 600,
          }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`Realtime cable: ${CABLE_LABEL[cable.status] || cable.status}`}
          sx={{
            borderColor: cable.status === 'connected' ? 'success.main' : 'text.disabled',
            color: cable.status === 'connected' ? 'success.main' : 'text.secondary',
          }}
        />
        <Chip
          size="small"
          variant="outlined"
          label={`Source: ${usingCable ? 'cable (live)' : `polling ${POLL_MS / 1000}s`}`}
          sx={{ color: 'text.secondary' }}
        />
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        <Chip label={`${stats.available} Available`} sx={{ bgcolor: statusColor('available', settings), color: '#fff', fontWeight: 600 }} />
        <Chip label={`${stats.onCall} On Call`} sx={{ bgcolor: stateColor('in_a_queue_call', settings), color: '#fff', fontWeight: 600 }} />
        <Chip label={`${stats.onBreak} On Break`} sx={{ bgcolor: statusColor('on_break', settings), color: '#fff', fontWeight: 600 }} />
        <Chip label={`${stats.waiting} Waiting`} sx={{ bgcolor: stateColor('waiting', settings), color: '#fff', fontWeight: 600 }} />
      </Box>

      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <StatTile icon={<PeopleIcon color="primary" />} value={stats.total} label="Total Online" />
        <StatTile
          icon={<PhoneInTalkIcon color="error" />}
          value={cableCallCount !== null ? cableCallCount : (callsAvailable ? calls.length : '—')}
          label="Active Calls"
        />
        <StatTile icon={<CheckCircleIcon color="success" />} value={stats.available} label="Available" />
        <StatTile icon={<TrendingUpIcon color="secondary" />} value={`${stats.utilization}%`} label="Utilization" />
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
          Live calls {calls.length ? `(${calls.length})` : ''}
        </Typography>
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow>
                {['Direction', 'From', 'To', 'State', 'Legs', 'For'].map((h) => (
                  <TableCell key={h} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{h}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {calls.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 3, color: 'text.secondary' }}>
                    {callsAvailable
                      ? 'No calls in progress'
                      : 'Live calls unavailable for this session — no call source is reachable'}
                  </TableCell>
                </TableRow>
              )}
              {calls.map((c) => (
                <TableRow key={c.uuid} hover>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.direction || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.caller || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.destination || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Chip size="small" label={c.state || 'unknown'} />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{c.leg || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {elapsedFrom(c.created_at ? Math.floor(new Date(c.created_at).getTime() / 1000) : 0, now)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>

      <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Agents</Typography>
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.key} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.label}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {agentRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  No agents in this environment
                </TableCell>
              </TableRow>
            )}
            {agentRows.map((row) => (
              <TableRow key={row.uuid} hover>
                {columns.map((c) => (
                  <TableCell key={c.key} sx={{ whiteSpace: 'nowrap' }}>{cell(row, c)}</TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Typography variant="caption" color="text.secondary">
        Polling every {POLL_MS / 1000}s. Live streaming over the cable replaces this once LiveChannel ships.
      </Typography>
    </Box>
  );
};

export default LiveDashboard;
