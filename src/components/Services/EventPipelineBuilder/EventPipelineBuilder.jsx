import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Chip,
  Autocomplete,
  TextField,
  IconButton,
  Tooltip,
  Collapse,
  Button,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  LinearProgress,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Switch,
  FormControlLabel,
} from '@mui/material';
import {
  Bolt as TriggerIcon,
  AccountTree as WorkflowIcon,
  Timeline as EventIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  PlayArrow as TestIcon,
  Refresh as RefreshIcon,
  CheckCircle as MatchIcon,
  Cancel as NoMatchIcon,
  Send as SimulateIcon,
} from '@mui/icons-material';
import { eventsApi } from '../../../services/api/eventsApi';
import { servicesApi } from '../../../services/api/servicesApi';

// Event trigger categories
const TRIGGER_CATEGORIES = {
  'Call Events': [
    { value: 'call.start', description: 'Call initiated' },
    { value: 'call.answer', description: 'Call answered' },
    { value: 'call.end', description: 'Call terminated' },
  ],
  'User Events': [
    { value: 'user.ringing', description: 'User phone ringing' },
    { value: 'user.answer', description: 'User answered call' },
    { value: 'user.hangup', description: 'User hung up' },
    { value: 'user.ringing_fail', description: 'Ring failed (timeout/busy)' },
    { value: 'user.status_change', description: 'Agent status changed' },
    { value: 'user.state_change', description: 'Agent state changed' },
  ],
  'Queue Events': [
    { value: 'queue.start', description: 'Caller entered queue' },
    { value: 'queue.end', description: 'Caller left queue' },
  ],
  'Number Events': [
    { value: 'number.ringing', description: 'DID number ringing' },
    { value: 'number.answer', description: 'DID call answered' },
    { value: 'number.hangup', description: 'DID call ended' },
  ],
  'Campaign Events': [
    { value: 'campaign.number_processed', description: 'Campaign processed a number' },
  ],
  'Custom': [
    { value: 'event.custom', description: 'Custom application event' },
  ],
};

const ALL_TRIGGERS = Object.values(TRIGGER_CATEGORIES).flat();

/**
 * EventPipelineBuilder — Embeds EventStore into the Service screen.
 *
 * A service subscribes to EventStore triggers. Dispatch is absolute and
 * server-declared (Service.type → its node), or the service routes matching
 * events to its linked Workflows — nothing to configure here.
 */
