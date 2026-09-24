import { Box } from '@mui/material';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import SensorsIcon from '@mui/icons-material/Sensors';
import { useLocation, useNavigate } from 'react-router';
import { useUserAuth } from '../../context/UserAuthContext';
import { canAccessScreen } from '../../utils/jwt';
import { SURFACE_RAISED, ON_SURFACE, ON_SURFACE_MUTED, HEADER_HEIGHT } from '../../theme/portalSurface';

/**
 * The softkeys: a desk phone's fixed keys, down the LEFT side of the screen.
 * Always the same keys in the same order, so a hand learns them. Live is
 * simply absent for a user without the `dashboard` permission — three keys
 * rather than a greyed fourth, because a key that never works is a question.
 *
 * Left rather than under the line: the screen beside them is a call table
 * that wants the width, and a vertical rail costs none of it. Below `md` the
 * rail becomes a bottom bar — a phone's keys belong under the thumb, and a
 * 96px column beside a 360px screen is not a column.
 *
 * Only PLACES are here. The phone and the assistant are actions that open a
 * panel, so they live as buttons in the corner beside those panels
 * (PortalCorner), not as rail items that would pretend to be screens.
 */
export const RAIL_WIDTH = 96;
export const RAIL_HEIGHT_MOBILE = 64;
export const softkeysFor = (acl) => [
  canAccessScreen(acl, 'calls') && { key: 'calls', label: 'Calls', path: '/my-calls', Icon: CallOutlinedIcon },
  canAccessScreen(acl, 'dashboard') && { key: 'live', label: 'Live', path: '/live', Icon: SensorsIcon },
].filter(Boolean);

export default function PortalSoftkeys() {
  const { acl } = useUserAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const keys = softkeysFor(acl);
  // The portal root ("/") is Calls.
  const current = pathname === '/' ? '/my-calls' : pathname;

  return (
    <Box
      component="nav" aria-label="Screens" data-testid="portal-softkeys"
      sx={{
        bgcolor: SURFACE_RAISED, color: ON_SURFACE, flexShrink: 0, zIndex: 1050,
        // Rail on the left from md up; a bar across the bottom below it.
        width: { xs: '100%', md: RAIL_WIDTH },
        height: { xs: `calc(${RAIL_HEIGHT_MOBILE}px + env(safe-area-inset-bottom, 0px))`, md: 'auto' },
        position: { xs: 'fixed', md: 'sticky' },
        bottom: { xs: 0, md: 'auto' },
        top: { xs: 'auto', md: HEADER_HEIGHT },
        alignSelf: { md: 'flex-start' },
        maxHeight: { md: `calc(100vh - ${HEADER_HEIGHT}px)` },
        pb: { xs: 'env(safe-area-inset-bottom, 0px)', md: 0 },
        display: 'flex',
        flexDirection: { xs: 'row', md: 'column' },
      }}
    >
      {keys.map(({ key, label, path, Icon }) => {
        const active = current === path;
        return (
          <Box
            key={key} component="button" type="button" onClick={() => navigate(path)}
            aria-current={active ? 'page' : undefined} data-testid={`softkey-${key}`}
            sx={{
              flex: { xs: 1, md: '0 0 auto' },
              bgcolor: active ? 'rgba(255,255,255,0.06)' : 'transparent',
              border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12.5, fontWeight: 500,
              color: active ? ON_SURFACE : ON_SURFACE_MUTED,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0.5,
              px: 0.75, py: { xs: 1, md: 1.75 },
              // The active mark sits on the edge the rail is attached to.
              borderTop: { xs: '3px solid', md: 0 },
              borderTopColor: { xs: active ? 'primary.light' : 'transparent', md: 'transparent' },
              borderInlineStart: { xs: 0, md: '3px solid' },
              borderInlineStartColor: { xs: 'transparent', md: active ? 'primary.light' : 'transparent' },
              '&:hover': { color: ON_SURFACE, bgcolor: 'rgba(255,255,255,0.06)' },
            }}
          >
            <Icon sx={{ fontSize: 22 }} />
            {label}
          </Box>
        );
      })}
    </Box>
  );
}
