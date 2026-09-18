// Portal-only dashboard. Live aggregates come from va-crystal over Cable;
// recent call history comes from PostgreSQL through /api/calls. InfluxDB is
// reserved for monitoring and logs and is intentionally absent here.
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Chip, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography,
} from '@mui/material';
import CallReceivedIcon from '@mui/icons-material/CallReceived';
import CallMadeIcon from '@mui/icons-material/CallMade';
import PhoneInTalkIcon from '@mui/icons-material/PhoneInTalk';
import PageHeader from '../common/PageHeader.jsx';
import StatCard from '../common/StatCard.jsx';
import StatusChip from '../common/StatusChip.jsx';
import { useUserAuth } from '../../context/UserAuthContext.jsx';
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

export default function PortalDashboard() {
  const { user } = useUserAuth();
  const environmentUuid = user?.environment?.uuid || user?.environment_uuid || null;
  const live = useLiveEntities(environmentUuid);
  const [recentCalls, setRecentCalls] = useState([]);
  const [callsError, setCallsError] = useState(false);

  const loadRecentCalls = useCallback(async () => {
    try {
      setCallsError(false);
      const response = await callsApi.getCalls({
        page: 1, per_page: 10, order_by: 'created_at', order_type: 'desc',
      });
      setRecentCalls(Array.isArray(response) ? response : response?.data || []);
    } catch {
      setCallsError(true);
      setRecentCalls([]);
    }
  }, []);

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
    <Box data-testid="dashboard-page" sx={{ p: { xs: 2, md: 3 }, width: '100%', maxWidth: 1440, mx: 'auto' }}>
      <PageHeader title="Dashboard" subtitle="Live activity and recent calls" />

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
        <Chip
          size="small"
          color={live.connected ? 'success' : 'default'}
          label={live.connected ? 'Live via Cable' : 'Cable reconnecting'}
        />
        {live.error && (
          <Typography variant="caption" color="text.secondary">
            Live aggregates are temporarily unavailable.
          </Typography>
        )}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1, mb: 2 }}>
        <Box><StatCard label="Calls in progress" value={aggregate.active} icon={PhoneInTalkIcon} color="success.main" /></Box>
        <Box><StatCard label="Incoming" value={aggregate.incoming} icon={CallReceivedIcon} color="info.main" /></Box>
        <Box><StatCard label="Outgoing" value={aggregate.outgoing} icon={CallMadeIcon} color="primary.main" /></Box>
      </Box>

      <Paper elevation={0} sx={{ p: { xs: 1.5, md: 2 }, border: '1px solid', borderColor: 'divider', borderRadius: 3 }}>
        <Typography variant="h6" sx={{ mb: 1.5, fontWeight: 700 }}>Recent calls</Typography>
        {callsError ? (
          <Typography color="error" variant="body2">Could not load call history.</Typography>
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
        {!callsError && recentCalls.length > 0 && (
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
      </Paper>
    </Box>
  );
}
