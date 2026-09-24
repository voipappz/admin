import { Badge, Box, IconButton, Tooltip } from '@mui/material';
import CallIcon from '@mui/icons-material/Call';
import { useSoftphone } from '../../context/SoftphoneContext';
import { usePortalSidebar } from '../../context/PortalSidebarContext';
import { ON_SURFACE, ON_SURFACE_MUTED } from '../../theme/portalSurface';

/**
 * The phone, in the bar to the left of the line. One button: the assistant is
 * a tab inside the phone, not a second thing to press, and the phone opens the
 * sidebar where a call's details open too.
 *
 * The icon goes green when the phone is registered — the one control whose
 * readiness matters before you press it — with the dot carrying the finer
 * states (registering amber, failed red).
 */
const DOT = { registered: '#22c55e', registering: '#f59e0b', failed: '#ef4444', unregistered: '#94a3b8' };

export default function PortalActions() {
  const { status } = useSoftphone();
  const { view, toggle } = usePortalSidebar();
  const open = view === 'phone';
  const ready = status === 'registered';
  const label = open ? 'Close phone' : `Phone — ${status ? String(status).replace(/_/g, ' ') : 'not registered'}`;

  return (
    <Tooltip title={label}>
      <IconButton
        aria-label={label} data-testid="phone-button" onClick={() => toggle('phone')}
        sx={{
          width: 44, height: 44, flexShrink: 0, borderRadius: '10px',
          color: ready ? DOT.registered : (open ? ON_SURFACE : ON_SURFACE_MUTED),
          bgcolor: open ? 'rgba(255,255,255,0.16)' : 'transparent',
          '&:hover': { bgcolor: 'rgba(255,255,255,0.09)' },
        }}
      >
        <Badge
          overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={<Box data-testid="phone-status" sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: DOT[status] || DOT.unregistered, border: '2px solid rgba(0,0,0,0.35)' }} />}
        >
          <CallIcon />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
