import { Alert, Box, Button, ButtonBase, CircularProgress, Tab, Tabs, TextField, Typography } from '@mui/material';
import { usePhoneSignIn } from './PhoneSignIn.js';
import { ACCENT, MUTED } from './panelTheme.js';

const FIELD_SX = {
  '& .MuiOutlinedInput-root': { bgcolor: 'var(--mui-palette-background-paper)', borderRadius: '8px' },
  '& .MuiOutlinedInput-notchedOutline': { border: 'none' },
};

// Static label ABOVE the input, as SipSettingsForm does: floating labels were
// clipped on the tight dark panel.
function Field({ id, label, type = 'text', value, onChange, autoComplete, inputMode }) {
  return (
    <Box sx={{ mb: 1.5 }}>
      <Typography component="label" htmlFor={id} sx={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.02em', color: 'rgba(255,255,255,0.55)', mb: 0.5 }}>
        {label}
      </Typography>
      <TextField
        id={id} size="small" fullWidth type={type} value={value} onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete} inputProps={{ inputMode }} sx={FIELD_SX}
      />
    </Box>
  );
}

/**
 * The phone's sign-in for an account session: as a device of the account, or
 * as a user through the portal's login. See usePhoneSignIn.
 */
export default function PhoneSignIn({ device }) {
  const s = usePhoneSignIn({ device });

  if (s.openedForDevice) {
    return (
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.5, color: '#e5e7eb' }} data-testid="phone-sign-in">
        {s.busy && <CircularProgress size={22} sx={{ color: ACCENT }} />}
        <Typography variant="body2" sx={{ color: MUTED }}>
          {s.busy ? `Signing in as ${device.name || device.username}…` : `Phone for ${device.name || device.username}`}
        </Typography>
        {s.error && <Alert severity="error" sx={{ width: '100%' }}>{s.error}</Alert>}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, color: '#e5e7eb' }} data-testid="phone-sign-in">
      <Tabs
        value={s.mode} onChange={(_, v) => s.setMode(v)} variant="fullWidth"
        sx={{ minHeight: 40, '& .MuiTab-root': { minHeight: 40, color: MUTED, textTransform: 'none' }, '& .Mui-selected': { color: `${ACCENT} !important` }, '& .MuiTabs-indicator': { bgcolor: ACCENT } }}
      >
        <Tab value="device" label="Device" />
        <Tab value="user" label="User login" />
      </Tabs>

      <Box sx={{ p: 1.5, flex: 1, minHeight: 0, overflowY: 'auto' }}>
        {s.error && <Alert severity="error" sx={{ mb: 1.5 }}>{s.error}</Alert>}

        {s.mode === 'device' ? (
          <>
            <Field id="phone-device-search" label="Find a device" value={s.query} onChange={s.setQuery} autoComplete="off" />
            {s.devices.map((d) => (
              <ButtonBase
                key={d.uuid} onClick={() => s.signInAsDevice(d)} disabled={s.busy}
                sx={{ width: '100%', justifyContent: 'space-between', px: 1.25, py: 1, borderRadius: 1, textAlign: 'left', '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' } }}
              >
                <Typography component="span" variant="body2" noWrap>{d.name || d.username}</Typography>
                <Typography component="span" variant="caption" sx={{ color: MUTED, fontFamily: 'monospace', ml: 1 }}>{d.username}</Typography>
              </ButtonBase>
            ))}
          </>
        ) : s.otpStep ? (
          <Box component="form" onSubmit={s.submitCode}>
            <Typography variant="body2" sx={{ color: MUTED, mb: 1.5 }}>Enter the code sent to {s.email}.</Typography>
            <Field id="phone-otp" label="Verification code" value={s.code} onChange={s.setCode} autoComplete="one-time-code" inputMode="numeric" />
            <Button type="submit" fullWidth variant="contained" size="small" disabled={s.busy}>Verify</Button>
          </Box>
        ) : (
          // Its own field names: the admin console's login form uses plain
          // email/password, and the browser would offer that credential here.
          <Box component="form" onSubmit={s.submitUserLogin}>
            <Field id="phone-user-email" label="Email or extension" value={s.email} onChange={s.setEmail} autoComplete="off" />
            <Field id="phone-user-password" label="Password" type="password" value={s.password} onChange={s.setPassword} autoComplete="off" />
            <Button type="submit" fullWidth variant="contained" size="small" disabled={s.busy}>Sign in</Button>
          </Box>
        )}
      </Box>
    </Box>
  );
}
