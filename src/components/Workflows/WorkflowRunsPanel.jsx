import { useState, useEffect, useCallback } from 'react';
import { Box, Typography, List, ListItemButton, ListItemIcon, ListItemText, Chip, IconButton, Tooltip, CircularProgress } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import RefreshIcon from '@mui/icons-material/Refresh';
import { apiService } from '../../services/apiService';

/**
 * Recent workflow runs ("sessions") — listed in the Workflows sidebar the same
 * way workflows are. Each run groups the event-store events sharing one run_uuid
 * and shows success/fail. Data comes from GET /api/workflows/runs (login JWT auth).
 *
 * Pure admin component — no API-layer changes; calls apiService directly.
 */
const relativeTime = (ts) => {
  if (!ts) return '';
  const then = new Date(ts).getTime();
  if (Number.isNaN(then)) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
};

const WorkflowRunsPanel = ({ activeWorkflowUuid }) => {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchRuns = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiService.get('/api/workflows/runs', {}, 'fetching workflow runs', false);
      const list = Array.isArray(res) ? res : (res?.data || []);
      setRuns(list);
    } catch {
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchRuns(); }, [fetchRuns, activeWorkflowUuid]);

  // When a workflow is selected, surface its runs first.
  const shown = activeWorkflowUuid
    ? [...runs].sort((a, b) => (b.workflow_uuid === activeWorkflowUuid) - (a.workflow_uuid === activeWorkflowUuid))
    : runs;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <Box sx={{ px: 1.5, pt: 1, pb: 0.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="overline" sx={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: 1, color: 'text.secondary' }}>
          Recent Runs
        </Typography>
        <Tooltip title="Refresh runs">
          <span>
            <IconButton size="small" onClick={fetchRuns} disabled={loading}>
              <RefreshIcon sx={{ fontSize: 14 }} />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      <Box sx={{ maxHeight: 200, overflow: 'auto', px: 0.5, pb: 1 }}>
        {loading && runs.length === 0 ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={16} /></Box>
        ) : shown.length === 0 ? (
          <Typography variant="caption" color="text.disabled" sx={{ display: 'block', px: 1, py: 1, textAlign: 'center' }}>
            No runs yet
          </Typography>
        ) : (
          <List dense disablePadding>
            {shown.map((run) => {
              const ok = run.status === 'success';
              return (
                <ListItemButton
                  key={run.run_uuid}
                  selected={run.workflow_uuid === activeWorkflowUuid}
                  sx={{ borderRadius: 1, mb: 0.25, py: 0.4, px: 1, minHeight: 0, cursor: 'default' }}
                  disableRipple
                >
                  <ListItemIcon sx={{ minWidth: 22 }}>
                    {ok
                      ? <CheckCircleIcon sx={{ fontSize: 14, color: '#43a047' }} />
                      : <ErrorIcon sx={{ fontSize: 14, color: '#e53935' }} />}
                  </ListItemIcon>
                  <ListItemText
                    primary={run.workflow_name || run.workflow_uuid?.slice(0, 8) || 'run'}
                    secondary={`${relativeTime(run.started_at)} · ${run.event_count || 0} events`}
                    primaryTypographyProps={{ variant: 'body2', fontSize: '0.74rem', noWrap: true }}
                    secondaryTypographyProps={{ variant: 'caption', fontSize: '0.58rem', noWrap: true }}
                  />
                  <Chip
                    label={ok ? 'success' : 'failed'}
                    size="small"
                    sx={{
                      height: 16, fontSize: '0.55rem',
                      bgcolor: ok ? '#43a04722' : '#e5393522',
                      color: ok ? '#2e7d32' : '#c62828',
                    }}
                  />
                </ListItemButton>
              );
            })}
          </List>
        )}
      </Box>
    </Box>
  );
};

export default WorkflowRunsPanel;
