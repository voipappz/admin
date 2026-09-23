import React, { useState } from 'react';
import { Box, Paper, Typography, Collapse, IconButton, Tooltip } from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';

import { cableVerdict, STALE_AFTER_MS } from '../../services/cable';

/**
 * CableStatus — is this screen live, and if not, why.
 *
 * Everything here is what the page's own socket went through, not a second
 * probe: the handshake, the heartbeat, the subscription the screen depends on,
 * and whether data is arriving. The verdict is one line; the details open by
 * themselves when it is not green, because that is when someone needs them.
 */

const LEVEL_COLOR = {
  ok: 'success.main',
  warn: 'warning.main',
  error: 'error.main',
  idle: 'text.disabled',
};

const TOKEN_SOURCE = {
  admin: 'admin login',
  portal: 'portal login',
  override: 'va_cable_token override (local dev)',
};

const SUB_STATUS = {
  idle: 'not subscribed',
  unavailable: 'no cable to subscribe on',
  pending: 'waiting for confirmation',
  confirmed: 'confirmed',
  reconnecting: 'resubscribing after reconnect',
  disconnected: 'closed',
  rejected: 'rejected by the node',
};

export function ago(ts, now) {
  if (!ts) return 'never';
  const s = Math.max(0, Math.round((now - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
}

function until(ts, now) {
  if (!ts) return 'no expiry';
  const s = Math.round((ts - now) / 1000);
  if (s <= 0) return 'EXPIRED';
  if (s < 3600) return `expires in ${Math.floor(s / 60)}m`;
  if (s < 86400) return `expires in ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `expires in ${Math.floor(s / 86400)}d`;
}

const clock = (ts) => (ts ? new Date(ts).toLocaleTimeString() : '—');

function Row({ label, children, tone }) {
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '140px 1fr' }, gap: { xs: 0, sm: 2 }, py: 0.5 }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontVariantNumeric: 'tabular-nums', wordBreak: 'break-all', color: tone || 'text.primary' }}>
        {children}
      </Typography>
    </Box>
  );
}

export default function CableStatus({ conn, sub, counts = {}, now = Date.now() }) {
  const verdict = cableVerdict(conn, sub, now);
  const healthy = verdict.level === 'ok';
  const [open, setOpen] = useState(null); // null = follow health
  const expanded = open ?? !healthy;

  const pingAge = conn.pingedAt ? now - conn.pingedAt : null;
  const pingTone = pingAge !== null && pingAge > STALE_AFTER_MS ? 'warning.main' : undefined;

  return (
    <Paper variant="outlined" sx={{ px: 2, py: 1.25, borderColor: healthy ? 'divider' : LEVEL_COLOR[verdict.level] }} data-testid="cable-status">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, flexWrap: 'wrap' }}>
        <Box
          aria-hidden
          sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: LEVEL_COLOR[verdict.level], flexShrink: 0 }}
        />
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          Realtime cable: {verdict.label}
        </Typography>
        {healthy && (
          <Typography variant="caption" color="text.secondary">
            ping {ago(conn.pingedAt, now)} · {sub?.frames ?? 0} updates{sub?.lastFrameAt ? `, last ${ago(sub.lastFrameAt, now)}` : ''}
          </Typography>
        )}
        {verdict.hint && (
          <Typography variant="caption" sx={{ color: LEVEL_COLOR[verdict.level] }}>{verdict.hint}</Typography>
        )}
        <Box sx={{ flexGrow: 1 }} />
        <Tooltip title={expanded ? 'Hide details' : 'Show details'}>
          <IconButton size="small" onClick={() => setOpen(!expanded)} aria-label="cable details">
            {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
      </Box>

      <Collapse in={expanded} unmountOnExit>
        <Box sx={{ mt: 1, pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Row label="Endpoint">{conn.url || 'not configured'}</Row>
          <Row label="Token" tone={conn.tokenExpiresAt && conn.tokenExpiresAt <= now ? 'error.main' : undefined}>
            {TOKEN_SOURCE[conn.tokenSource] || 'none'} · {until(conn.tokenExpiresAt, now)}
          </Row>
          <Row label="Socket">
            {conn.state}
            {conn.openedAt ? ` · opened ${clock(conn.openedAt)}` : ''}
            {conn.monitorRunning ? '' : conn.state === 'idle' ? '' : ' · not reconnecting'}
          </Row>
          <Row label="Handshake" tone={conn.welcomedAt ? undefined : 'text.secondary'}>
            {conn.welcomedAt ? `welcome at ${clock(conn.welcomedAt)}` : 'no welcome yet'}
          </Row>
          <Row label="Heartbeat" tone={pingTone}>
            {conn.pingedAt ? `last ping ${ago(conn.pingedAt, now)}` : 'no ping yet'} · stale after {STALE_AFTER_MS / 1000}s
          </Row>
          <Row label="Subscription" tone={sub?.status === 'rejected' ? 'error.main' : undefined}>
            LiveChannel{sub?.environmentUuid ? ` · ${sub.environmentUuid}` : ''} · {SUB_STATUS[sub?.status] || sub?.status || '—'}
            {sub?.confirmedAt ? ` at ${clock(sub.confirmedAt)}` : ''}
          </Row>
          <Row label="Data">
            {sub?.frames ?? 0} updates · last {ago(sub?.lastFrameAt, now)} ·{' '}
            {counts.user ?? 0} agents, {counts.queue ?? 0} queues, {counts.environment ?? 0} environment
          </Row>
          <Row label="Reconnects" tone={conn.reconnectAttempts ? 'warning.main' : undefined}>
            {conn.reconnectAttempts} attempt{conn.reconnectAttempts === 1 ? '' : 's'}
            {conn.lastCloseAt ? ` · last close ${ago(conn.lastCloseAt, now)} (code ${conn.lastCloseCode ?? '?'})` : ''}
            {conn.disconnectReason ? ` · server said “${conn.disconnectReason}”` : ''}
          </Row>
        </Box>
      </Collapse>
    </Paper>
  );
}
