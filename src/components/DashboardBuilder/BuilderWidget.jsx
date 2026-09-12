import {
  Box, IconButton, LinearProgress, ListItemIcon, ListItemText, Menu,
  MenuItem, Paper, Stack, Typography
} from '@mui/material';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { useState } from 'react';
import { formatWidgetValue, gaugePercent, resolveIcon, thresholdColor } from './widgetPresentation';
import { withDefaults } from './widgetTemplates';
import { useWidgetValue } from './useWidgetValue';

const STAT_TYPES = new Set(['counter', 'gauge', 'stat']);
const CHART_TYPES = new Set(['trend', 'line', 'bar', 'pie']);
const WIDE_TYPES = new Set([...CHART_TYPES, 'table']);

function TrendPreview({ series }) {
  const rows = Array.isArray(series) ? series.slice(-18) : [];
  const values = rows.map((row) => Number(row.value) || 0);
  const max = Math.max(1, ...values);

  return (
    <Box sx={{ height: 112, display: 'flex', alignItems: 'flex-end', gap: 0.5, px: 0.5, pt: 1 }}>
      {values.length ? values.map((value, index) => (
        <Box
          key={`${rows[index]?.time || index}`}
          sx={{ flex: 1, minWidth: 3, height: `${Math.max(6, (value / max) * 100)}%`, bgcolor: 'primary.main', borderRadius: '3px 3px 0 0', opacity: 0.8 }}
        />
      )) : (
        <Typography variant="body2" color="text.secondary" sx={{ m: 'auto' }}>No data yet</Typography>
      )}
    </Box>
  );
}

function TablePreview({ rows, fields }) {
  const columns = (fields?.length ? fields : ['started_at', 'direction', 'status']).slice(0, 4);
  return (
    <Box sx={{ overflow: 'hidden', border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}>
      <Box sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))`, bgcolor: 'action.hover' }}>
        {columns.map((field) => <Typography key={field} variant="caption" sx={{ p: 0.75, fontWeight: 700 }} noWrap>{field}</Typography>)}
      </Box>
      {(rows || []).slice(0, 3).map((row, index) => (
        <Box key={row.id || index} sx={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, columns.length)}, minmax(0, 1fr))`, borderTop: '1px solid', borderColor: 'divider' }}>
          {columns.map((field) => <Typography key={field} variant="caption" color="text.secondary" sx={{ p: 0.75 }} noWrap>{String(row[field] ?? '—')}</Typography>)}
        </Box>
      ))}
      {!rows?.length && <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>No rows yet</Typography>}
    </Box>
  );
}

/**
 * Compact, live-data preview used inside the builder grid. Influx types
 * (counter/gauge/stat/trend/line/bar/pie) query themselves via
 * useWidgetValue; 'table' reads recent_calls off the shared snapshot
 * (Postgres-backed — see useDashboardSnapshot).
 */
export default function BuilderWidget({ widget: storedWidget, snapshot, saving, onEdit, onDuplicate, onDelete }) {
  const [menuAnchor, setMenuAnchor] = useState(null);
  const widget = withDefaults(storedWidget);
  const Icon = resolveIcon(widget.icon);
  const { value, series, error } = useWidgetValue(widget.type !== 'table' ? widget : null);
  const accent = thresholdColor(widget, value) || widget.color || 'primary.main';
  const gaugeValue = gaugePercent(widget, value);

  return (
    <Paper
      elevation={0}
      data-testid={`builder-widget-${widget.uuid}`}
      sx={{
        gridColumn: { xs: 'span 1', md: WIDE_TYPES.has(widget.type) ? 'span 2' : 'span 1' },
        minHeight: WIDE_TYPES.has(widget.type) ? 240 : 200,
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        border: '1px solid', borderColor: 'divider', borderRadius: 2.5,
        bgcolor: 'background.paper',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.05)',
        transition: 'border-color 160ms ease, box-shadow 160ms ease',
        '&:hover': { borderColor: 'text.disabled', boxShadow: '0 12px 30px rgba(15, 23, 42, 0.09)' }
      }}
    >
      <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.75, py: 1.25, borderBottom: '1px solid', borderColor: 'divider', bgcolor: 'action.hover' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle2" sx={{ fontWeight: 750 }} noWrap>{widget.title}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>{widget.type}</Typography>
        </Box>
        <IconButton size="small" disabled={saving} aria-label="Widget actions" onClick={(event) => setMenuAnchor(event.currentTarget)}>
          <MoreVertIcon fontSize="small" />
        </IconButton>
      </Stack>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem onClick={() => { setMenuAnchor(null); onEdit(widget); }}>
          <ListItemIcon><EditOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Edit widget" />
        </MenuItem>
        <MenuItem onClick={() => { setMenuAnchor(null); onDuplicate(widget); }}>
          <ListItemIcon><ContentCopyOutlinedIcon fontSize="small" /></ListItemIcon>
          <ListItemText primary="Duplicate widget" />
        </MenuItem>
        <MenuItem sx={{ color: 'error.main' }} onClick={() => { setMenuAnchor(null); onDelete(widget); }}>
          <ListItemIcon><DeleteOutlineIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText primary="Delete widget" />
        </MenuItem>
      </Menu>

      <Box sx={{ flex: 1, p: 2, minHeight: 0 }}>
        {STAT_TYPES.has(widget.type) && (
          <Stack sx={{ height: '100%' }} justifyContent="center" alignItems="center" spacing={1}>
            <Box sx={{ width: 48, height: 48, borderRadius: 2.5, display: 'grid', placeItems: 'center', bgcolor: 'action.hover', color: accent }}><Icon /></Box>
            {/* Same rule as the dashboard tiles: a value we couldn't fetch
                shows as "—", never as a confident 0. */}
            <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
              {error ? '—' : formatWidgetValue(widget, value)}
            </Typography>
            {error && <Typography variant="caption" color="text.secondary">unavailable</Typography>}
            {widget.type === 'gauge' && <LinearProgress variant="determinate" value={gaugeValue} color="inherit" sx={{ width: '80%', height: 8, borderRadius: 4, color: accent }} />}
          </Stack>
        )}
        {CHART_TYPES.has(widget.type) && <TrendPreview series={series} />}
        {widget.type === 'table' && <TablePreview rows={snapshot?.recent_calls} fields={widget.fields} />}
      </Box>
    </Paper>
  );
}
