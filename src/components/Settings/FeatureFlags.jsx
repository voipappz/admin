import React, { useState, useEffect, useCallback } from 'react';
import {
  Box, Paper, Typography, Switch, FormControlLabel, TextField, Button, Chip,
  CircularProgress, Alert, Divider, Stack, InputAdornment,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import { featureFlagsApi } from '../../services/api/featureFlagsApi';
import { environmentsApi } from '../../services/api/applicationsApi';
import { useAuth } from '../../context/AuthContext';

/**
 * FeatureFlags — Settings → Feature Flags.
 *
 * Manages the Flipper-backed, per-USER feature service (voipappz-api). Each flag
 * can be turned on globally, for a percentage of users, for a whole environment,
 * or for individual users. Consumer apps read the resolved set at GET /api/features.
 *
 * (User-login OTP is deliberately NOT here — it's a per-CUSTOMER policy, the
 * `login_otp_enabled` key on the customer profile, not a Flipper flag. The
 * server reads it as user → environment → customer.profile, so the environment
 * is only the hop that finds the customer. Set it in the customer edit dialog,
 * under Security.)
 */
const FeatureFlags = () => {
  const { customerUuid } = useAuth();
  const [flags, setFlags] = useState([]);
  const [environments, setEnvironments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);            // name currently mutating
  const [userInputs, setUserInputs] = useState({});  // name -> uuid text field

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [flagList, envList] = await Promise.all([
        featureFlagsApi.list().catch(() => []),
        customerUuid ? environmentsApi.getAllEnvironments(customerUuid).catch(() => []) : Promise.resolve([]),
      ]);
      setFlags(Array.isArray(flagList) ? flagList : []);
      setEnvironments(Array.isArray(envList) ? envList : (envList?.data || []));
    } catch (err) {
      setError(err.message || 'Failed to load feature flags');
    } finally {
      setLoading(false);
    }
  }, [customerUuid]);

  useEffect(() => { load(); }, [load]);

  // Apply one gate, then merge the returned flag state back into the list.
  const apply = useCallback(async (name, gate) => {
    setBusy(name);
    setError(null);
    try {
      const updated = await featureFlagsApi.setGate(name, gate);
      if (updated && updated.name) {
        setFlags((prev) => prev.map((f) => (f.name === name ? updated : f)));
      } else {
        await load();
      }
    } catch (err) {
      setError(err.message || `Failed to update ${name}`);
    } finally {
      setBusy(null);
    }
  }, [load]);

  if (loading) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}><CircularProgress size={28} /></Box>;
  }

  return (
    <Box>
      <Typography variant="body2" sx={{ color: '#666', mb: 2 }}>
        Per-user feature rollouts. Consumer apps read the resolved set at
        {' '}<code>GET /api/features</code>. User-login OTP is a per-environment
        setting, managed under Security — not here.
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>{error}</Alert>}

      {flags.length === 0 && (
        <Typography variant="body2" sx={{ color: '#999', py: 4, textAlign: 'center' }}>
          No feature flags are declared. Add one to <code>AppFeatures::REGISTRY</code> in voipappz-api.
        </Typography>
      )}

      <Stack spacing={2}>
        {flags.map((flag) => {
          const enabledEnvUuids = new Set(flag.environments || []);
          const users = flag.users || [];
          const isBusy = busy === flag.name;
          return (
            <Paper key={flag.name} elevation={0} sx={{ border: '1px solid #e0e0e0', borderRadius: 2, p: 2, opacity: isBusy ? 0.7 : 1 }}>
              {/* Header + global switch */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Box sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{flag.label || flag.name}</Typography>
                  <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#999' }}>{flag.name}</Typography>
                </Box>
                <FormControlLabel
                  control={
                    <Switch
                      checked={!!flag.global}
                      disabled={isBusy}
                      onChange={(e) => apply(flag.name, { scope: 'global', enabled: e.target.checked })}
                    />
                  }
                  label={flag.global ? 'On for everyone' : 'Global off'}
                />
              </Box>

              <Divider sx={{ my: 1.5 }} />

              {/* Percentage of users */}
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, flexWrap: 'wrap' }}>
                <Typography variant="body2" sx={{ minWidth: 140 }}>Percentage of users</Typography>
                <TextField
                  size="small" type="number" defaultValue={flag.percentage_of_actors || 0}
                  disabled={isBusy || flag.global}
                  inputProps={{ min: 0, max: 100, style: { width: 70 } }}
                  InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }}
                  onBlur={(e) => {
                    const pct = Math.max(0, Math.min(100, parseInt(e.target.value, 10) || 0));
                    if (pct !== (flag.percentage_of_actors || 0)) apply(flag.name, { scope: 'percentage', percentage: pct });
                  }}
                />
                <Typography variant="caption" sx={{ color: '#999' }}>
                  deterministic per user{flag.global ? ' — overridden while global is on' : ''}
                </Typography>
              </Box>

              {/* Per-user */}
              <Box sx={{ mb: 1.5 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>Enabled for users ({users.length})</Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                  {users.length === 0 && <Typography variant="caption" sx={{ color: '#999' }}>none</Typography>}
                  {users.map((uuid) => (
                    <Chip key={uuid} size="small" label={uuid} onDelete={isBusy ? undefined : () => apply(flag.name, { scope: 'user', uuid, enabled: false })}
                      sx={{ fontFamily: 'monospace', fontSize: 11 }} />
                  ))}
                </Box>
                <Box sx={{ display: 'flex', gap: 1 }}>
                  <TextField
                    size="small" placeholder="user uuid" value={userInputs[flag.name] || ''}
                    disabled={isBusy}
                    onChange={(e) => setUserInputs((p) => ({ ...p, [flag.name]: e.target.value }))}
                    sx={{ maxWidth: 340 }}
                  />
                  <Button
                    size="small" variant="outlined" startIcon={<PersonAddIcon />}
                    disabled={isBusy || !(userInputs[flag.name] || '').trim()}
                    onClick={() => {
                      const uuid = (userInputs[flag.name] || '').trim();
                      apply(flag.name, { scope: 'user', uuid, enabled: true });
                      setUserInputs((p) => ({ ...p, [flag.name]: '' }));
                    }}
                  >Add</Button>
                </Box>
              </Box>

              {/* Per-environment */}
              {environments.length > 0 && (
                <Box>
                  <Typography variant="body2" sx={{ mb: 0.5 }}>Enabled for environments</Typography>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {environments.map((env) => (
                      <Chip
                        key={env.uuid}
                        size="small"
                        label={env.name || env.uuid}
                        color={enabledEnvUuids.has(env.uuid) ? 'primary' : 'default'}
                        variant={enabledEnvUuids.has(env.uuid) ? 'filled' : 'outlined'}
                        disabled={isBusy}
                        onClick={() => apply(flag.name, { scope: 'environment', uuid: env.uuid, enabled: !enabledEnvUuids.has(env.uuid) })}
                      />
                    ))}
                  </Box>
                </Box>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
};

export default FeatureFlags;
