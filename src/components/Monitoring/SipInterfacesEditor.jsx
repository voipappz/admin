import {
  Box, Button, IconButton, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Tooltip, Typography,
} from '@mui/material';
import { Add as AddIcon, Delete as DeleteIcon } from '@mui/icons-material';

// The fields SipInterface reads (voipappz-api lib/models/sip_interface.rb),
// one table column each. Blank ports fall back on the API: internal 5090,
// external 5080 — which is why their examples are those values.
const COLUMNS = [
  { key: 'name', label: 'Name', example: 'sofia', kind: 'name' },
  { key: 'ip_address_internal', label: 'Internal IP', example: '10.0.0.5', kind: 'ip' },
  { key: 'port_internal', label: 'Internal port', example: '5090', kind: 'port' },
  { key: 'ip_address_external', label: 'External IP', example: '203.0.113.10', kind: 'ip' },
  { key: 'port_external', label: 'External port', example: '5080', kind: 'port' },
];

// GET /api/nodes adds these to every interface; they are computed from the
// node and the fields above, never stored, so they are not sent back.
const DERIVED = ['node_uuid', 'ip', 'port'];

/** An interface as the API returns it, minus the derived keys. */
export const editableInterface = (iface) =>
  Object.fromEntries(Object.entries(iface || {}).filter(([k]) => !DERIVED.includes(k)));

const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;

const formatError = (kind, value) => {
  const v = String(value ?? '').trim();
  if (!v) return null;
  if (kind === 'ip' && !IPV4.test(v)) return 'IPv4, e.g. 10.0.0.5';
  if (kind === 'port' && !(/^\d+$/.test(v) && Number(v) >= 1 && Number(v) <= 65535)) return '1-65535';
  if (kind === 'name' && !/^[A-Za-z0-9_.-]+$/.test(v)) return 'Letters, digits, - _ .';
  return null;
};

/**
 * Errors per interface, as { [index]: { [field]: message } }; empty when every
 * row is valid. Ports and IPs may be blank (the API has defaults), a name may
 * not, and anything filled in must be well-formed — a malformed value would be
 * stored as-is in the node's hstore and break its SIP profile later.
 */
export const interfaceErrors = (rows) => {
  const errors = {};
  (rows || []).forEach((row, i) => {
    const e = {};
    COLUMNS.forEach((c) => {
      const msg = formatError(c.kind, row?.[c.key]);
      if (msg) e[c.key] = msg;
    });
    if (!String(row?.name ?? '').trim()) e.name = 'Required';
    if (Object.keys(e).length) errors[i] = e;
  });
  return errors;
};

/**
 * The node's SIP interfaces as a table: one row per interface, "Add
 * interface" appends a row, the bin removes one.
 *
 * The API stores them in the node's own `sip_interfaces` column, one flat
 * hash each, and a write replaces the whole list — so this edits the full
 * array and the dialog sends it as is. Keys this editor does not show are kept
 * on the row and survive a save.
 *
 * Format errors show as you type; "Required" on an empty name only once the
 * dialog has tried to save (`showErrors`), so a fresh row is not born red.
 */
const SipInterfacesEditor = ({ value, onChange, disabled, showErrors = false }) => {
  const rows = value || [];
  const errors = interfaceErrors(rows);
  const errorFor = (i, key) => {
    const msg = errors[i]?.[key];
    if (!msg) return null;
    return msg === 'Required' && !showErrors ? null : msg;
  };

  const update = (index, key, v) =>
    onChange(rows.map((row, i) => (i === index ? { ...row, [key]: v } : row)));
  const add = () => onChange([...rows, { name: rows.length ? '' : 'sofia' }]);
  const remove = (index) => onChange(rows.filter((_, i) => i !== index));

  return (
    <Box data-testid="node-sip-interfaces">
      <Typography variant="subtitle2" sx={{ mb: 1 }}>SIP Interfaces</Typography>
      <TableContainer sx={{ border: 1, borderColor: 'divider', borderRadius: 1 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableCell key={c.key} sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{c.label}</TableCell>
              ))}
              <TableCell padding="checkbox" />
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1}>
                  <Typography variant="body2" color="text.secondary">
                    No SIP interfaces. Add one for each SIP profile this node listens on.
                  </Typography>
                </TableCell>
              </TableRow>
            )}
            {rows.map((row, index) => (
              <TableRow key={index} data-testid={`sip-interface-${index}`} sx={{ verticalAlign: 'top' }}>
                {COLUMNS.map((c) => {
                  const err = errorFor(index, c.key);
                  return (
                    <TableCell key={c.key} sx={{ px: 0.75, py: 1 }}>
                      <TextField
                        size="small"
                        fullWidth
                        placeholder={c.example}
                        value={row[c.key] ?? ''}
                        onChange={(e) => update(index, c.key, e.target.value)}
                        disabled={disabled}
                        error={!!err}
                        helperText={err}
                        inputProps={{
                          'aria-label': `${c.label} of interface ${index + 1}`,
                          'data-testid': `sip-interface-${index}-${c.key}`,
                          ...(c.kind === 'port' ? { inputMode: 'numeric' } : {}),
                        }}
                        sx={{ minWidth: c.kind === 'port' ? 84 : 120 }}
                      />
                    </TableCell>
                  );
                })}
                <TableCell padding="checkbox" sx={{ pt: 1.25 }}>
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
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={add}
        disabled={disabled}
        sx={{ mt: 1 }}
        data-testid="sip-interface-add"
      >
        Add interface
      </Button>
    </Box>
  );
};

export default SipInterfacesEditor;
