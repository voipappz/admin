import { Popover, Box, Typography } from '@mui/material';

const InfoPopover = ({ anchorEl, onClose, title, entries }) => (
  <Popover
    open={Boolean(anchorEl)}
    anchorEl={anchorEl}
    onClose={onClose}
    anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
    transformOrigin={{ vertical: 'top', horizontal: 'left' }}
    sx={{
      '& .MuiPaper-root': {
        borderRadius: '8px',
        border: '1px solid var(--border-light)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.12)',
        backgroundColor: 'var(--theme-bg-primary)',
        mt: 0.5,
        minWidth: 240,
        maxWidth: 360,
      }
    }}
  >
    <Box sx={{ p: 1.5 }}>
      {title && (
        <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)', fontWeight: 600, fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.5px', mb: 1, display: 'block' }}>
          {title}
        </Typography>
      )}
      {(entries || []).map((entry, i) => (
        <Box key={i} sx={{ display: 'flex', gap: 1, py: 0.4, borderBottom: i < entries.length - 1 ? '1px solid var(--border-light, #f0f0f0)' : 'none' }}>
          <Typography variant="caption" sx={{ color: 'var(--theme-text-secondary)', fontSize: '0.72rem', minWidth: 70, flexShrink: 0 }}>
            {entry.label}
          </Typography>
          <Typography variant="caption" sx={{ color: 'var(--theme-text-primary)', fontSize: '0.72rem', fontFamily: 'monospace', wordBreak: 'break-all' }}>
            {entry.value ?? '-'}
          </Typography>
        </Box>
      ))}
    </Box>
  </Popover>
);

export default InfoPopover;
