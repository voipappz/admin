import { Box, Dialog, IconButton, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';

/**
 * A panel that hangs above the corner buttons, the way a chat bubble opens.
 *
 * The phone and the assistant are the portal's two "reach for it" things, so
 * they share this: a 400px panel over the bottom-right corner, the page still
 * readable beside it — you can ask about the calls while looking at them, or
 * dial while reading a number off the table. Below `md` it takes the screen,
 * because a 400px panel on a 360px phone is not a panel.
 */
export const PANEL_WIDTH = 400;

export default function CornerPanel({ open, onClose, title, offset = 0, testId, children }) {
  // The theme comes from useTheme (which falls back to the default theme)
  // rather than the callback form, which needs a ThemeProvider above it and
  // silently returns false without one.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const head = (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 1.75, py: 0.75, borderBottom: 1, borderColor: 'divider', flexShrink: 0 }}>
      <Box component="span" sx={{ fontWeight: 600, fontSize: '0.9rem' }}>{title}</Box>
      <IconButton onClick={onClose} size="small" aria-label={`Close ${title.toLowerCase()}`}>
        <CloseIcon sx={{ fontSize: 20 }} />
      </IconButton>
    </Box>
  );

  if (isMobile) {
    return (
      <Dialog open={open} onClose={onClose} fullScreen keepMounted data-testid={testId}
        PaperProps={{ sx: { display: 'flex', flexDirection: 'column' } }}>
        {head}
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</Box>
      </Dialog>
    );
  }

  return (
    <Box
      role="dialog" aria-label={title} aria-hidden={!open} data-testid={testId}
      sx={{
        position: 'fixed', right: 20, bottom: 92 + offset, width: PANEL_WIDTH,
        height: 'min(560px, calc(100vh - 160px))', display: open ? 'flex' : 'none', flexDirection: 'column',
        zIndex: (theme) => theme.zIndex.drawer + 1, bgcolor: 'background.paper', border: 1, borderColor: 'divider',
        borderRadius: '12px', boxShadow: '0 12px 32px rgba(0,0,0,0.22)', overflow: 'hidden',
      }}
    >
      {head}
      <Box sx={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>{children}</Box>
    </Box>
  );
}
