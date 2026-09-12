# Service Import Improvement Plan

## Overview
Improve the service creation/import functionality to:
1. Only show **production-ready** service types from the API
2. Implement **dependent dropdowns** (environment → resources)
3. Add **dynamic form fields** based on service type

---

## Part 1: Production Service Types

### API Analysis Summary
Based on `/opt/src/voipappz-api/lib/models/service.rb`, only **7 types are production-ready**:

| Type | Priority | Trigger Method | Description |
|------|----------|----------------|-------------|
| `webhook` | HIGH | Event-triggered | HTTP webhook for notifications |
| `workflow` | HIGH | Event-triggered | Onuro rule engine workflows |
| `rule` | HIGH | Event-triggered | RulezProcessor rules |
| `metric` | MEDIUM | Scheduled job | Yabeda metrics + anomaly detection |
| `monitor` | MEDIUM | Manual/scheduled | SQL/HTTP health checks |
| `gateway` | MEDIUM | Routing calls | Gateway configuration |
| `event` | MEDIUM | Event-triggered | Web widget (alias for webhook) |

### Types to HIDE (Legacy/Inactive):
- `account_notification`, `user_notification`, `caller_id_number`, `provider`
- `subscription_end_notification`, `subscription_reminder`, `report`

---

## Part 2: Dependent Dropdown Pattern (from Legacy Admin)

### Pattern: Environment → Resources
When user selects an environment, fetch related resources:

```
Environment Selected
    ↓
API Calls (parallel):
    GET /api/extensions?environment_uuid={uuid}
    GET /api/queues?environment_uuid={uuid}
    GET /api/announcements?environment_uuid={uuid}
    GET /api/ivrs?environment_uuid={uuid}
    GET /api/vmls?environment_uuid={uuid}
    GET /api/skills?environment_uuid={uuid}
```

### Pattern: Service Type → Profile Fields
When user selects a service type, fetch profile field definitions:

```
Service Type Selected
    ↓
API Call:
    GET /api/assets/profile_params?type={type}
    ↓
Returns field definitions:
    - field name, key, input type (string, number, select, textarea)
    - validation rules (required, min, max)
    - options (for select fields)
```

---

## Part 3: Implementation Plan

### Step 1: Update SERVICE_TYPE_INFO (ImportJSONDialog)
Reduce to only 7 production types with accurate templates.

### Step 2: Create useServiceFormData Hook
New hook to manage dependent data loading:

```javascript
// src/hooks/useServiceFormData.js
const useServiceFormData = (environmentUuid, serviceType) => {
  const [extensions, setExtensions] = useState([]);
  const [queues, setQueues] = useState([]);
  const [announcements, setAnnouncements] = useState([]);
  const [profileFields, setProfileFields] = useState([]);
  const [loading, setLoading] = useState(false);

  // Load environment-dependent resources
  useEffect(() => {
    if (environmentUuid) {
      loadEnvironmentResources(environmentUuid);
    }
  }, [environmentUuid]);

  // Load type-dependent profile fields
  useEffect(() => {
    if (serviceType) {
      loadProfileFields(serviceType);
    }
  }, [serviceType]);

  return { extensions, queues, announcements, profileFields, loading };
};
```

### Step 3: Create DynamicServiceForm Component
Replace JSON editor with proper form fields:

```jsx
// src/components/Services/DynamicServiceForm.jsx
const DynamicServiceForm = ({ serviceType, environmentUuid, onChange }) => {
  const { profileFields, loading } = useServiceFormData(environmentUuid, serviceType);

  return (
    <Box>
      {/* Basic Fields */}
      <TextField name="name" label="Service Name" required />
      <FormControlLabel control={<Switch name="enabled" />} label="Enabled" />

      {/* Triggers - Multi-select based on type */}
      <TriggersSelector
        type={serviceType}
        availableTriggers={TRIGGERS_BY_TYPE[serviceType]}
      />

      {/* Dynamic Profile Fields */}
      {profileFields.map(field => (
        <DynamicField key={field.key} field={field} />
      ))}

      {/* Conditions & Actions (JSON editors for advanced) */}
      <ConditionsEditor />
      <ActionsEditor />
    </Box>
  );
};
```

### Step 4: Implement Autocomplete for Resources
For fields that reference other resources:

```jsx
// Autocomplete for selecting extensions, queues, etc.
<Autocomplete
  options={extensions}
  getOptionLabel={(opt) => opt.name}
  loading={loading}
  onInputChange={(_, value) => searchExtensions(value)}
  renderInput={(params) => (
    <TextField {...params} label="Target Extension" />
  )}
/>
```

---

## Part 4: Service Type Configurations

### webhook
```javascript
{
  type: 'webhook',
  triggers: ['user.ringing', 'user.answer', 'user.hangup', 'call.start', 'call.end', 'queue.join', 'queue.leave'],
  profileFields: [
    { key: 'url', label: 'Webhook URL', type: 'url', required: true },
    { key: 'method_type', label: 'HTTP Method', type: 'select', options: ['post', 'get', 'post_url_encoded'], required: true },
    { key: 'auth_token', label: 'Auth Token', type: 'password' },
    { key: 'max_retries', label: 'Max Retries', type: 'number', default: 3 }
  ]
}
```

