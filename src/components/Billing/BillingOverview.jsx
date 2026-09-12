import { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Collapse, Chip, CircularProgress,
  Autocomplete, TextField, IconButton, Divider,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon, ExpandLess as ExpandLessIcon,
  ReceiptLong as SubIcon, EventNote as PlanIcon,
  AttachMoney as TariffIcon, AccountBalanceWallet as BalanceIcon,
  Delete as DeleteIcon,
} from '@mui/icons-material';
import { plansApi } from '../../services/api/plansApi';
import { tariffsApi } from '../../services/api/tariffsApi';

// Colors mirror the Services EventPipelineBuilder panels.
const C = {
  subscription: { color: '#6366f1', bg: '#f5f3ff' },
  plan:         { color: '#0891b2', bg: '#ecfeff' },
  tariffs:      { color: '#16a34a', bg: '#f0fdf4' },
  balance:      { color: '#a855f7', bg: '#faf5ff' },
};

function Panel({ id, expanded, onToggle, icon, title, chips, color, bg, children }) {
  const open = expanded === id;
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden', borderColor: open ? color : '#e0e0e0' }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1.5, cursor: 'pointer', bgcolor: open ? bg : '#fafafa' }}
        onClick={() => onToggle(id)}
      >
        {icon}
        <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>{title}</Typography>
        {chips}
        {open ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
      </Box>
      <Collapse in={open}>
        <Box sx={{ p: 2, borderLeft: `3px solid ${color}` }}>{children}</Box>
      </Collapse>
    </Paper>
  );
}

/**
 * BillingOverview — the billing chain (Subscription → Plan → Tariffs → Rates →
 * Balance) as expandable, color-coded panels with inline management, mirroring
 * the Services EventPipelineBuilder. Reads via the billing APIs.
 */
