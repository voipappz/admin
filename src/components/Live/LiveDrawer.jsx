import React from 'react';
import { Drawer, Box, Typography, IconButton, Tooltip } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * LiveDrawer — right-side pop-out that hosts a live panel. Screens keep their
 * table underneath; a live stat-chip opens this. Mirrors the Events-style
 * "click to reveal more" reveal, but as a wide right drawer for the live grids.
 */
const LiveDrawer = ({ open, onClose, title, icon, count, onRefresh, loading, children, width }) => (
  <Drawer
    anchor="right"
    open={open}
    onClose={onClose}
    PaperProps={{
      sx: {
        width: width || { xs: '100%', sm: '80%', md: '68%', lg: '58%' },
        backgroundColor: '#f5f5f5',
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.5, borderBottom: '1px solid #e0e0e0', backgroundColor: '#fff' }}>
      {icon}
      <Typography variant="h6" sx={{ color: '#333', fontWeight: 700 }}>
        {title}
      </Typography>
      {count !== undefined && count !== null && (
        <Typography variant="h6" sx={{ color: '#10b981', fontWeight: 800 }}>
          ({count})
        </Typography>
      )}
      <Box sx={{ flexGrow: 1 }} />
      {onRefresh && (
        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={onRefresh} disabled={loading} sx={{ color: '#666' }}>
              <RefreshIcon />
            </IconButton>
          </span>
        </Tooltip>
      )}
      <Tooltip title="Close">
        <IconButton onClick={onClose} sx={{ color: '#666' }}>
          <CloseIcon />
        </IconButton>
      </Tooltip>
    </Box>
    <Box sx={{ p: 2, overflowY: 'auto', flexGrow: 1 }}>{children}</Box>
  </Drawer>
);

export default LiveDrawer;
