import { Box, Button } from '@mui/material';
import CallOutlinedIcon from '@mui/icons-material/CallOutlined';
import SensorsIcon from '@mui/icons-material/Sensors';
import { useLocation, useNavigate } from 'react-router';
import { useUserAuth } from '../../context/UserAuthContext';
import { canAccessScreen } from '../../utils/jwt';
import { ON_SURFACE, ON_SURFACE_MUTED, PILL_RADIUS } from '../../theme/portalSurface';

/**
 * The places, at the left end of the bar: Calls and Live.
 *
 * Two of them, so they cost a few centimetres of a bar that was mostly empty —
 * where a rail cost a whole column beside a table that wants the width. Live
 * is simply absent for a user without the `dashboard` permission, rather than
 * greyed: a control that never works is a question nobody should have to ask.
 *
 * Everything else lives in the line (the menu) or the phone (the sidebar).
 */
export const placesFor = (acl) => [
  canAccessScreen(acl, 'calls') && { key: 'calls', label: 'Calls', path: '/my-calls', Icon: CallOutlinedIcon },
  canAccessScreen(acl, 'dashboard') && { key: 'live', label: 'Live', path: '/live', Icon: SensorsIcon },
].filter(Boolean);

export default function PortalNav() {
  const { acl } = useUserAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const places = placesFor(acl);
  // The portal root ("/") is Calls.
  const current = pathname === '/' ? '/my-calls' : pathname;

  return (
    <Box
      component="nav" aria-label="Screens" data-testid="portal-nav"
      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}
    >
      {places.map(({ key, label, path, Icon }) => {
        const active = current === path;
        return (
          <Button
            key={key} onClick={() => navigate(path)} aria-current={active ? 'page' : undefined}
            // The label is display:none below sm, which would leave the button
            // nameless to a screen reader — the icon is not a name.
            aria-label={label}
            data-testid={`nav-${key}`} disableElevation startIcon={<Icon sx={{ fontSize: 19 }} />}
            sx={{
              color: active ? ON_SURFACE : ON_SURFACE_MUTED,
              bgcolor: active ? 'rgba(255,255,255,0.16)' : 'transparent',
              borderRadius: PILL_RADIUS, px: { xs: 1.5, sm: 2 }, minHeight: 42, fontWeight: active ? 700 : 500,
              textTransform: 'none', whiteSpace: 'nowrap',
              '& .MuiButton-startIcon': { mr: { xs: 0, sm: 0.75 } },
              '&:hover': { bgcolor: active ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.09)', color: ON_SURFACE },
            }}
          >
            {/* Icon alone on a narrow screen: two labels plus the line do not
                fit on a phone, and these two icons are unambiguous. */}
            <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' } }}>{label}</Box>
          </Button>
        );
      })}
    </Box>
  );
}
