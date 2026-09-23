import { Suspense, lazy } from 'react';
import { Box } from '@mui/material';
import { HEADER_HEIGHT } from '../../theme/portalSurface';

const PortalMcpAssistant = lazy(() => import('../AIChat/PortalMcpAssistant.jsx'));

// The assistant as a screen — the softkey's destination — rather than a panel
// floating over another screen. It fills the height left under the bar and
// the softkeys, so the conversation scrolls inside it and the page does not.
const SOFTKEYS_HEIGHT = 66;

export default function AssistantScreen() {
  return (
    <Box data-testid="assistant-screen" sx={{ height: `calc(100vh - ${HEADER_HEIGHT + SOFTKEYS_HEIGHT}px)`, minHeight: 360 }}>
      <Suspense fallback={<Box sx={{ p: 3, textAlign: 'center', color: 'text.secondary' }}>Loading…</Box>}>
        <PortalMcpAssistant />
      </Suspense>
    </Box>
  );
}
