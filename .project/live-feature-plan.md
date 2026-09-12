# Live Feature Enhancement Plan

## Overview
Enhance the existing Live Dashboard to include Live Calls/Sessions and SIP Registrations with table/chart toggle functionality.

## Current Implementation
- ✅ Live Agents table with real-time updates via ActionCable
- ✅ Summary counters (Available, On Call, On Break, Waiting)
- ✅ Desktop/Mobile responsive views
- ✅ WebSocket connection status indicator

## Angular Admin Reference
From `~/Projects/nimbus-admin/va-voipbox-admin/`:

### Live Features
1. **Live Gateways/Agents** (`/live_logged_in`)
   - API: `/api/gateways?action=live`
   - Columns: `/api/gateways?action=live_fields`

2. **SIP Registrations** (`/live_devices`)
   - API: `/api/extensions?action=live`
   - Columns: `/api/extensions?action=live_fields`
   - WebSocket: `{channel: 'live_extensions', account_uuid: ...}`

3. **Live Sessions/Calls** (`/live_sessions`)
   - API: `/api/calls?action=live`
   - Columns: `/api/calls?action=live_fields`
   - WebSocket: `{calls: 'live', account_uuid: ...}`

## Enhancement Plan

### Phase 1: Add API Services (30 min)

**File:** `src/services/api/liveApi.js`

```javascript
export const liveApi = {
  // Live Calls
  getLiveCalls: (params) => apiService.get('/api/calls', { params: { action: 'live', ...params } }),
  getLiveCallsFields: () => apiService.get('/api/calls', { params: { action: 'live_fields' } }),

  // SIP Registrations
  getLiveRegistrations: (params) => apiService.get('/api/extensions', { params: { action: 'live', ...params } }),
  getLiveRegistrationsFields: () => apiService.get('/api/extensions', { params: { action: 'live_fields' } }),

  // Live Agents (existing - add fields endpoint)
  getLiveAgentsFields: () => apiService.get('/api/gateways', { params: { action: 'live_fields' } })
};
```

### Phase 2: Create Custom Hooks (45 min)

**File:** `src/components/Live/useLiveCalls.js`
```javascript
export const useLiveCalls = () => {
  const [calls, setCalls] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch calls data
  // Setup WebSocket subscription
  // Return calls, columns, loading, error
};
```

**File:** `src/components/Live/useLiveRegistrations.js`
```javascript
export const useLiveRegistrations = () => {
  const [registrations, setRegistrations] = useState([]);
  const [columns, setColumns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch registrations data
  // Setup WebSocket subscription
  // Return registrations, columns, loading, error
};
```

### Phase 3: Enhanced Summary Counters (30 min)

**Update:** `src/components/Live/SummarySection/SummarySection.jsx`

Add new counter types:
- **Agents Section**: Available, On Call, On Break, Waiting (existing)
- **Calls Section**: Active Calls, Total Calls Today
- **Devices Section**: Registered Devices, Total Devices

### Phase 4: Tabbed Interface (45 min)

**Update:** `src/components/Live/Live.jsx`

Add Material-UI Tabs:
```jsx
<Tabs value={activeTab} onChange={handleTabChange}>
  <Tab label="Live Agents" />
  <Tab label="Live Calls" />
  <Tab label="SIP Registrations" />
</Tabs>

<TabPanel value={activeTab} index={0}>
  <LiveAgentsView /> {/* existing */}
</TabPanel>
<TabPanel value={activeTab} index={1}>
  <LiveCallsView />
</TabPanel>
<TabPanel value={activeTab} index={2}>
  <LiveRegistrationsView />
</TabPanel>
```

### Phase 5: Table/Chart Toggle (30 min)

**Reuse from Reports:**
- `ViewModeToggle` component
- `DataTable` component
- `BarChart` component

**Each Tab Contains:**
```jsx
<Box>
  <ViewModeToggle value={viewMode} onChange={setViewMode} />
  <ColumnSelectorMenu columns={columns} onToggle={handleColumnToggle} />

  {viewMode === 'table' ? (
    <DataTable data={data} columns={visibleColumns} />
  ) : (
    <BarChart data={transformedData} />
  )}
</Box>
```

### Phase 6: WebSocket Integration (45 min)

**ActionCable Subscriptions:**

```javascript
// Live Calls WebSocket
const subscription = consumer.subscriptions.create(
  { channel: 'CallsChannel', calls: 'live', account_uuid: accountUuid },
  {
    received: (data) => {
      setCalls(data.table || []);
    }
  }
);

// SIP Registrations WebSocket
const subscription = consumer.subscriptions.create(
  { channel: 'ExtensionsChannel', account_uuid: accountUuid },
  {
    received: (data) => {
      setRegistrations(data.table || []);
    }
  }
);
```

