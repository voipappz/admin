import { Badge, Box, IconButton, Tooltip } from '@mui/material';
import CallIcon from '@mui/icons-material/Call';
import { useSoftphone } from '../../context/SoftphoneContext';
import { usePortalSidebar } from '../../context/PortalSidebarContext';

// The phone in the account console's top bar: opens the right-hand sidebar,
// as the shared command palette's phone action does. Green when
// registered; the dot carries the finer states.
const DOT = { registered: '#22c55e', registering: '#f59e0b', connecting: '#f59e0b', failed: '#ef4444', unregistered: '#94a3b8' };

export default function TopBarPhoneButton() {
  const { status } = useSoftphone();
  const { view, toggle } = usePortalSidebar();
  const open = view === 'phone';
  const label = open ? 'Close phone' : `Phone — ${status ? String(status).replace(/_/g, ' ') : 'not signed in'}`;

  return (
    <Tooltip title={label}>
      <IconButton
        size="small" aria-label={label} data-testid="topbar-phone-button" onClick={() => toggle('phone')}
        sx={{
          color: '#15803d', bgcolor: 'rgba(34, 197, 94, 0.14)', border: '1px solid rgba(34, 197, 94, 0.35)',
          '&:hover': { bgcolor: 'rgba(34, 197, 94, 0.24)' },
        }}
      >
        <Badge
          overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          badgeContent={<Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: DOT[status] || DOT.unregistered }} />}
        >
          <CallIcon fontSize="small" />
        </Badge>
      </IconButton>
    </Tooltip>
  );
}