### workflow
```javascript
{
  type: 'workflow',
  triggers: ['call.start', 'call.end', 'user.state_change', 'event.custom'],
  profileFields: [
    { key: 'workflow_uuid', label: 'Workflow', type: 'autocomplete', resource: 'workflows', required: true },
    { key: 'strategy', label: 'Strategy', type: 'select', options: ['sequential', 'parallel'] },
    { key: 'enabled', label: 'Enabled', type: 'boolean', default: true }
  ]
}
```

### rule
```javascript
{
  type: 'rule',
  triggers: ['call.start', 'call.answer', 'call.end', 'campaign.number_processed'],
  profileFields: [
    { key: 'ruleset_uuid', label: 'Ruleset', type: 'autocomplete', resource: 'rulesets', required: true },
    { key: 'enabled', label: 'Enabled', type: 'boolean', default: true }
  ],
  conditionsSchema: {
    meet_all: { type: 'array', label: 'Meet ALL conditions' },
    meet_any: { type: 'array', label: 'Meet ANY conditions' }
  }
}
```

### metric
```javascript
{
  type: 'metric',
  triggers: ['calls.total', 'webhooks.failures_total', 'queues.wait_time'],
  profileFields: [
    { key: 'check_interval_minutes', label: 'Check Interval (min)', type: 'number', default: 5, min: 1 },
    { key: 'anomaly_detection_enabled', label: 'Anomaly Detection', type: 'boolean', default: false },
    { key: 'baseline_days', label: 'Baseline Days', type: 'number', default: 7, min: 1 }
  ]
}
```

### monitor
```javascript
{
  type: 'monitor',
  triggers: ['health.check'],
  profileFields: [
    { key: 'type', label: 'Monitor Type', type: 'select', options: ['sql', 'http'], required: true },
    { key: 'query', label: 'Query/URL', type: 'textarea', required: true },
    { key: 'interval', label: 'Interval (seconds)', type: 'number', default: 300, min: 60 }
  ]
}
```

### gateway
```javascript
{
  type: 'gateway',
  triggers: ['call.start', 'call.end', 'routing.request'],
  profileFields: [
    { key: 'gateway_ip', label: 'Gateway IP', type: 'text', required: true },
    { key: 'transport', label: 'Transport', type: 'select', options: ['udp', 'tcp', 'tls'] },
    { key: 'port', label: 'Port', type: 'number', default: 5060 },
    { key: 'auth_required', label: 'Auth Required', type: 'boolean', default: false }
  ]
}
```

### event
```javascript
{
  type: 'event',
  triggers: ['queue.start', 'queue.end', 'call.start', 'call.end'],
  profileFields: [
    { key: 'method', label: 'Method', type: 'select', options: ['post', 'get'] }
  ],
  metaFields: [
    { key: 'ext', label: 'Extension Variable', default: 'call.extension_username' },
    { key: 'caller', label: 'Caller Variable', default: 'call.caller_id_number' },
    { key: 'status', label: 'Status Variable', default: 'event.name' }
  ]
}
```

---

## Part 5: File Changes Summary

### Files to Modify:
1. `src/components/common/ImportJSONDialog/ImportJSONDialog.jsx`
   - Reduce to 7 production types
   - Add better type descriptions and triggers info

2. `src/components/Services/ServicesList/ServicesList.jsx`
   - Update filter dropdown with 7 types only

3. `src/components/Services/Services.jsx`
   - Pass correct serviceTypes to components

### Files to Create (Phase 2):
1. `src/hooks/useServiceFormData.js` - Dependent data loading hook
2. `src/components/Services/DynamicServiceForm/DynamicServiceForm.jsx` - Form with dynamic fields
3. `src/components/Services/TriggersSelector/TriggersSelector.jsx` - Multi-select triggers
4. `src/components/common/DynamicField/DynamicField.jsx` - Render field by type

---

## Part 6: API Endpoints Used

| Endpoint | Purpose |
|----------|---------|
| `GET /api/services?action=types` | Get available service types |
| `GET /api/assets/profile_params?type={type}` | Get profile fields for type |
| `GET /api/extensions?environment_uuid={uuid}` | Environment extensions |
| `GET /api/queues?environment_uuid={uuid}` | Environment queues |
| `GET /api/announcements?environment_uuid={uuid}` | Environment announcements |
| `GET /api/ivrs?environment_uuid={uuid}` | Environment IVRs |
| `GET /api/workflows?environment_uuid={uuid}` | Environment workflows |

---

## Implementation Priority

### Phase 1 (Immediate) ✅
- [x] Update ImportJSONDialog with 7 production types only
- [x] Update ServicesList filter dropdown
- [x] Add type descriptions and trigger info

### Phase 2 (Next Sprint)
- [ ] Create useServiceFormData hook
- [ ] Implement DynamicServiceForm component
- [ ] Add autocomplete for resource selection
- [ ] Implement proper triggers multi-select

### Phase 3 (Future)
- [ ] Add conditions builder UI
- [ ] Add actions builder UI
- [ ] Implement service testing/preview
