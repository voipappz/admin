import { Box, Paper, Typography } from '@mui/material';
import { DataGrid } from '@mui/x-data-grid';

const gridSx = {
  border: 'none', fontSize: '0.8rem',
  '& .MuiDataGrid-columnHeaders': { backgroundColor: 'var(--widget-header-bg)' },
  '& .MuiDataGrid-cell': { borderBottom: '1px solid var(--theme-border)', color: 'var(--theme-text-primary)' },
  '& .MuiDataGrid-row:hover': { backgroundColor: 'var(--theme-hover)' },
};

/**
 * TablePanel — MUI DataGrid in a styled card
 *
 * Props:
 *   title    — panel heading
 *   rows     — data rows (must have `id` field)
 *   columns  — DataGrid column definitions
 *   loading  — boolean
 *   height   — container height (default 320)
 */
const TablePanel = ({ title, rows = [], columns = [], loading, height = 320 }) => (
  <Paper elevation={0} sx={{ border: '1px solid var(--theme-border)', borderRadius: '12px', backgroundColor: 'var(--theme-bg-primary)', overflow: 'hidden' }}>
    {title && (
      <Box sx={{ p: 2, borderBottom: '1px solid var(--theme-border)' }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, color: 'var(--theme-text-primary)' }}>{title}</Typography>
      </Box>
    )}
    <Box sx={{ height }}>
      <DataGrid
        rows={rows}
        columns={columns}
        loading={loading}
        density="compact"
        hideFooter={rows.length <= 10}
        pageSizeOptions={[10, 25]}
        initialState={{ pagination: { paginationModel: { pageSize: 10 } } }}
        sx={gridSx}
      />
    </Box>
  </Paper>
);

export default TablePanel;
