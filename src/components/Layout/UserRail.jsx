// UserRail — the portal user's navigation: an icon rail with labels, and an
// account button at the bottom.
//
// Deliberately NOT the admin Sidebar: that one carries the
// customer/environment switcher, admin nav groups, health dot, devzone and
// tickets — none of which a customer should see. A small purpose-built rail
// is simpler than parameterising that one down.
import { useState } from 'react';
import {
  Avatar, Box, Divider, ListItemIcon, ListItemText, Menu, MenuItem, Tooltip, Typography
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import PhoneIcon from '@mui/icons-material/Phone';
import HistoryIcon from '@mui/icons-material/History';
import SensorsIcon from '@mui/icons-material/Sensors';
import LogoutIcon from '@mui/icons-material/Logout';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import LightModeIcon from '@mui/icons-material/LightMode';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useLocation, useNavigate } from 'react-router';
import { useUserAuth } from '../../context/UserAuthContext';
import { useAIChatSidebar } from '../../context/AIChatSidebarContext';
import { useThemeMode } from '../../context/ThemeContext';

export const RAIL_WIDTH = 88;

function RailItem({ icon, label, active, badge, onClick, testId }) {
  return (
    <Box
      role="button"
      onClick={onClick}
      data-testid={testId}
      sx={{
        width: '100%',
        py: 1.25,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 0.25,
        cursor: 'pointer',
        userSelect: 'none',
        position: 'relative',
        color: active ? 'primary.main' : '#6b7280',
        bgcolor: active ? 'rgba(92, 107, 192, 0.08)' : 'transparent',
        // Left accent bar on the active item, like the admin rail's.
        '&::before': active ? {
          content: '""', position: 'absolute', insetInlineStart: 0, top: 8, bottom: 8,
          width: 3, borderRadius: 2, bgcolor: 'primary.main'
        } : undefined,
        '&:hover': { bgcolor: active ? 'rgba(92, 107, 192, 0.12)' : '#f3f4f6' }
      }}
    >
      <Box sx={{ position: 'relative', display: 'flex' }}>
        {icon}
        {badge}
      </Box>
      <Typography sx={{ fontSize: '0.68rem', fontWeight: active ? 700 : 500, lineHeight: 1.2 }}>
        {label}
      </Typography>
    </Box>
  );
}

export default function UserRail() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useUserAuth();
  const { isDarkMode, toggleTheme } = useThemeMode();
  const { openAIDrawer } = useAIChatSidebar() || {};
  const [accountAnchor, setAccountAnchor] = useState(null);

  const name = user?.name || user?.fullname || user?.email || 'Account';
  const initial = (String(name).trim()[0] || 'U').toUpperCase();

  return (
    <Box
      component="nav"
      data-testid="user-rail"
      sx={{
        width: RAIL_WIDTH,
        flexShrink: 0,
        height: '100vh',
        position: 'sticky',
        top: 0,
        bgcolor: '#f9fafb',
        borderRight: '1px solid #e5e7eb',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        py: 1
      }}
    >
      <RailItem
        testId="rail-dashboard"
        icon={<DashboardIcon />}
        label="Dashboard"
        active={location.pathname === '/'}
        onClick={() => navigate('/')}
      />
      {/* Live sits between the board and the history: the board is what you
          configure, Calls is what already happened, and this is what is
          happening right now. */}
      <RailItem
        testId="rail-live"
        icon={<SensorsIcon />}
        label="Live"
        active={location.pathname === '/live'}
        onClick={() => navigate('/live')}
      />
      <RailItem
        testId="rail-calls"
        icon={<HistoryIcon />}
        label="Calls"
        active={location.pathname === '/my-calls'}
        onClick={() => navigate('/my-calls')}
      />
      {/* Opens the assistant over the current screen rather than navigating,
          so a question about what is on screen keeps that screen in view. */}
      {openAIDrawer && (
        <RailItem
          testId="rail-assistant"
          icon={<AutoAwesomeIcon />}
          label="Assistant"
          active={false}
          onClick={openAIDrawer}
        />
      )}
      {/* The phone's trigger moved to the bottom right (PhoneFab). It was the
          only item here that did not navigate — it toggles a panel that opens
          on the opposite side of the screen — so it now sits where the dock
          actually appears. Its registration dot moved with it. */}

      <Box sx={{ flex: 1 }} />
      <Divider flexItem sx={{ mb: 1 }} />

      {/* Theme toggle as its own rail item, above the avatar — the slot the
          original app used (a lone moon in the rail's bottom section), so a
          user coming from it finds it where their hand already goes. The
          choice is persisted by ThemeContext, nothing extra here. */}
      <RailItem
        icon={isDarkMode ? <LightModeIcon /> : <DarkModeIcon />}
        label={isDarkMode ? 'Light' : 'Dark'}
        active={false}
        onClick={toggleTheme}
        testId="rail-theme-toggle"
      />

      <Tooltip title={name} placement="right">
        <Avatar
          onClick={(e) => setAccountAnchor(e.currentTarget)}
          data-testid="rail-account"
          sx={{ width: 38, height: 38, bgcolor: 'primary.main', fontSize: '0.95rem', cursor: 'pointer', mb: 1 }}
        >
          {initial}
        </Avatar>
      </Tooltip>

      <Menu
        anchorEl={accountAnchor}
        open={Boolean(accountAnchor)}
        onClose={() => setAccountAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        slotProps={{ paper: { sx: { minWidth: 240 } } }}
      >
        <Box sx={{ px: 2, py: 1.5 }}>
          <Typography sx={{ fontWeight: 700 }} noWrap>{user?.name || user?.fullname || 'Signed in'}</Typography>
          {user?.email && <Typography variant="body2" color="text.secondary" noWrap>{user.email}</Typography>}
        </Box>
        <Divider />
        <MenuItem
          onClick={() => { setAccountAnchor(null); logout(); }}
          data-testid="rail-logout"
        >
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Sign out" />
        </MenuItem>
      </Menu>
    </Box>
  );
}
