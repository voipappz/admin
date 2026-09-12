// PhoneDock — the softphone as a right-docked panel, the legacy portal's
// model: the dashboard is the center of the app and stays put; the phone
// docks beside it rather than replacing it.
//
// Pinned ("stick it open") => persistent drawer, no backdrop, dashboard stays
// usable beside it. Unpinned => an ordinary temporary overlay. Pin state
// survives reloads. Below `sm` it's always a temporary full-width overlay —
// a 380px dock next to a 360px screen leaves a useless sliver of the app.
import { Box, Drawer, IconButton, Tooltip, useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import PushPinIcon from '@mui/icons-material/PushPin';
import PushPinOutlinedIcon from '@mui/icons-material/PushPinOutlined';
import PhoneScreen from './PhoneScreen.jsx';
import { PANEL_HEADER, MUTED, ACCENT } from './panelTheme.js';

export const PHONE_DOCK_WIDTH = 380;
const PIN_KEY = 'sip-phone-pinned';

export const loadPhonePinned = () => {
  try { return localStorage.getItem(PIN_KEY) === '1'; } catch { return false; }
};

export default function PhoneDock({ open, onClose, pinned, onTogglePin }) {
  const theme = useTheme();
  const isNarrow = useMediaQuery(theme.breakpoints.down('sm'), { noSsr: true });
  const persistent = pinned && !isNarrow;

  return (
    <Drawer
      variant={persistent ? 'persistent' : 'temporary'}
      anchor="right"
      open={open}
      onClose={onClose}
      data-testid="phone-dock"
      PaperProps={{
        sx: {
          width: { xs: '100vw', sm: PHONE_DOCK_WIDTH },
          maxWidth: '100vw',
          border: 'none',
          display: 'flex',
          flexDirection: 'column'
        }
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 0.5, px: 1, py: 0.5, bgcolor: PANEL_HEADER }}>
        {!isNarrow && (
          <Tooltip title={pinned ? 'Unstick' : 'Keep open'}>
            <IconButton size="small" sx={{ color: pinned ? ACCENT : MUTED }} onClick={onTogglePin} data-testid="phone-dock-pin">
              {pinned ? <PushPinIcon fontSize="small" /> : <PushPinOutlinedIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}
        <Tooltip title="Close">
          <IconButton size="small" sx={{ color: MUTED }} onClick={onClose} data-testid="phone-dock-close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* The panel fills the drawer — `embedded` drops PhoneScreen's page
          padding/max-width and lets it stretch, so the bottom tabs sit on the
          bottom edge instead of floating above empty space. */}
      <Box sx={{ flex: 1, minHeight: 0, display: 'flex' }}>
        <PhoneScreen embedded />
      </Box>
    </Drawer>
  );
}
