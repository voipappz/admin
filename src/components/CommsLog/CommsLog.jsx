import { useState } from 'react';
import { Box, ToggleButtonGroup, ToggleButton } from '@mui/material';
import PhoneIcon from '@mui/icons-material/Phone';
import ChatBubbleOutlineIcon from '@mui/icons-material/ChatBubbleOutline';
import Calls from '../Calls/Calls.jsx';
import Messages from '../Messages/Messages.jsx';
import './CommsLog.css';

/**
 * Logs — the communications log. A segmented switch chooses Calls or Messages,
 * and each renders its existing rich screen (the Calls screen keeps its segments,
 * counters and charts). One screen at a time, not a merged table.
 */
const CommsLog = () => {
  const [view, setView] = useState('calls');

  return (
    <Box className="commslog-root">
      <Box className="commslog-header">
        <ToggleButtonGroup
          value={view}
          exclusive
          onChange={(_, v) => { if (v) setView(v); }}
          size="small"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none', fontWeight: 600, px: 1.5, gap: 0.5 } }}
        >
          <ToggleButton value="calls"><PhoneIcon sx={{ fontSize: 16 }} /> Calls</ToggleButton>
          <ToggleButton value="messages"><ChatBubbleOutlineIcon sx={{ fontSize: 16 }} /> Messages</ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {view === 'calls' ? <Calls /> : <Messages />}
      </Box>
    </Box>
  );
};

export default CommsLog;
