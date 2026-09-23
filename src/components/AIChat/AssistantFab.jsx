import { Fab, Tooltip, Box } from '@mui/material';
import SmartToyOutlinedIcon from '@mui/icons-material/SmartToyOutlined';
import CloseIcon from '@mui/icons-material/Close';

/**
 * AssistantFab — the portal's quick bot, bottom RIGHT.
 *
 * This corner used to hold the phone. The phone is a panel you toggle and it
 * now lives on the left, drawn as a hamburger beside the dock it opens; the
 * assistant is something you ask, and a chat bubble in the bottom-right corner
 * is where every messaging surface has taught people to look for one. It opens
 * the same MCP assistant the header link used to (Layout's quick-bot panel),
 * anchored above this button rather than as a centred dialog.
 */
export const ASSISTANT_FAB_CLEARANCE = 88; // px of content padding the FAB needs

export default function AssistantFab({ open, onToggle }) {
  const label = open ? 'Close assistant' : 'Assistant';
  return (
    <Tooltip title={label} placement="left" arrow>
      <Box
        sx={{
          position: 'fixed',
          right: 20,
          bottom: { xs: 'calc(80px + env(safe-area-inset-bottom))', md: 20 },
          zIndex: (theme) => theme.zIndex.drawer + 2,
        }}
      >
        <Fab color="secondary" aria-label={label} data-testid="assistant-fab" onClick={onToggle} sx={{ boxShadow: 4 }}>
          {open ? <CloseIcon /> : <SmartToyOutlinedIcon />}
        </Fab>
      </Box>
    </Tooltip>
  );
}
