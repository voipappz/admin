import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

/**
 * StatCard — a KPI tile: label, big value, optional icon + delta. Ported
 * from app. The accent defaults to a neutral treatment; pass `color` (a hex
 * or theme color like 'success.main') to tint the icon box + value rail.
 */
export default function StatCard({ label, value, icon: Icon, color, delta, deltaLabel, sx }) {
  const accent = color || 'text.primary';
  const trendUp = typeof delta === 'number' ? delta >= 0 : null;

  return (
    <Paper
      elevation={0}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        p: 2.25,
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 3,
        '&::before': {
          content: '""',
          position: 'absolute',
          insetInlineStart: 0,
          top: 0,
          bottom: 0,
          width: 4,
          bgcolor: (theme) => resolveColor(theme, accent),
          opacity: 0.9
        },
        transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
        '&:hover': {
          transform: 'translateY(-3px)',
          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
          borderColor: (theme) => alpha(resolveColor(theme, accent), 0.4)
        },
        ...sx
      }}
    >
      {Icon && (
        <Box
          sx={{
            width: 48,
            height: 48,
            flexShrink: 0,
            borderRadius: 2.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: (theme) => alpha(resolveColor(theme, accent), 0.12),
            color: accent
          }}
        >
          <Icon fontSize="medium" />
        </Box>
      )}

      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', fontWeight: 600, fontSize: '0.8rem', display: 'block', lineHeight: 1.4 }}
          noWrap
        >
          {label}
        </Typography>
        <Typography
          sx={{
            fontWeight: 800,
            lineHeight: 1.2,
            fontSize: { xs: '1.4rem', sm: '1.65rem', md: '1.9rem' },
            fontVariantNumeric: 'tabular-nums',
            unicodeBidi: 'isolate'
          }}
          noWrap
        >
          {value}
        </Typography>
        {delta != null && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            {trendUp ? (
              <TrendingUpIcon sx={{ fontSize: 14, color: 'success.main' }} />
            ) : (
              <TrendingDownIcon sx={{ fontSize: 14, color: 'error.main' }} />
            )}
            <Typography variant="caption" sx={{ color: trendUp ? 'success.main' : 'error.main' }}>
              {delta > 0 ? '+' : ''}{delta}% {deltaLabel || ''}
            </Typography>
          </Box>
        )}
      </Box>
    </Paper>
  );
}

function resolveColor(theme, color) {
  if (typeof color === 'string' && color.includes('.')) {
    const resolved = color.split('.').reduce((o, k) => o?.[k], theme.palette);
    if (resolved) return resolved;
  }
  return color;
}
