import { useState } from 'react';
import { Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import TerminalIcon from '@mui/icons-material/Terminal';
import Events from '../Events/Events.jsx';
import SystemLogs from '../../views/syslogs/SystemLogs.jsx';
import './LogsHub.css';

/**
 * Logs — the system log hub. A segmented switch chooses Events (application
 * events) or System Logs (syslog), each rendering its existing rich screen.
 * Mirrors the CDRs (CommsLog) pattern, one screen at a time.
 */
const LogsHub = () => {
  // Open on the view named in ?view= (the sidebar's System Logs button uses
  // ?view=syslog); default to events.
  const [view, setView] = useState(() => {
    const v = new URLSearchParams(window.location.search).get('view');
    return v === 'syslog' ? 'syslog' : 'events';
  });

  // The Events/System-Logs switch. On the Events view it rides inline on the
  // date-selector row (passed as leftSlot) to save a whole row; on System Logs
  // it sits in the thin header.
  const tabs = (
    <ToggleButtonGroup
      value={view}
      exclusive
      onChange={(_, v) => { if (v) setView(v); }}
      size="small"
      sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 1.5, gap: 0.5 } }}
    >
      <ToggleButton value="events"><NotificationsActiveIcon sx={{ fontSize: 16 }} /> Events</ToggleButton>
      <ToggleButton value="syslog"><TerminalIcon sx={{ fontSize: 16 }} /> System Logs</ToggleButton>
    </ToggleButtonGroup>
  );

  return (
    <Box className="logshub-root">
      {view === 'syslog' && <Box className="logshub-header">{tabs}</Box>}

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'events' ? <Events leftSlot={tabs} /> : <SystemLogs />}
      </Box>
    </Box>
  );
};

export default LogsHub;
