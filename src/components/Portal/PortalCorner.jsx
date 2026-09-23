import { Suspense, lazy, useEffect } from 'react';
import { Badge, Box, Fab, Tooltip } from '@mui/material';
import CallIcon from '@mui/icons-material/Call';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import CloseIcon from '@mui/icons-material/Close';
import { useSoftphone } from '../../context/SoftphoneContext';
import { usePortalPanels } from '../../context/PortalPanelsContext';
import CornerPanel from './CornerPanel.jsx';
import { RAIL_HEIGHT_MOBILE } from './PortalSoftkeys.jsx';
import PhoneScreen from '../Phone/PhoneScreen.jsx';

const PortalMcpAssistant = lazy(() => import('../AIChat/PortalMcpAssistant.jsx'));

/**
 * The two things you reach for, in the corner: the phone and the assistant.
 *
 * They are buttons rather than rail items because neither is a place — the
 * rail navigates (Calls, Live), these two act, and an action that opens a
 * panel belongs next to the panel it opens. Stacked: the phone above the
 * assistant, so the phone (the one with a registration state worth watching)
 * sits where the eye lands first and keeps its status dot.
 *
 * Only one panel is open at a time (PortalPanelsContext, shared with the
 * line's Phone and Assistant rows). Two 400px panels over the same corner
 * would overlap, and there is no reason to dial and ask at once.
 */
const DOT = { registered: '#22c55e', registering: '#f59e0b', failed: '#ef4444', unregistered: '#94a3b8' };
export const CORNER_CLEARANCE = 152; // px of content padding the two buttons need

export default function PortalCorner() {
  const { status } = useSoftphone();
  const { panel, toggle, close } = usePortalPanels();

  // Cmd/Ctrl+Shift+A for the assistant, as it has always been.
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') { e.preventDefault(); toggle('assistant'); }
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggle, close]);

  const phoneOpen = panel === 'phone';
  const assistantOpen = panel === 'assistant';
  const phoneLabel = phoneOpen ? 'Close phone' : `Phone — ${status ? String(status).replace(/_/g, ' ') : 'not registered'}`;

  return (
    <>
      <CornerPanel open={phoneOpen} onClose={close} title="Phone" testId="phone-panel">
        <PhoneScreen embedded />
      </CornerPanel>
      <CornerPanel open={assistantOpen} onClose={close} title="Assistant" testId="assistant-panel">
        <Suspense fallback={<Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>Loading…</Box>}>
          <PortalMcpAssistant />
        </Suspense>
      </CornerPanel>

      <Box
        data-testid="portal-corner"
        sx={{
          position: 'fixed', right: 20, zIndex: (theme) => theme.zIndex.drawer + 2,
          // On a phone the rail is a bottom bar, so the buttons stack above it.
          bottom: { xs: `calc(${RAIL_HEIGHT_MOBILE + 16}px + env(safe-area-inset-bottom, 0px))`, md: 20 },
          display: 'flex', flexDirection: 'column-reverse', gap: 1.5, alignItems: 'center',
        }}
      >
        <Tooltip title={assistantOpen ? 'Close assistant' : 'Assistant'} placement="left" arrow>
          <Fab color="secondary" size="medium" aria-label={assistantOpen ? 'Close assistant' : 'Assistant'} data-testid="assistant-fab"
            onClick={() => toggle('assistant')} sx={{ boxShadow: 4 }}>
            {assistantOpen ? <CloseIcon /> : <SmartToyOutlinedIcon />}
          </Fab>
        </Tooltip>
        <Tooltip title={phoneLabel} placement="left" arrow>
          <Badge overlap="circular" anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            badgeContent={<Box data-testid="phone-fab-status" sx={{ width: 12, height: 12, borderRadius: '50%', bgcolor: DOT[status] || DOT.unregistered, border: '2px solid #fff' }} />}>
            <Fab color="primary" aria-label={phoneLabel} data-testid="phone-fab" onClick={() => toggle('phone')} sx={{ boxShadow: 4 }}>
              {phoneOpen ? <CloseIcon /> : <CallIcon />}
            </Fab>
          </Badge>
        </Tooltip>
      </Box>
    </>
  );
}
