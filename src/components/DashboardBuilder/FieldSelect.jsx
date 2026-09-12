import { useEffect, useMemo, useState } from 'react';
import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import { monitoringApi } from '../../services/api/monitoringApi';

const AGGREGATIONS = ['mean', 'sum', 'max', 'min', 'last', 'first', 'count'];

/**
 * FieldSelect — measurement -> field -> aggregation, fed by the SAME live
 * schema call InfluxMetricExplorer uses (monitoringApi.getInfluxSchema()),
 * not a fixed list. A 'table' widget (recent calls) has no measurement to
 * pick — it renders nothing here.
 */
export default function FieldSelect({ widget, onChange }) {
  const [schema, setSchema] = useState([]);
  const [schemaError, setSchemaError] = useState(null);

  useEffect(() => {
    let alive = true;
    monitoringApi.getInfluxSchema()
      .then((s) => { if (alive) setSchema(Array.isArray(s) ? s : []); })
      .catch((e) => { if (alive) setSchemaError(e?.message || 'Failed to load schema'); });
    return () => { alive = false; };
  }, []);

  const measurements = useMemo(() => schema.map((s) => s.measurement).filter(Boolean).sort(), [schema]);
  const fields = useMemo(() => {
    const m = schema.find((s) => s.measurement === widget.measurement);
    return (m?.fields || []).map((f) => (typeof f === 'string' ? f : f.name)).filter(Boolean).sort();
  }, [schema, widget.measurement]);

  if (widget.type === 'table') {
    return (
      <Typography variant="body2" color="text.secondary">
        Recent calls reads from the calls list directly — no metric to pick.
      </Typography>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Metric</Typography>
      {schemaError && (
        <Typography variant="caption" color="error" sx={{ display: 'block', mb: 1 }}>
          Schema: {schemaError}
        </Typography>
      )}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5 }}>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Measurement</InputLabel>
          <Select
            label="Measurement"
            value={widget.measurement || ''}
            onChange={(e) => onChange({ measurement: e.target.value, field: '' })}
          >
            {measurements.map((m) => <MenuItem key={m} value={m}>{m}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 180 }} disabled={!widget.measurement}>
          <InputLabel>Field</InputLabel>
          <Select label="Field" value={widget.field || ''} onChange={(e) => onChange({ field: e.target.value })}>
            {fields.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
          </Select>
        </FormControl>

        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Aggregation</InputLabel>
          <Select label="Aggregation" value={widget.aggregation || 'mean'} onChange={(e) => onChange({ aggregation: e.target.value })}>
            {AGGREGATIONS.map((a) => <MenuItem key={a} value={a}>{a}</MenuItem>)}
          </Select>
        </FormControl>
      </Box>
    </Box>
  );
}
