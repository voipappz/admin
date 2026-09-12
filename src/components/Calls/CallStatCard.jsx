import { Box, Typography, Tooltip } from '@mui/material';

/**
 * One number from the call summary, sized like the headline it is.
 *
 * Clicking toggles the matching filter — the same `search[call.*]` param the
 * filter pills read, so a card and its pill are two ways into one piece of
 * state, never two copies of it.
 *
 * `value == null` means "we don't know" (loading, nothing in scope, or the
 * aggregate request failed) and renders "—". It must never render 0: the whole
 * reason this screen showed a confident "0 Total" next to a chart with 16 calls
 * was a failure that degraded silently into a number.
 */
const CallStatCard = ({ label, value, color, active, onClick, tooltip }) => {
  const known = value != null;

  const card = (
    <Box
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(e); }
      } : undefined}
      sx={{
        px: 1.75, py: 0.85, minWidth: 96, borderRadius: 1.5,
        cursor: onClick ? 'pointer' : 'default',
        userSelect: 'none',
        // `color` is a theme-aware CSS var (--counter-*), so it can't be
        // string-concatenated into an alpha. The active tint therefore uses the
        // existing --theme-hover, and colour carries in the border and number.
        // Idle keeps a hairline border so selecting one doesn't shift the row.
        bgcolor: active ? 'var(--theme-hover)' : 'transparent',
        border: '1px solid',
        borderColor: active ? color : 'var(--theme-border)',
        transition: 'background-color .12s, border-color .12s',
        '&:hover': onClick ? { bgcolor: 'var(--theme-hover)', borderColor: color } : undefined,
        '&:focus-visible': { outline: `2px solid ${color}`, outlineOffset: 2 },
      }}
    >
      <Typography sx={{
        fontSize: '1.35rem', fontWeight: 700, lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums',
        color: known ? color : 'var(--theme-text-secondary)',
      }}>
        {known ? value : '—'}
      </Typography>
      <Typography sx={{
        fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.05em',
        textTransform: 'uppercase', color: 'var(--theme-text-secondary)', lineHeight: 1.4,
      }}>
        {label}
      </Typography>
    </Box>
  );

  const title = known ? tooltip : 'No data for the current selection';
  return title ? <Tooltip title={title}>{card}</Tooltip> : card;
};

export default CallStatCard;
