import { Box, LinearProgress, Typography } from '@mui/material';

/**
 * How a window's calls split across a tag — answered, no answer, busy… — as
 * labelled bars rather than another histogram.
 *
 * A stacked histogram answers "when"; this answers "what of", which is what
 * the dashboard is asked at a glance. Rows arrive in the chart shape the API
 * returns ([{ time, <value>: count }]), are summed across buckets, and are
 * shown biggest first with their share.
 */
const TOP = 6;

export const sumByKey = (rows) => {
  const totals = {};
  (Array.isArray(rows) ? rows : []).forEach((bucket) => {
    Object.entries(bucket).forEach(([key, value]) => {
      if (key === 'time') return;
      const n = Number(value) || 0;
      if (n > 0) totals[key] = (totals[key] || 0) + n;
    });
  });
  return totals;
};

const CallsBreakdown = ({ rows, emptyText = 'No calls in this window.' }) => {
  const totals = sumByKey(rows);
  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const sum = entries.reduce((acc, [, n]) => acc + n, 0);

  if (sum === 0) return <Typography color="text.secondary" variant="body2">{emptyText}</Typography>;

  return (
    <Box sx={{ display: 'grid', gap: 1.25 }}>
      {entries.slice(0, TOP).map(([label, count]) => {
        const share = Math.round((count / sum) * 100);
        return (
          <Box key={label}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.5 }}>
              <Typography variant="body2" sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                {label.replace(/_/g, ' ')}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {count.toLocaleString()} · {share}%
              </Typography>
            </Box>
            <LinearProgress
              variant="determinate"
              value={share}
              aria-label={`${label}: ${count} calls, ${share}%`}
              sx={{ height: 8, borderRadius: 999 }}
            />
          </Box>
        );
      })}
      {entries.length > TOP && (
        <Typography variant="caption" color="text.secondary">
          and {entries.length - TOP} more
        </Typography>
      )}
    </Box>
  );
};

export default CallsBreakdown;