export default function BillingOverview({ subscription }) {
  const [expanded, setExpanded] = useState('tariffs');
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(null);
  const [tariffs, setTariffs] = useState([]);        // plan items resolved to tariffs
  const [allTariffs, setAllTariffs] = useState([]);  // for the add picker
  const [ratesByTariff, setRatesByTariff] = useState({});
  const [openTariff, setOpenTariff] = useState(null);

  const planId = subscription?.plan_uuid || subscription?.plan?.uuid;

  const load = useCallback(async () => {
    if (!subscription?.uuid) return;
    setLoading(true);
    try {
      const p = planId ? await plansApi.getPlan(planId) : null;
      setPlan(p?.data || p || null);

      const items = planId ? await plansApi.getItems(planId) : [];
      const list = Array.isArray(items) ? items : (items?.data || []);
      setTariffs(list.filter((i) => i.tariff).map((i) => ({ ...i.tariff, itemUuid: i.uuid })));
    } catch (e) {
      console.error('BillingOverview load failed:', e);
    } finally {
      setLoading(false);
    }
  }, [subscription, planId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    tariffsApi.getTariffs({ per_page: 9999 })
      .then((r) => setAllTariffs(Array.isArray(r) ? r : (r?.data || [])))
      .catch(() => setAllTariffs([]));
  }, []);

  // Lazy-load rates when a tariff sub-panel opens.
  const toggleTariff = async (t) => {
    const next = openTariff === t.uuid ? null : t.uuid;
    setOpenTariff(next);
    if (next && !ratesByTariff[t.uuid]) {
      const r = await tariffsApi.getRates(t.uuid).catch(() => []);
      setRatesByTariff((prev) => ({ ...prev, [t.uuid]: Array.isArray(r) ? r : (r?.data || []) }));
    }
  };

  const addTariff = async (t) => {
    if (!t || !planId) return;
    const next = [...tariffs.map((x) => ({ name: x.name, val: x.uuid })), { name: t.name, val: t.uuid }];
    await plansApi.setItems(planId, next).catch((e) => console.error(e));
    load();
  };

  const removeTariff = async (t) => {
    if (!planId) return;
    const next = tariffs.filter((x) => x.uuid !== t.uuid).map((x) => ({ name: x.name, val: x.uuid }));
    await plansApi.setItems(planId, next).catch((e) => console.error(e));
    load();
  };

  const toggle = (id) => setExpanded((prev) => (prev === id ? null : id));
  const balance = Number(subscription?.balance) || 0;
  const status = subscription?.status || '—';
  const statusColor = status === 'active' ? 'success' : status === 'canceled' ? 'error' : 'default';

  if (!subscription) return null;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      {loading && <CircularProgress size={20} sx={{ alignSelf: 'center' }} />}

      {/* Subscription */}
      <Panel
        id="subscription" expanded={expanded} onToggle={toggle} {...C.subscription}
        icon={<SubIcon sx={{ fontSize: 18, color: C.subscription.color }} />}
        title={subscription.name || 'Subscription'}
        chips={<>
          <Chip size="small" label={status} color={statusColor} variant="outlined" />
          {subscription.type && <Chip size="small" label={subscription.type} variant="outlined" sx={{ ml: 0.5 }} />}
        </>}
      >
        <Typography variant="body2" color="text.secondary">
          Application: {subscription.tenant || subscription.environment_uuid || '—'}<br />
          Begins: {subscription.begins_at || '—'} · Ends: {subscription.ends_at || '—'}<br />
          Recurring: {String(subscription.recurring ?? false)}
        </Typography>
      </Panel>

      {/* Plan */}
      <Panel
        id="plan" expanded={expanded} onToggle={toggle} {...C.plan}
        icon={<PlanIcon sx={{ fontSize: 18, color: C.plan.color }} />}
        title={plan ? `Plan · ${plan.name}` : 'Plan'}
        chips={plan && <Chip size="small" label={`${plan.interval || 1} × ${plan.period || '—'}`} variant="outlined" />}
      >
        {plan
          ? <Typography variant="body2" color="text.secondary">Billing every {plan.interval || 1} {plan.period}. {plan.notes || ''}</Typography>
          : <Typography variant="body2" color="text.secondary">No plan linked to this subscription.</Typography>}
      </Panel>

      {/* Tariffs (+ rates) */}
      <Panel
        id="tariffs" expanded={expanded} onToggle={toggle} {...C.tariffs}
        icon={<TariffIcon sx={{ fontSize: 18, color: C.tariffs.color }} />}
        title="Tariffs"
        chips={<Chip size="small" label={`${tariffs.length}`} variant="outlined" />}
      >
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          {tariffs.map((t) => (
            <Paper key={t.uuid} variant="outlined" sx={{ overflow: 'hidden' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1, cursor: 'pointer' }} onClick={() => toggleTariff(t)}>
                <Typography variant="body2" fontWeight={600} sx={{ flex: 1 }}>{t.name}</Typography>
                {t.scheme && <Chip size="small" label={t.scheme} variant="outlined" />}
                <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); removeTariff(t); }}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
                {openTariff === t.uuid ? <ExpandLessIcon sx={{ fontSize: 18 }} /> : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
              </Box>
              <Collapse in={openTariff === t.uuid}>
                <Box sx={{ p: 1.5, pl: 2, borderLeft: `3px solid ${C.tariffs.color}` }}>
                  {(ratesByTariff[t.uuid] || []).length === 0
                    ? <Typography variant="caption" color="text.secondary">No rates.</Typography>
                    : (ratesByTariff[t.uuid] || []).map((r) => (
                        <Box key={r.uuid} sx={{ display: 'flex', gap: 1, alignItems: 'center', py: 0.25 }}>
                          <Chip size="small" label={r.val} variant="outlined" sx={{ fontFamily: 'monospace' }} />
                          <Typography variant="body2">{r.name}</Typography>
                          <Typography variant="body2" sx={{ ml: 'auto', fontFamily: 'monospace' }}>{r.price}</Typography>
                        </Box>
                      ))}
                </Box>
              </Collapse>
            </Paper>
          ))}
          <Divider />
          <Autocomplete
            size="small"
            options={allTariffs.filter((t) => !tariffs.some((x) => x.uuid === t.uuid))}
            getOptionLabel={(o) => o?.name || ''}
            value={null}
            blurOnSelect
            onChange={(e, t) => addTariff(t)}
            renderInput={(params) => <TextField {...params} placeholder="+ Add tariff" />}
          />
        </Box>
      </Panel>

      {/* Balance */}
      <Panel
        id="balance" expanded={expanded} onToggle={toggle} {...C.balance}
        icon={<BalanceIcon sx={{ fontSize: 18, color: C.balance.color }} />}
        title="Balance"
        chips={<Chip size="small" label={balance} variant="outlined" sx={{ fontFamily: 'monospace' }} />}
      >
        <Box sx={{ display: 'flex', gap: 1, py: 0.25 }}>
          <Typography variant="body2" sx={{ flex: 1 }}>
            tariff: {subscription.tariff?.name || subscription.tariff_uuid || '—'}
          </Typography>
          <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{balance}</Typography>
        </Box>
      </Panel>
    </Box>
  );
}
