import { useEffect } from 'react';
import { Box, Drawer, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { usePortalSidebar } from '../../context/PortalSidebarContext';
import PhoneScreen from '../Phone/PhoneScreen.jsx';
import CallDetailPanel from '../Calls/CallDetailPanel/CallDetailPanel.jsx';

/**
 * The portal's one sidebar, open on the left.
 *
 * The phone opens here, and so does a call's details — same drawer, same edge,
 * so there is one place on the screen where things appear. It replaces the
 * phone dock, the two floating panels and the call detail column that used to
 * sit on the right and get covered by the corner buttons.
 *
 * Full width below `sm`: 380px beside a 360px screen leaves a useless sliver.
 */
export const SIDEBAR_WIDTH = 380;

export default function PortalSidebar() {
  const { view, params, close } = usePortalSidebar();

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [close]);

  return (
    <Drawer
      anchor="left" open={Boolean(view)} onClose={close} data-testid="portal-sidebar"
      PaperProps={{ sx: { width: { xs: '100vw', sm: SIDEBAR_WIDTH }, maxWidth: '100vw', border: 'none', display: 'flex', flexDirection: 'column' } }}
    >
      {/* The phone draws its own header (avatar, extension, registration), so
          only the detail view needs a bar of its own; both need a way out. */}
      {view === 'call' ? (
        <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', '& .call-detail-panel': { width: '100%' } }}>
          <CallDetailPanel call={params?.call} onClose={close} onOpenRecording={params?.onOpenRecording} onCallBack={params?.onCallBack} isMobile={false} />
        </Box>
      ) : (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', px: 0.5, py: 0.5, bgcolor: '#2f3640' }}>
            <Tooltip title="Close">
              <IconButton size="small" onClick={close} data-testid="sidebar-close" sx={{ color: '#9aa6b6' }}>
                <CloseIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          </Box>
          <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
            <PhoneScreen embedded initialTab={params?.tab} />
          </Box>
        </>
      )}
    </Drawer>
  );
}
