import { Card, CardHeader, CardContent, Typography } from '@mui/material';
import HttpIcon from '@mui/icons-material/Http';
import KeyValueField from '../common/KeyValueField/KeyValueField';

export const objectToFields = (value) =>
  Object.entries(value || {}).map(([key, fieldValue]) => ({ key, value: String(fieldValue ?? '') }));

export const fieldsToObject = (fields) =>
  (fields || []).reduce((acc, { key, value }) => {
    const k = (key || '').trim();
    if (k) acc[k] = value ?? '';
    return acc;
  }, {});

/**
 * WebhookBodyEditor — request fields live in service.meta. A request value naming a payload root
 * (data.x / metadata.x / call.<field> / event) is filled from the event,
 * anything else is sent as-is. With no keys the full event payload is sent.
 */
const WebhookBodyEditor = ({ fields, onChange, disabled = false }) => (
  <Card elevation={2}>
    <CardHeader
      avatar={<HttpIcon color="primary" />}
      title="Webhook Request Fields"
      titleTypographyProps={{ variant: 'h6' }}
      subheader="Sent as query parameters for GET or as the request body for POST. Leave empty to send the full event payload."
    />
    <CardContent>
      <KeyValueField
        fields={fields}
        onChange={onChange}
        disabled={disabled}
        label="Request fields"
        addButtonText="Add Request Field"
        keyLabel="Field name"
        valueLabel="Value or event path"
        helperText={
          'Values naming an event path are resolved: data.<field>, metadata.<field>, ' +
          'call.<field> (e.g. call.caller_id_number), or event (the event name). ' +
          'Any other value is sent as-is (e.g. source = crm).'
        }
      />
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        Example: queue = data.queue_name, caller = call.caller_id_number, source = crm
      </Typography>
    </CardContent>
  </Card>
);

export default WebhookBodyEditor;
