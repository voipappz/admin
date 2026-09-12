import { useState, useEffect, useCallback } from 'react';
import { Box, Typography } from '@mui/material';
import { monitoringApi } from '../../services/api/monitoringApi';

/**
 * Tiny SVG sparkline renderer
 */
const Sparkline = ({ data, color = '#1976d2', width = 80, height = 20 }) => {
  if (!data || data.length < 2) return null;

  const values = data.map(d => d.value || 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = (i / (values.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 2) - 1;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * EnvironmentSparkline — Tiny sparkline chart with live call/registration counts.
 * Shows "3 IN / 2 OUT / 15 REG" with a mini sparkline.
 * Fetches 30min of data at 5m buckets.
 */
const EnvironmentSparkline = ({ environmentUuid }) => {
  const [callData, setCallData] = useState(null);
  const [regData, setRegData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!environmentUuid) return;
    setLoading(true);
    try {
      const [calls, regs] = await Promise.all([
        monitoringApi.getLiveCallsChart(environmentUuid, 30, '5m').catch(() => []),
        monitoringApi.getLiveRegistrationsChart(environmentUuid, 30, '5m').catch(() => [])
      ]);
      setCallData(Array.isArray(calls) ? calls : []);
      setRegData(Array.isArray(regs) ? regs : []);
    } catch {
      setCallData([]);
      setRegData([]);
    } finally {
      setLoading(false);
    }
  }, [environmentUuid]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) return null;

  // Extract latest values
  const incomingSeries = callData?.find(s => s.name === 'incoming')?.series || [];
  const outgoingSeries = callData?.find(s => s.name === 'outgoing')?.series || [];
  const regSeries = regData?.find(s => s.name === 'registrations')?.series || [];

  const latestIn = incomingSeries.length > 0 ? incomingSeries[incomingSeries.length - 1]?.value || 0 : 0;
  const latestOut = outgoingSeries.length > 0 ? outgoingSeries[outgoingSeries.length - 1]?.value || 0 : 0;
  const latestReg = regSeries.length > 0 ? regSeries[regSeries.length - 1]?.value || 0 : 0;

  // Combine in+out for sparkline
  const combinedCalls = incomingSeries.map((d, i) => ({
    ...d,
    value: (d.value || 0) + (outgoingSeries[i]?.value || 0)
  }));

  const hasData = latestIn > 0 || latestOut > 0 || latestReg > 0 || combinedCalls.some(d => d.value > 0);
  if (!hasData) return null;

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      {combinedCalls.length >= 2 && (
        <Sparkline data={combinedCalls} color="#1976d2" width={60} height={16} />
      )}
      <Typography variant="caption" sx={{ fontSize: '0.6rem', color: 'var(--theme-text-secondary)', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
        <span style={{ color: '#2e7d32' }}>{latestIn} IN</span>
        {' / '}
        <span style={{ color: '#d32f2f' }}>{latestOut} OUT</span>
        {' / '}
        <span style={{ color: '#1565c0' }}>{latestReg} REG</span>
      </Typography>
    </Box>
  );
};

export default EnvironmentSparkline;
