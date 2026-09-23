import { useState } from 'react';
import { Box, Button, Checkbox, FormControlLabel, IconButton, Popover, Typography } from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';

export default function PortalColumnsSelector({ columns, selected, disabled, onChange }) {
  const [anchor, setAnchor] = useState(null);
  const move = (key, delta) => {
    const next = [...selected];
    const index = next.indexOf(key);
    [next[index], next[index + delta]] = [next[index + delta], next[index]];
    onChange(next);
  };
  return <>
    <Button variant="outlined" disabled={disabled} onClick={(event) => setAnchor(event.currentTarget)}>Columns</Button>
    <Popover open={Boolean(anchor)} anchorEl={anchor} onClose={() => setAnchor(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}>
      <Box sx={{ p: 2, minWidth: 290 }}>
        <Typography fontWeight={700} sx={{ mb: 1 }}>Your columns and order</Typography>
        {columns.map((column) => {
          const index = selected.indexOf(column.field);
          const label = column.headerName || column.field;
          return <Box key={column.field} sx={{ display: 'flex', alignItems: 'center' }}>
            <FormControlLabel sx={{ flex: 1 }} label={label} control={<Checkbox checked={index >= 0} onChange={(_, checked) => onChange(checked ? [...selected, column.field] : selected.filter((key) => key !== column.field))} />} />
            <IconButton size="small" aria-label={`Move ${label} left`} disabled={index <= 0} onClick={() => move(column.field, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
            <IconButton size="small" aria-label={`Move ${label} right`} disabled={index < 0 || index >= selected.length - 1} onClick={() => move(column.field, 1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
          </Box>;
        })}
      </Box>
    </Popover>
  </>;
}
