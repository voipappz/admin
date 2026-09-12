import { Box, Typography } from '@mui/material';

/**
 * PageHeader — consistent page title block: title + optional subtitle, then an
 * actions slot (and/or a live-status chip) beside it. Ported from app.
 */
export default function PageHeader({ title, subtitle, actions, sx }) {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: { xs: 'column', sm: 'row' },
        alignItems: { xs: 'flex-start', sm: 'center' },
        justifyContent: 'flex-start',
        gap: 1.5,
        mb: 3,
        ...sx
      }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography component="h2" variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.5 }}>
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', flexShrink: { xs: 1, sm: 0 }, maxWidth: '100%' }}>
          {actions}
        </Box>
      )}
    </Box>
  );
}
