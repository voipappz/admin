import { Box } from '@mui/material';

/**
 * WidgetGrid — responsive CSS grid for dashboard widgets
 *
 * Props:
 *   columns  — number of grid columns (default 12)
 *   gap      — grid gap in spacing units (default 2)
 *   children — widgets; each can have a `span` prop via the Slot wrapper
 */
const WidgetGrid = ({ columns = 12, gap = 2, children }) => (
  <Box sx={{
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gap,
    '& > *': { minWidth: 0 },
  }}>
    {children}
  </Box>
);

/**
 * Slot — wraps a child to control its column span within WidgetGrid
 */
export const Slot = ({ span = 12, children }) => (
  <Box sx={{ gridColumn: { xs: '1 / -1', md: `span ${span}` } }}>
    {children}
  </Box>
);

export default WidgetGrid;
