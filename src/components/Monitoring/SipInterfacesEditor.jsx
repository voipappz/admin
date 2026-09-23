import { Box, Button, Grid, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

// The fields SipInterface reads (voipappz-api lib/models/sip_interface.rb).
// Blank ports fall back on the API: internal 5090, external 5080.
const FIELDS = [
  { key: 'ip_address_internal', label: 'Internal IP' },
  { key: 'ip_address_external', label: 'External IP' },
  { key: 'port_internal', label: 'Internal port', placeholder: '5090' },
  { key: 'port_external', label: 'External port', placeholder: '5080' },
];

// GET /api/nodes adds these to every interface; they are computed from the
// node and the fields above, never stored, so they are not sent back.
const DERIVED = ['node_uuid', 'ip', 'port'];

/** An interface as the API returns it, minus the derived keys. */
export const editableInterface = (iface) =>
  Object.fromEntries(Object.entries(iface || {}).filter(([k]) => !DERIVED.includes(k)));

/**
 * The node's SIP interfaces, one card per interface.
 *
 * The API stores them in the node's own `sip_interfaces` column, one flat
 * hash each, and a write replaces the whole list — so this edits the full
 * array and the dialog sends it as is. Keys this editor does not show are
 * kept on the row and survive a save.
 */
const SipInterfacesEditor = ({ value, onChange, disabled }) => {
  const rows = value || [];

  const update = (index, key, v) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: v } : row)));
  const add = () => onChange([...rows, { name: rows.length ? '' : 'sofia' }]);
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <Box data-testid="node-sip-interfaces">
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Typography variant="subtitle2">SIP Interfaces</Typography>
        <Button size="small" startIcon={<AddIcon />} onClick={add} disabled={disabled} data-testid="sip-interface-add">
          Add interface
        </Button>
      </Box>
      {rows.length === 0 && (
        <Typography variant="body2" color="text.secondary">No SIP interfaces.</Typography>
      )}
      {rows.map((row, index) => (
        <Box
          key={index}
          sx={{ p: 1.5, mb: 1, border: 1, borderColor: 'divider', borderRadius: 1 }}
          data-testid={`sip-interface-${index}`}
        >
          <Grid container spacing={1.5} alignItems="center">
            <Grid item xs={10}>
              <TextField
                label="Name"
                size="small"
                fullWidth
                value={row.name || ''}
                onChange={(e) => update(index, 'name', e.target.value)}
                disabled={disabled}
                inputProps={{ 'data-testid': `sip-interface-${index}-name` }}
              />
            </Grid>
            <Grid item xs={2} sx={{ textAlign: 'right' }}>
              <Tooltip title="Remove interface">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => remove(index)}
                    disabled={disabled}
                    aria-label={`Remove interface ${row.name || index + 1}`}
                  >
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Grid>
            {FIELDS.map((f) => (
              <Grid item xs={6} key={f.key}>
                <TextField
                  label={f.label}
                  size="small"
                  fullWidth
                  placeholder={f.placeholder}
                  value={row[f.key] ?? ''}
                  onChange={(e) => update(index, f.key, e.target.value)}
                  disabled={disabled}
                  inputProps={{ 'data-testid': `sip-interface-${index}-${f.key}` }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Box>
  );
};

export default SipInterfacesEditor;
