import { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router';
import ReactFlow, { Background, Controls, ReactFlowProvider } from 'reactflow';
import 'reactflow/dist/style.css';
import {
  Box, List, ListItemButton, ListItemText, Button, IconButton, Typography,
  Chip, Tooltip, Divider, Dialog, DialogTitle, DialogContent, DialogActions,
  TextField, CircularProgress, Alert,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { subscriptionsApi } from '../../services/api/subscriptionsApi';
import { plansApi } from '../../services/api/plansApi';
import { tariffsApi } from '../../services/api/tariffsApi';
import { useCustomerEnvironment } from '../../context/CustomerEnvironmentContext';
import './Studio.css';

const asArray = (r) => (Array.isArray(r) ? r : (r?.data || r?.subscriptions || r?.items || []));

// Colors mirror the billing tiers (same palette as BillingOverview).
const C = {
  sub:    '#6366f1', // indigo
  plan:   '#0891b2', // cyan
  tariff: '#16a34a', // green
  rates:  '#d97706', // amber
  balance: '#a855f7', // purple
};

const COL = 340;   // horizontal gap — roomy like the Services flow
const ROW = 150;   // vertical gap when tariffs fan out

// A ReactFlow node styled like the Services flow cards: a large rounded card
// with a thick colored border, a small uppercase colored label, and a large
// dark value (mirrors the TRIGGERS/SERVICE/ACTION look).
const cardNode = (id, x, y, label, sub, color) => ({
  id,
  position: { x, y },
  data: { label: (
    <Box sx={{ textAlign: 'left', px: 1, py: 0.75 }}>
      <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color, mb: 0.75 }}>{label}</Typography>
      <Typography sx={{ fontSize: '1.15rem', fontWeight: 600, color: '#1a2233', lineHeight: 1.25, whiteSpace: 'normal' }}>{sub}</Typography>
    </Box>
  ) },
  style: {
    width: 260, minHeight: 96, borderRadius: 18, border: `2px solid ${color}`,
    padding: 18, background: 'var(--mui-palette-background-paper)', boxShadow: '0 1px 4px rgba(16,24,40,0.08)',
  },
  sourcePosition: 'right',
  targetPosition: 'left',
});

const balanceLabel = (subscription) => {
  const balance = Number(subscription?.balance) || 0;
  return `${balance} balance`;
};

// Build the left→right billing graph: Subscription → Plan → Tariffs → Rates → Balance.
function buildBillingFlow({ subscription, plan, tariffs, ratesByTariff }) {
  if (!subscription) return { nodes: [], edges: [] };
  const nodes = [];
  const edges = [];
  const n = Math.max(tariffs.length, 1);
  const midY = ((n - 1) * ROW) / 2;

  const expires = subscription.ends_at
    ? ` · expires ${new Date(subscription.ends_at).toLocaleDateString()}`
    : '';
  nodes.push(cardNode('sub', 0, midY, 'Subscription',
    `${subscription.name || '—'}${subscription.status ? ` · ${subscription.status}` : ''}${expires}`, C.sub));
  nodes.push(cardNode('plan', COL, midY, 'Plan',
    plan ? `${plan.name || '—'} · ${plan.interval || 1}×${plan.period || ''}` : 'No plan', C.plan));
  edges.push({ id: 'e-sub-plan', source: 'sub', target: 'plan', animated: true });

  if (tariffs.length === 0) {
    nodes.push(cardNode('balance', COL * 2, midY, 'Balance', balanceLabel(subscription), C.balance));
    edges.push({ id: 'e-plan-balance', source: 'plan', target: 'balance' });
    return { nodes, edges };
  }

  tariffs.forEach((t, i) => {
    const tid = `tariff-${i}`;
    const rid = `rates-${i}`;
    nodes.push(cardNode(tid, COL * 2, i * ROW, 'Tariff',
      `${t.name || '—'}${t.scheme ? ` · ${t.scheme}` : ''}`, C.tariff));
    edges.push({ id: `e-plan-${tid}`, source: 'plan', target: tid, animated: true });

    const rates = ratesByTariff[t.uuid] || [];
    const rlabel = rates.length
      ? `${rates.length} rate${rates.length > 1 ? 's' : ''}: ${rates.slice(0, 3).map((r) => r.val).join(' · ')}${rates.length > 3 ? ' …' : ''}`
      : 'No rates';
    nodes.push(cardNode(rid, COL * 3, i * ROW, 'Rates', rlabel, C.rates));
    edges.push({ id: `e-${tid}-${rid}`, source: tid, target: rid });
  });

  nodes.push(cardNode('balance', COL * 4, midY, 'Balance', balanceLabel(subscription), C.balance));
  tariffs.forEach((_, i) => edges.push({ id: `e-rates-${i}-balance`, source: `rates-${i}`, target: 'balance' }));

  return { nodes, edges };
}