## File Structure

```
src/components/Live/
├── Live.jsx (updated - add tabs)
├── Live.js (updated - manage tabs state)
├── SummarySection/
│   └── SummarySection.jsx (updated - add call/device counters)
├── LiveAgentsView/ (existing DesktopView/MobileView)
│   ├── LiveAgentsView.jsx
│   └── useLiveAgents.js
├── LiveCallsView/ (NEW)
│   ├── LiveCallsView.jsx
│   ├── useLiveCalls.js
│   └── LiveCallsColumns.js
├── LiveRegistrationsView/ (NEW)
│   ├── LiveRegistrationsView.jsx
│   ├── useLiveRegistrations.js
│   └── LiveRegistrationsColumns.js
└── shared/
    ├── ViewToggle.jsx (reuse from Reports)
    └── DataDisplay.jsx (handles table/chart switching)

src/services/api/
└── liveApi.js (NEW)
```

## Data Flow

```
1. Component Mount
   ↓
2. Fetch Initial Data (/api/{resource}?action=live)
   ↓
3. Fetch Column Definitions (/api/{resource}?action=live_fields)
   ↓
4. Setup WebSocket Subscription
   ↓
5. Render Table/Chart based on viewMode
   ↓
6. Receive Real-Time Updates via WebSocket
   ↓
7. Update State → Re-render
```

## API Endpoints

### Live Calls
- **GET** `/api/calls?action=live` - Get live calls data
- **GET** `/api/calls?action=live_fields` - Get column definitions
- **WebSocket** Channel: `CallsChannel` with `{calls: 'live', account_uuid}`

### SIP Registrations
- **GET** `/api/extensions?action=live` - Get live registrations
- **GET** `/api/extensions?action=live_fields` - Get column definitions
- **WebSocket** Channel: `ExtensionsChannel` with `{account_uuid}`

### Live Agents (existing)
- **GET** `/api/gateways?action=live` - Get live agents
- **GET** `/api/gateways?action=live_fields` - Get column definitions (NEW)
- **WebSocket** Channel: `AgentsChannel` (already implemented)

## Counter Calculations

```javascript
// Agents
const agentCounts = {
  available: agents.filter(a => a.status === 'available').length,
  onCall: agents.filter(a => a.status === 'on_call').length,
  onBreak: agents.filter(a => a.status === 'on_break').length,
  waiting: agents.filter(a => a.status === 'waiting').length
};

// Calls
const callCounts = {
  active: calls.filter(c => c.status === 'active').length,
  totalToday: calls.length
};

// Devices/Registrations
const deviceCounts = {
  registered: registrations.filter(r => r.registered).length,
  total: registrations.length
};
```

## Component Props Pattern

```typescript
interface LiveViewProps {
  data: any[];
  columns: Column[];
  loading: boolean;
  error: string | null;
  viewMode: 'table' | 'chart';
  onViewModeChange: (mode: 'table' | 'chart') => void;
  onRefresh: () => void;
}
```

## Testing Checklist

- [ ] Live Calls API integration
- [ ] SIP Registrations API integration
- [ ] WebSocket real-time updates
- [ ] Tab switching functionality
- [ ] Table/Chart toggle
- [ ] Column visibility controls
- [ ] Counter calculations
- [ ] Mobile responsive design
- [ ] Error handling
- [ ] Loading states

## Implementation Timeline

- **Phase 1**: API Services - 30 min
- **Phase 2**: Custom Hooks - 45 min
- **Phase 3**: Enhanced Counters - 30 min
- **Phase 4**: Tabbed Interface - 45 min
- **Phase 5**: Table/Chart Toggle - 30 min
- **Phase 6**: WebSocket Integration - 45 min

**Total Estimated Time: 4 hours**

## Success Criteria

✅ Live Calls table displays real-time call data
✅ SIP Registrations table shows live device registrations
✅ Counters show accurate stats for agents, calls, and devices
✅ Table/Chart toggle works for all data types
✅ WebSocket updates reflect in UI without page refresh
✅ Mobile responsive across all tabs
✅ Column customization persists to localStorage
✅ Error handling for API failures
✅ Loading states during data fetch

## Notes

- Reuse existing ActionCable implementation from Live component
- Follow component-hook separation pattern consistently
- Use Material-UI components throughout
- Maintain multi-tenant context (CustomerEnvironmentContext)
- Column definitions from API dictate table structure
- Export functionality can be added later (CSV/Excel)
