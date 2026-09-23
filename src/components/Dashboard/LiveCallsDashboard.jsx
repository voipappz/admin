// The live-calls dashboard body, shared by the portal (PortalDashboard) and
// the admin (AdminDashboard). Live aggregates come from va-crystal over Cable;
// recent call history comes from PostgreSQL through /api/calls. InfluxDB is
// reserved for monitoring and logs and is intentionally absent here.
//
// The wrappers decide the scope: which environment the live channel follows
// and where "View call history" goes. /api/calls needs no parameters — the
// server scopes it to the session (a portal user's environment, an admin's
// selected environments).
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Chip, CircularProgress, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import { useNavigate } from 'react-router';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import PageHeader from '../common/PageHeader.jsx';
import StatCard from '../common/StatCard.jsx';
import StatusChip from '../common/StatusChip.jsx';
import { callsApi } from '../../services/api/callsApi';
import useLiveEntities from '../../hooks/useLiveEntities';

const numeric = (doc, ...keys) => {
  for (const key of keys) {
    const parsed = Number(doc?.[key]);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const displayTime = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString();
};

export default function LiveCallsDashboard({
  environmentUuid = null,
  title = 'Dashboard',
  subtitle = 'Your live activity and recent conversations',
  callsAllowed = true,
  historyPath = '/my-calls',
  testId = 'dashboard-page',
}) {
  const navigate = useNavigate();
  const live = useLiveEntities(environmentUuid);
  const [recentCalls, setRecentCalls] = useState([]);
  const [callsError, setCallsError] = useState(false);
  const [callsLoading, setCallsLoading] = useState(true);

  const loadRecentCalls = useCallback(async () => {
    if (!callsAllowed) { setCallsLoading(false); return; }
    try {
      setCallsLoading(true);
      setCallsError(false);
      const response = await callsApi.getCalls({
        page: 1, per_page: 10, order_by: 'created_at', order_type: 'desc',
      });
      setRecentCalls(Array.isArray(response) ? response : response?.data || []);
    } catch {
      setCallsError(true);
      setRecentCalls([]);
    } finally {
      setCallsLoading(false);
    }
  }, [callsAllowed]);

  useEffect(() => { loadRecentCalls(); }, [loadRecentCalls]);

  const aggregate = useMemo(() => {
    const environment = live.byScope('environment')[0] || {};
    const users = live.byScope('user');
    const activeFromUsers = users.filter((row) => (
      /receiving|answer|talk|queue_call/i.test(String(row.state || ''))
    )).length;

    return {
      active: numeric(environment, 'live_calls_current', 'calls_total') || activeFromUsers,
      incoming: numeric(environment, 'call_incoming_count', 'incoming_count'),
      outgoing: numeric(environment, 'call_outgoing_count', 'outgoing_count'),
    };
  }, [live.rows]);

  return (
    <Box data-testid={testId} sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: 1440, mx: 'auto' }}>
      <PageHeader title={title} subtitle={subtitle} actions={callsAllowed ? <Button variant="outlined" onClick={() => navigate(historyPath)}>View call history</Button> : null} />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Chip
          size="small"
          color={live.connected ? 'success' : 'default'}
          label={live.connected ? 'Live updates connected' : 'Reconnecting to live updates'}
        />
        {live.error && (
          <Typography variant="caption" color="text.secondary">
            Live aggregates are temporarily unavailable.
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1, mb: 2 }}>
        <Box><StatCard label="Calls in progress" value={live.connected ? aggregate.active : '—'} icon={PhoneInTalkIcon} color="success.main" /></Box>
        <Box><StatCard label="Incoming" value={live.connected ? aggregate.incoming : '—'} icon={CallReceivedIcon} color="info.main" /></Box>
        <Box><StatCard label="Outgoing" value={live.connected ? aggregate.outgoing : '—'} icon={CallMadeIcon} color="primary.main" /></Box>
      </Box>

      {callsAllowed && <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>Recent calls</Typography>
        {callsLoading ? <CircularProgress size={24} aria-label="Loading recent calls" /> : callsError ? (
          <Box role="alert"><Typography color="error" variant="body2">Could not load call history.</Typography><Button onClick={loadRecentCalls}>Retry</Button></Box>
        ) : recentCalls.length === 0 ? (
          <Typography color="text.secondary" variant="body2">No calls yet.</Typography>
        ) : (
          <Box sx={{ display: { xs: 'grid', md: 'none' }, gap: 1 }}>
            {recentCalls.map((call) => (
              <Paper key={call.uuid || call.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 1 }}>
                  <Typography variant="caption" color="text.secondary">{displayTime(call.created_at)}</Typography>
                  <StatusChip status={call.profile?.cause || 'unknown'} variant="outlined" />
                </Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {call.profile?.caller || '—'} → {call.profile?.callee || '—'}
                </Typography>
                <Typography variant="caption" color="text.secondary">{call.profile?.direction || '—'}</Typography>
              </Paper>
            ))}
          </Box>
        )}
        {!callsLoading && !callsError && recentCalls.length > 0 && (
          <Box sx={{ display: { xs: 'none', md: 'block' }, overflowX: 'auto' }}>
            <Table size="small">
              <TableHead><TableRow><TableCell>Time</TableCell><TableCell>Direction</TableCell><TableCell>Caller</TableCell><TableCell>Callee</TableCell><TableCell>Cause</TableCell></TableRow></TableHead>
              <TableBody>
                {recentCalls.map((call) => (
                  <TableRow key={call.uuid || call.id} hover>
                    <TableCell>{displayTime(call.created_at)}</TableCell>
                    <TableCell>{call.profile?.direction || '—'}</TableCell>
                    <TableCell>{call.profile?.caller || '—'}</TableCell>
                    <TableCell>{call.profile?.callee || '—'}</TableCell>
                    <TableCell><StatusChip status={call.profile?.cause || 'unknown'} variant="outlined" /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Box>
        )}
      </Paper>}
    </Box>
  );
}
