import React, { useState, useEffect } from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem } from '@mui/material';
import LiveChartStrip from '../LiveChartStrip';
import { queuesApi } from '../../../services/api/queuesApi';
import { campaignsApi } from '../../../services/api/campaignsApi';
import { environmentsApi } from '../../../services/api/environmentsApi';

/**
 * Entity-scoped live chart panels — the old Home screen's Queues / Campaigns /
 * Applications chart groups, relocated to their DOMAIN screens' pop-out drawers
 * (Routing, Campaigns, Environments). Same LiveChartStrip charts, same entity
 * filter each group had on Home.
 */

const EntityFilterDropdown = ({ label, value, onChange, items, nameKey = 'name' }) => (
  <FormControl size="small" sx={{ minWidth: 220, mb: 2 }}>
    <InputLabel>{label}</InputLabel>
    <Select value={value || ''} label={label} onChange={(e) => onChange(e.target.value || null)}>
      <MenuItem value="">All {label}s</MenuItem>
      {items.map((item) => (
        <MenuItem key={item.uuid} value={item.uuid}>{item[nameKey] || item.uuid}</MenuItem>
      ))}
    </Select>
  </FormControl>
);

const useEntityList = (fetcher, open) => {
  const [items, setItems] = useState([]);
  useEffect(() => {
    if (!open || items.length > 0) return;
    fetcher()
      .then((res) => setItems(Array.isArray(res) ? res : (res?.data || [])))
      .catch((err) => console.error('Error fetching entity list:', err));
  }, [open]);  
  return items;
};

export const QueueChartsPanel = ({ open = true }) => {
  const [filter, setFilter] = useState(null);
  const queues = useEntityList(() => queuesApi.getQueues({ per_page: 500 }), open);
  return (
    <Box>
      <EntityFilterDropdown label="Queue" value={filter} onChange={setFilter} items={queues} />
      <LiveChartStrip
        chartType="queue_stats"
        uuid={filter}
        title="Call Volume"
        series={[
          { field: 'call_count', name: 'Calls', color: '#8b5cf6' },
          { field: 'answer_count', name: 'Answered', color: '#10b981' },
          { field: 'abandoned_count', name: 'Abandoned', color: '#ef4444' },
          { field: 'no_answer_count', name: 'No Answer', color: '#f59e0b' },
          { field: 'timeout_count', name: 'Timeout', color: 'var(--mui-palette-text-secondary)' },
        ]}
      />
      <LiveChartStrip
        chartType="queue_stats"
        uuid={filter}
        title="Live Queue State"
        series={[
          { field: 'ringing_current', name: 'Ringing', color: '#f59e0b' },
          { field: 'pending_current', name: 'Pending', color: 'var(--mui-palette-text-secondary)' },
          { field: 'call_current', name: 'In Call', color: '#ef4444' },
          { field: 'answer_current', name: 'Answered', color: '#10b981' },
        ]}
      />
      <LiveChartStrip
        chartType="queue_stats"
        uuid={filter}
        title="Wrap-up & Callbacks"
        series={[
          { field: 'wrap_count', name: 'Wrap Count', color: '#8b5cf6' },
          { field: 'wrap_counter', name: 'Wrap Counter', color: '#06b6d4' },
          { field: 'callback_count', name: 'Callbacks', color: '#10b981' },
        ]}
      />
    </Box>
  );
};

export const CampaignChartsPanel = ({ open = true }) => {
  const [filter, setFilter] = useState(null);
  const campaigns = useEntityList(() => campaignsApi.getCampaigns({ per_page: 500 }), open);
  return (
    <Box>
      <EntityFilterDropdown label="Campaign" value={filter} onChange={setFilter} items={campaigns} />
      <LiveChartStrip
        chartType="campaign_stats"
        uuid={filter}
        title="Contact Activity"
        series={[
          { field: 'contact_ringing', name: 'Ringing', color: '#f59e0b' },
          { field: 'contact_answer', name: 'Answered', color: '#10b981' },
        ]}
      />
      <LiveChartStrip
        chartType="campaign_stats"
        uuid={filter}
        title="Campaign Performance"
        series={[
          { field: 'leverage', name: 'Leverage', color: '#8b5cf6' },
          { field: 'rate', name: 'Rate', color: '#3b82f6' },
        ]}
      />
    </Box>
  );
};

export const EnvironmentChartsPanel = ({ open = true }) => {
  const [filter, setFilter] = useState(null);
  const environments = useEntityList(() => environmentsApi.getEnvironments(), open);
  return (
    <Box>
      <EntityFilterDropdown label="Application" value={filter} onChange={setFilter} items={environments} />
      <LiveChartStrip
        chartType="environment_stats"
        uuid={filter}
        title="Call Counts"
        series={[
          { field: 'call_incoming_count', name: 'Incoming', color: '#10b981' },
          { field: 'call_outgoing_count', name: 'Outgoing', color: '#8b5cf6' },
        ]}
      />
      <LiveChartStrip
        chartType="environment_stats"
        uuid={filter}
        title="Call Durations"
        series={[
          { field: 'call_incoming_duration', name: 'Incoming Duration', color: '#3b82f6' },
          { field: 'call_outgoing_duration', name: 'Outgoing Duration', color: '#ef4444' },
        ]}
      />
    </Box>
  );
};
