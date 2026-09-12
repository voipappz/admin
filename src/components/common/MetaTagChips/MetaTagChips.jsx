import { Box, Chip, Typography } from '@mui/material';

/**
 * MetaTagChips - Renders meta key-value object as small inline chips
 * Used across all list screens to display entity meta/tags
 */
const MetaTagChips = ({ meta, maxDisplay = 3 }) => {
  if (!meta || typeof meta !== 'object') return <Typography variant="body2" color="text.secondary">-</Typography>;

  const entries = Object.entries(meta);
  if (entries.length === 0) return <Typography variant="body2" color="text.secondary">-</Typography>;

  const displayed = entries.slice(0, maxDisplay);
  const remaining = entries.length - maxDisplay;

  return (
    <Box sx={{ display: 'flex', gap: 0.3, flexWrap: 'wrap', alignItems: 'center' }}>
      {displayed.map(([key, value]) => (
        <Chip
          key={key}
          label={value ? `${key}: ${value}` : key}
          size="small"
          variant="outlined"
          sx={{
            height: 20,
            fontSize: '0.7rem',
            maxWidth: 140,
            '& .MuiChip-label': { px: 0.75 }
          }}
        />
      ))}
      {remaining > 0 && (
        <Typography variant="caption" sx={{ color: 'text.secondary', fontSize: '0.65rem' }}>
          +{remaining}
        </Typography>
      )}
    </Box>
  );
};

export default MetaTagChips;