const EventPipelineBuilder = ({
  triggers = [],
  onTriggersChange,
  serviceUuid,
  serviceType,
  triggersOnly = false,
  disabled = false,
}) => {
  // Managed types run a fixed platform flow. The server declares it
  // (SERVICE_TYPES[type].steps) so the pipeline is something an operator can
  // read before it runs, instead of behaviour only visible in the API's source.
  const [typeSteps, setTypeSteps] = useState([]);

  useEffect(() => {
    if (!serviceType) { setTypeSteps([]); return; }
    let cancelled = false;
    servicesApi.getTypes()
      .then(types => { if (!cancelled) setTypeSteps(types?.[serviceType]?.steps || []); })
      .catch(() => { if (!cancelled) setTypeSteps([]); });
    return () => { cancelled = true; };
  }, [serviceType]);
  const [expandedSection, setExpandedSection] = useState('triggers');
  const [liveEvents, setLiveEvents] = useState([]);
  const [liveLoading, setLiveLoading] = useState(false);
  const [matchCount, setMatchCount] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const [simulateResult, setSimulateResult] = useState(null);

  // Load live event preview
  const loadLivePreview = useCallback(async () => {
    if (!triggers.length) {
      setLiveEvents([]);
      setMatchCount(null);
      return;
    }
    setLiveLoading(true);
    try {
      const now = Math.floor(Date.now() / 1000);
      const oneHourAgo = now - 3600;
      const params = {
        per_page: 8,
        page: 1,
        from: oneHourAgo,
        to: now,
      };
      if (serviceUuid) {
        params.subject = 'service';
        params.subject_uuid = serviceUuid;
      }
      const response = await eventsApi.fetchLogs(params);
      const events = Array.isArray(response) ? response : response?.data || [];

      const matched = events.filter(ev => {
        const action = ev.action || ev.data?.action || '';
        return triggers.some(t => action.includes(t) || ev.event_type?.toLowerCase().includes(t.split('.')[0]));
      });

      setLiveEvents(events.slice(0, 8));
      setMatchCount(matched.length);
    } catch {
      setLiveEvents([]);
    } finally {
      setLiveLoading(false);
    }
  }, [triggers, serviceUuid]);

  // Fire a test event through the service pipeline
  const runSimulation = useCallback(async () => {
    if (!serviceUuid || !triggers.length) return;
    setSimulating(true);
    setSimulateResult(null);
    try {
      const result = await servicesApi.simulate(serviceUuid, {
        event_name: triggers[0],
        event_data: { simulated: true },
      });
      setSimulateResult(result);
    } catch (err) {
      setSimulateResult({ simulated: false, error: err.message || 'Simulation failed' });
    } finally {
      setSimulating(false);
    }
  }, [serviceUuid, triggers]);

  const toggleSection = (section) => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  const selectedByCategory = useMemo(() => {
    const grouped = {};
    triggers.forEach(trigger => {
      for (const [cat, items] of Object.entries(TRIGGER_CATEGORIES)) {
        if (items.some(t => t.value === trigger)) {
          if (!grouped[cat]) grouped[cat] = [];
          grouped[cat].push(trigger);
          return;
        }
      }
      if (!grouped['Custom']) grouped['Custom'] = [];
      grouped['Custom'].push(trigger);
    });
    return grouped;
  }, [triggers]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Section 1: TRIGGERS */}
      <Paper
        variant="outlined"
        sx={{ overflow: 'hidden', borderColor: expandedSection === 'triggers' ? '#6366f1' : '#e0e0e0' }}
      >
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 1, cursor: 'pointer',
            bgcolor: expandedSection === 'triggers' ? '#f5f3ff' : '#fafafa',
          }}
          onClick={() => toggleSection('triggers')}
        >
          <TriggerIcon sx={{ fontSize: 18, color: '#6366f1' }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
            Event Triggers
          </Typography>
          <Chip
            label={`${triggers.length} active`}
            size="small"
            color={triggers.length > 0 ? 'primary' : 'default'}
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
          {expandedSection === 'triggers'
            ? <ExpandLessIcon sx={{ fontSize: 18 }} />
            : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </Box>
        <Collapse in={expandedSection === 'triggers'}>
          <Divider />
          <Box sx={{ p: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Which EventStore events does this service subscribe to?
            </Typography>

            <Autocomplete
              multiple
              freeSolo
              disabled={disabled}
              options={ALL_TRIGGERS.map(t => t.value)}
              groupBy={(option) => {
                for (const [cat, items] of Object.entries(TRIGGER_CATEGORIES)) {
                  if (items.some(t => t.value === option)) return cat;
                }
                return 'Custom';
              }}
              value={triggers}
              onChange={(_, newValue) => onTriggersChange(newValue)}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  const triggerInfo = ALL_TRIGGERS.find(t => t.value === option);
                  return (
                    <Chip
                      key={key}
                      label={option}
                      size="small"
                      title={triggerInfo?.description}
                      sx={{
                        bgcolor: '#ede9fe',
                        color: '#5b21b6',
                        fontFamily: 'monospace',
                        fontSize: '0.7rem',
                      }}
                      {...tagProps}
                    />
                  );
                })
              }
              renderOption={(props, option) => {
                const { key, ...restProps } = props;
                const info = ALL_TRIGGERS.find(t => t.value === option);
                return (
                  <li key={key} {...restProps}>
                    <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                      <Typography variant="body2" fontFamily="monospace" fontSize="0.8rem">
                        {option}
                      </Typography>
                      {info?.description && (
                        <Typography variant="caption" color="text.secondary">
                          {info.description}
                        </Typography>
                      )}
                    </Box>
                  </li>
                );
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  placeholder="Type or select events (e.g. user.answer, call.end)"
                />
              )}
            />

            {Object.keys(selectedByCategory).length > 0 && (
              <Box sx={{ mt: 1, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                {Object.entries(selectedByCategory).map(([cat, items]) => (
                  <Tooltip key={cat} title={items.join(', ')}>
                    <Chip
                      icon={<TriggerIcon sx={{ fontSize: 14 }} />}
                      label={`${cat}: ${items.length}`}
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem' }}
                    />
                  </Tooltip>
                ))}
              </Box>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* The edit DIALOG is for what you CHANGE. These two panels are read-only
          views of what the service does, and the canvas behind the dialog already
          draws the pipeline — in the dialog they made a form you scroll through
          to reach the two fields you came for. */}
      {!triggersOnly && (<>
      {/* Live Event Preview */}
      <Paper
        variant="outlined"
        sx={{ overflow: 'hidden', mt: -0.1, borderColor: expandedSection === 'preview' ? '#16a34a' : '#e0e0e0' }}
      >
        <Box
          sx={{
            display: 'flex', alignItems: 'center', gap: 1,
            px: 2, py: 1, cursor: 'pointer',
            bgcolor: expandedSection === 'preview' ? '#f0fdf4' : '#fafafa',
          }}
          onClick={() => toggleSection('preview')}
        >
          <EventIcon sx={{ fontSize: 18, color: '#16a34a' }} />
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
            Live Event Preview
          </Typography>
          {matchCount !== null && (
            <Chip
              icon={matchCount > 0 ? <MatchIcon sx={{ fontSize: 12 }} /> : <NoMatchIcon sx={{ fontSize: 12 }} />}
              label={`${matchCount} matches (1h)`}
              size="small"
              color={matchCount > 0 ? 'success' : 'default'}
              sx={{ height: 20, fontSize: '0.65rem' }}
            />
          )}
          <Tooltip title="Refresh preview">
            <IconButton size="small" onClick={(e) => { e.stopPropagation(); loadLivePreview(); }}>
              <RefreshIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {expandedSection === 'preview'
            ? <ExpandLessIcon sx={{ fontSize: 18 }} />
            : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
        </Box>
        <Collapse in={expandedSection === 'preview'}>
          <Divider />
          <Box sx={{ p: 2 }}>
            {triggers.length === 0 ? (
              <Typography variant="caption" color="text.secondary">
                Select triggers above to preview matching events.
              </Typography>
            ) : (
              <>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={liveLoading ? <CircularProgress size={12} /> : <TestIcon sx={{ fontSize: 14 }} />}
                    onClick={loadLivePreview}
                    disabled={liveLoading}
                    sx={{ textTransform: 'none', fontSize: '0.7rem' }}
                  >
                    Test (Last 1h)
                  </Button>
                  {serviceUuid && (
                    <Button
                      size="small"
                      variant="contained"
                      color="warning"
                      startIcon={simulating ? <CircularProgress size={12} color="inherit" /> : <SimulateIcon sx={{ fontSize: 14 }} />}
                      onClick={runSimulation}
                      disabled={simulating || !triggers.length}
                      sx={{ textTransform: 'none', fontSize: '0.7rem' }}
                    >
                      Simulate Event
                    </Button>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    Events that would activate this service
                  </Typography>
                </Box>

                {/* Simulation Results */}
                {simulateResult && (
                  <Alert
                    severity={simulateResult.error ? 'error' : 'success'}
                    sx={{ mb: 1, py: 0.5, '& .MuiAlert-message': { fontSize: '0.75rem', width: '100%' } }}
                    onClose={() => setSimulateResult(null)}
                  >
                    {simulateResult.error ? (
                      <Typography variant="caption">{simulateResult.error}</Typography>
                    ) : (
                      <Box>
                        <Typography variant="caption" fontWeight={600} display="block">
                          Simulated: {simulateResult.event_name}
                        </Typography>
                        {simulateResult.results?.map((r, i) => (
                          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 0.5 }}>
                            <Chip
                              label={r.status}
                              size="small"
                              color={r.status === 'success' ? 'success' : 'error'}
                              sx={{ height: 18, fontSize: '0.6rem' }}
                            />
                            <Typography variant="caption" fontFamily="monospace">
                              {r.action} → {r.handler}
                            </Typography>
                            {r.error && (
                              <Typography variant="caption" color="error.main">{r.error}</Typography>
                            )}
                          </Box>
                        ))}
                        {(!simulateResult.results || simulateResult.results.length === 0) && (
                          <Typography variant="caption" color="text.secondary">
                            No dispatch ran — the type's node is server-declared; check triggers.
                          </Typography>
                        )}
                      </Box>
                    )}
                  </Alert>
                )}

                {liveLoading && <LinearProgress sx={{ my: 1 }} />}

                {liveEvents.length > 0 ? (
                  <Box sx={{
                    border: '1px solid #e5e7eb',
                    borderRadius: 1,
                    overflow: 'hidden',
                    maxHeight: 200,
                  }}>
                    {liveEvents.map((event, idx) => (
                      <Box
                        key={event.event_id || idx}
                        sx={{
                          display: 'flex', gap: 1, px: 1.5, py: 0.5,
                          borderBottom: idx < liveEvents.length - 1 ? '1px solid #f3f4f6' : 'none',
                          bgcolor: idx % 2 === 0 ? '#fafafa' : 'white',
                          alignItems: 'center',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontFamily: 'monospace', color: '#6b7280', minWidth: 60 }}>
                          {event.time ? new Date(event.time).toLocaleTimeString() : ''}
                        </Typography>
                        <Chip
                          label={event.action || event.event_type || '?'}
                          size="small"
                          sx={{ height: 18, fontSize: '0.6rem', fontFamily: 'monospace', bgcolor: '#e0f2fe' }}
                        />
                        <Typography variant="caption" color="text.secondary" sx={{
                          flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {event.msg || event.message || ''}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                ) : !liveLoading ? (
                  <Typography variant="caption" color="text.secondary">
                    No events in the last hour. Click &quot;Test&quot; to check.
                  </Typography>
                ) : null}
              </>
            )}
          </Box>
        </Collapse>
      </Paper>

      {/* Section 5: PIPELINE SUMMARY */}
      {serviceUuid && (
        <Paper
          variant="outlined"
          sx={{ overflow: 'hidden', mt: -0.1, borderColor: expandedSection === 'pipeline' ? '#8b5cf6' : '#e0e0e0' }}
        >
          <Box
            sx={{
              display: 'flex', alignItems: 'center', gap: 1,
              px: 2, py: 1, cursor: 'pointer',
              bgcolor: expandedSection === 'pipeline' ? '#faf5ff' : '#fafafa',
            }}
            onClick={() => toggleSection('pipeline')}
          >
            <WorkflowIcon sx={{ fontSize: 18, color: '#8b5cf6' }} />
            <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
              Execution Pipeline
            </Typography>
            {expandedSection === 'pipeline'
              ? <ExpandLessIcon sx={{ fontSize: 18 }} />
              : <ExpandMoreIcon sx={{ fontSize: 18 }} />}
          </Box>
          <Collapse in={expandedSection === 'pipeline'}>
            <Divider />
            <Box sx={{ p: 2 }}>
              <Alert severity="info" sx={{ py: 0.5, mb: typeSteps.length ? 2 : 0 }}
                icon={<WorkflowIcon sx={{ fontSize: 16 }} />}>
                <Typography variant="caption" component="div" sx={{ lineHeight: 1.8 }}>
                  <>
                    <strong>EventStore</strong> captures event →
                    <strong> Service.triggers</strong> match →
                    <strong> dispatch by Service.type</strong> (server-declared node, or linked workflows)
                  </>
                </Typography>
              </Alert>

              {typeSteps.length > 0 && (
                <Box>
                  <Typography variant="caption" sx={{ fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: 0.6, fontSize: '0.68rem', color: 'text.secondary' }}>
                    {serviceType} runs these steps
                  </Typography>

                  <Box sx={{ mt: 1 }}>
                    {typeSteps.map((step, i) => {
                      // After a simulate, the result's action names are the step
                      // keys — same strings the API logs — so the run lights up
                      // the step it reached.
                      const ran = (simulateResult?.results || [])
                        .some(r => (r.action || r.step) === step.key);
                      return (
                        <Box key={step.key} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start',
                          pb: i === typeSteps.length - 1 ? 0 : 1.5, position: 'relative' }}>
                          {i < typeSteps.length - 1 && (
                            <Box sx={{ position: 'absolute', left: 11, top: 24, bottom: 0,
                              width: 2, bgcolor: 'divider' }} />
                          )}
                          <Box sx={{
                            width: 24, height: 24, borderRadius: '50%', flexShrink: 0, zIndex: 1,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '0.7rem', fontWeight: 700,
                            bgcolor: ran ? '#8b5cf6' : 'background.paper',
                            color: ran ? '#fff' : 'text.secondary',
                            border: '2px solid', borderColor: ran ? '#8b5cf6' : 'divider',
                          }}>
                            {i + 1}
                          </Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                              <Typography variant="body2" sx={{ fontWeight: 600 }}>{step.label}</Typography>
                              {step.conditional && (
                                <Chip label="conditional" size="small" variant="outlined"
                                  sx={{ height: 17, fontSize: '0.6rem' }} />
                              )}
                            </Box>
                            <Typography variant="caption" color="text.secondary">
                              {step.description}
                            </Typography>
                          </Box>
                        </Box>
                      );
                    })}
                  </Box>
                </Box>
              )}
            </Box>
          </Collapse>
        </Paper>
      )}
      </>)}
    </Box>
  );
};

export default EventPipelineBuilder;