const BillingInner = () => {
  const { selectedEnvironments } = useCustomerEnvironment();
  const envUuid = selectedEnvironments?.[0]?.uuid;
  const navigate = useNavigate();

  const [subscriptions, setSubscriptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);

  // Resolved billing chain for the selected subscription.
  const [chain, setChain] = useState({ plan: null, tariffs: [], ratesByTariff: {} });
  const [chainLoading, setChainLoading] = useState(false);

  // Set expiration (ends_at) on the selected subscription.
  const [expOpen, setExpOpen] = useState(false);
  const [expDate, setExpDate] = useState('');
  const [expSaving, setExpSaving] = useState(false);
  const [expError, setExpError] = useState(null);

  const fetchSubscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const list = asArray(await subscriptionsApi.getSubscriptions(
        envUuid ? { environment_uuid: envUuid, per_page: 200 } : { per_page: 200 }));
      setSubscriptions(list);
      setSelected((prev) => list.find((s) => s.uuid === prev?.uuid) || list[0] || null);
    } finally {
      setLoading(false);
    }
  }, [envUuid]);

  useEffect(() => { fetchSubscriptions(); }, [fetchSubscriptions]);

  // When a subscription is selected, resolve its Plan → Tariffs → Rates.
  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!selected?.uuid) { setChain({ plan: null, tariffs: [], ratesByTariff: {} }); return; }
      setChainLoading(true);
      try {
        const planId = selected.plan_uuid || selected.plan?.uuid;
        const planResp = planId ? await plansApi.getPlan(planId).catch(() => null) : null;
        const plan = planResp?.data || planResp || null;

        const itemsResp = planId ? await plansApi.getItems(planId).catch(() => []) : [];
        const items = asArray(itemsResp);
        const tariffs = items.filter((i) => i.tariff).map((i) => ({ ...i.tariff, itemUuid: i.uuid }));

        const ratesByTariff = {};
        await Promise.all(tariffs.map(async (t) => {
          const r = await tariffsApi.getRates(t.uuid).catch(() => []);
          ratesByTariff[t.uuid] = asArray(r);
        }));

        if (!cancelled) setChain({ plan, tariffs, ratesByTariff });
      } finally {
        if (!cancelled) setChainLoading(false);
      }
    };
    run();
    return () => { cancelled = true; };
  }, [selected]);

  const openExpiration = useCallback(() => {
    setExpError(null);
    setExpDate(selected?.ends_at ? selected.ends_at.split('T')[0] : '');
    setExpOpen(true);
  }, [selected]);

  const saveExpiration = useCallback(async (clear = false) => {
    if (!selected?.uuid) return;
    setExpSaving(true); setExpError(null);
    try {
      await subscriptionsApi.updateSubscription(selected.uuid, { ends_at: clear ? '' : expDate });
      setExpOpen(false);
      await fetchSubscriptions();
    } catch (err) {
      setExpError(err?.message || 'Failed to set expiration');
    } finally {
      setExpSaving(false);
    }
  }, [selected, expDate, fetchSubscriptions]);

  const { nodes, edges } = useMemo(
    () => buildBillingFlow({ subscription: selected, ...chain }),
    [selected, chain]);

  return (
    <Box className="studio-routes" sx={{ flexDirection: 'row !important', height: '100%' }}>
      {/* Left — subscriptions list */}
      <Box className="services-list">
        <Box className="studio-header" sx={{ borderRight: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>Billing</Typography>
          <Box sx={{ flex: 1 }} />
          <Tooltip title="Refresh"><span>
            <IconButton size="small" onClick={fetchSubscriptions} disabled={loading}><RefreshIcon fontSize="small" /></IconButton>
          </span></Tooltip>
        </Box>
        <Box sx={{ p: 1 }}>
          <Button fullWidth variant="contained" startIcon={<ReceiptLongIcon />} onClick={() => navigate('/subscriptions')} sx={{ textTransform: 'none' }}>
            Manage subscriptions
          </Button>
        </Box>
        <Divider />
        <List dense sx={{ overflowY: 'auto', flex: 1 }}>
          {subscriptions.map((s) => (
            <ListItemButton key={s.uuid} selected={selected?.uuid === s.uuid} onClick={() => setSelected(s)}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', mr: 1, bgcolor: s.status === 'active' ? 'var(--accent-success)' : 'var(--text-tertiary)' }} />
              <ListItemText primary={s.name} secondary={s.status || s.type} primaryTypographyProps={{ fontWeight: 600, noWrap: true }} />
            </ListItemButton>
          ))}
          {!loading && subscriptions.length === 0 && (
            <Typography variant="body2" sx={{ p: 2, color: 'var(--text-secondary)' }}>No subscriptions for this application.</Typography>
          )}
        </List>
      </Box>

      <Divider orientation="vertical" flexItem />

      {/* Right — the billing process as a node graph */}
      <Box sx={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        {!selected ? (
          <Box className="studio-placeholder">
            <ReceiptLongIcon sx={{ fontSize: 48, color: 'var(--text-tertiary)' }} />
            <Typography sx={{ color: 'var(--text-secondary)' }}>Select a subscription to visualize its billing.</Typography>
          </Box>
        ) : (
          <>
            <Box className="studio-header">
              <Typography variant="h6" sx={{ fontWeight: 600 }}>{selected.name}</Typography>
              <Chip size="small" label={selected.status || 'subscription'} sx={{ ml: 1 }} />
              {chainLoading && <Chip size="small" variant="outlined" label="loading…" sx={{ ml: 1 }} />}
              {selected.ends_at && (
                <Chip size="small" variant="outlined" color="warning" icon={<EventBusyIcon sx={{ fontSize: 14 }} />}
                  label={`expires ${new Date(selected.ends_at).toLocaleDateString()}`} sx={{ ml: 1 }} />
              )}
              <Box sx={{ flex: 1 }} />
              <Button size="small" variant="outlined" startIcon={<EventBusyIcon />} sx={{ textTransform: 'none', mr: 1 }} onClick={openExpiration}>
                Set expiration
              </Button>
              <Button size="small" variant="contained" startIcon={<EditIcon />} sx={{ textTransform: 'none' }} onClick={() => navigate('/subscriptions')}>Edit</Button>
            </Box>
            <Box sx={{ flex: 1, minHeight: 0 }}>
              <ReactFlow
                key={selected.uuid}
                nodes={nodes}
                edges={edges}
                fitView
                fitViewOptions={{ padding: 0.25 }}
                nodesDraggable
                nodesConnectable={false}
                proOptions={{ hideAttribution: true }}
              >
                <Controls showInteractive={false} />
                <Background variant="dots" gap={16} size={1} />
              </ReactFlow>
            </Box>
          </>
        )}
      </Box>

      {/* Set subscription expiration (ends_at) */}
      <Dialog open={expOpen} onClose={() => setExpOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Set expiration</DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ color: 'var(--text-secondary)', mb: 2 }}>
            The subscription ends on this date. Leave empty (or Clear) for no expiration.
          </Typography>
          <TextField
            label="Expires on"
            type="date"
            value={expDate}
            onChange={(e) => setExpDate(e.target.value)}
            fullWidth size="small"
            InputLabelProps={{ shrink: true }}
          />
          {expError && <Alert severity="error" sx={{ mt: 2 }}>{expError}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          {selected?.ends_at && (
            <Button onClick={() => saveExpiration(true)} disabled={expSaving} color="warning" sx={{ textTransform: 'none', mr: 'auto' }}>
              Clear expiration
            </Button>
          )}
          <Button onClick={() => setExpOpen(false)} sx={{ textTransform: 'none' }}>Cancel</Button>
          <Button onClick={() => saveExpiration(false)} variant="contained" disabled={!expDate || expSaving}
            startIcon={expSaving ? <CircularProgress size={16} color="inherit" /> : <EventBusyIcon />} sx={{ textTransform: 'none' }}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

const BillingStudio = () => (
  <ReactFlowProvider>
    <BillingInner />
  </ReactFlowProvider>
);

export default BillingStudio;
