import React, { useState } from 'react';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import StatChips from '../shared/StatChips/StatChips.jsx';
import LiveDrawer from './LiveDrawer.jsx';

/**
 * LiveChartsPopout — one-line integration for a screen's live charts drawer
 * (the old Home chart groups, each on its relevant screen). Renders a "Live"
 * stat chip that opens a right drawer hosting the given charts panel.
 *
 * Usage: <LiveChartsPopout title="Queue Live Charts" Panel={QueueChartsPanel} />
 */
const LiveChartsPopout = ({ title, Panel, sx }) => {
  const [open, setOpen] = useState(false);
  return (
    <>
      <StatChips
        sx={sx}
        items={[{
          key: 'live-charts',
          label: 'Live Charts',
          value: '',
          icon: <ShowChartIcon />,
          color: '#8b5cf6',
          live: true,
          active: open,
          onClick: () => setOpen(true),
        }]}
      />
      <LiveDrawer
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        icon={<ShowChartIcon sx={{ color: '#8b5cf6' }} />}
      >
        {open && <Panel open={open} />}
      </LiveDrawer>
    </>
  );
};

export default LiveChartsPopout;
