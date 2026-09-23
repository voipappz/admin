import { Box } from '@mui/material';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import SensorsIcon from '@mui/icons-material/Sensors';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import DialpadOutlinedIcon from '@mui/icons-material/DialpadOutlined';
import { useLocation, useNavigate } from 'react-router';
import { useUserAuth } from '../../context/UserAuthContext';
import { canAccessScreen } from '../../utils/jwt';
import { SURFACE_RAISED, ON_SURFACE, ON_SURFACE_MUTED } from '../../theme/portalSurface';

/**
 * The softkeys: the row of keys under a desk phone's screen, here under the
 * line. Always the same keys in the same order, so a hand learns them. Live
 * is simply absent for a user without the `dashboard` permission — three keys
 * rather than a greyed fourth, because a key that never works is a question.
 */
export const softkeysFor = (acl) => [
  canAccessScreen(acl, 'calls') && { key: 'calls', label: 'Calls', path: '/my-calls', Icon: CallOutlinedIcon },
  canAccessScreen(acl, 'dashboard') && { key: 'live', label: 'Live', path: '/live', Icon: SensorsIcon },
  { key: 'assistant', label: 'Assistant', path: '/assistant', Icon: SmartToyOutlinedIcon },
  { key: 'phone', label: 'Phone', path: '/phone', Icon: DialpadOutlinedIcon },
].filter(Boolean);

export default function PortalSoftkeys() {
  const { acl } = useUserAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const keys = softkeysFor(acl);
  // The portal root ("/") is Calls.
  const current = pathname === '/' ? '/my-calls' : pathname;

  return (
    <Box component="nav" aria-label="Screens" data-testid="portal-softkeys" sx={{ bgcolor: SURFACE_RAISED, color: ON_SURFACE }}>
      <Box sx={{ maxWidth: 760, mx: 'auto', display: 'grid', gridTemplateColumns: `repeat(${keys.length}, 1fr)` }}>
        {keys.map(({ key, label, path, Icon }) => {
          const active = current === path;
          return (
            <Box
              key={key} component="button" type="button" onClick={() => navigate(path)} aria-current={active ? 'page' : undefined} data-testid={`softkey-${key}`}
              sx={{
                bgcolor: 'transparent', border: 0, borderTop: '3px solid', borderTopColor: active ? 'primary.light' : 'transparent',
                color: active ? ON_SURFACE : ON_SURFACE_MUTED, px: 0.75, pt: 1.25, pb: 1.5, fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5, cursor: 'pointer', '&:hover': { color: ON_SURFACE },
              }}
            >
              <Icon sx={{ fontSize: 20 }} />
              {label}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}
