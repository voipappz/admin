# VoipAppz Migration Plan

## Overview

This document outlines the migration plan for importing features from reference projects into the main voipappz-app.

## Source Projects

| Project | Location | Key Features |
|---------|----------|--------------|
| connectix-app | `reference-projects/connectix-app/` | Janus Video, WebRTC Phone, Full Ionic App |
| va-voipbox-portal | `reference-projects/va-voipbox-portal/` | (Empty - features in connectix-app) |
| va-dashboard | `reference-projects/va-dashboard/` | (Empty - features in connectix-app) |

---

## Feature Migration Matrix

### Priority 1: Core Communication Features

| Feature | Source | Target | Status | Complexity |
|---------|--------|--------|--------|------------|
| WebRTC SIP Phone | connectix-app | ✅ Done | Migrated | High |
| Janus Video Room | connectix-app | Pending | - | High |
| Janus Audio Bridge | connectix-app | Pending | - | Medium |
| ActionCable WebSocket | connectix-app | ✅ Exists | Verify | Low |

### Priority 2: Call Management

| Feature | Source | Target | Status | Complexity |
|---------|--------|--------|--------|------------|
| Call History | connectix-app | ✅ Exists | Verify | Low |
| Call Controls | connectix-app | ✅ Done | Migrated | Medium |
| Call Transfer | connectix-app | ✅ Done | Migrated | Medium |
| DTMF Support | connectix-app | ✅ Done | Migrated | Low |

### Priority 3: Business Features

| Feature | Source | Target | Status | Complexity |
|---------|--------|--------|--------|------------|
| Campaign Management | connectix-app | Pending | - | High |
| Contact Management | connectix-app | Pending | - | Medium |
| Time Conditions | connectix-app | ✅ Exists | Verify | Medium |
| IVR Management | connectix-app | Pending | - | High |
| DID Management | connectix-app | Pending | - | Medium |

### Priority 4: Dashboard & Analytics

| Feature | Source | Target | Status | Complexity |
|---------|--------|--------|--------|------------|
| Dashboard Widgets | connectix-app | Pending | - | Medium |
| Reports | connectix-app | Pending | - | Medium |
| Analytics | connectix-app | Pending | - | High |

---

## Detailed Feature Documentation

### 1. WebRTC SIP Phone (✅ MIGRATED)

**Source:** `reference-projects/connectix-app/src/app/core/providers/phone/webrtc-phone.ts`
**Target:** `src/app/core/providers/phone/webrtc-phone.ts`

**Implementation:**
- SIP.js 0.21.x (upgraded from 0.12.x)
- UserAgent + Registerer pattern
- Inviter/Invitation for calls
- session.refer() for transfers

**Features:**
- ✅ Registration/Unregistration
- ✅ Outgoing calls
- ✅ Incoming calls
- ✅ Answer/Reject
- ✅ Hangup
- ✅ Mute/Unmute
- ✅ Hold/Unhold
- ✅ DTMF
- ✅ Blind Transfer
- ✅ Attended Transfer
- ✅ Device Selection

---

### 2. Janus Video Room (PENDING)

**Source:** `reference-projects/connectix-app/src/assets/angular-janus-master/`

**Components to Migrate:**

```
src/lib/
├── components/
│   ├── video-box/           # Individual video participant
│   ├── self-video/          # Local video stream
│   ├── audio-box/           # Audio participant
│   ├── default-video-room/  # Pre-configured room
│   └── video-room-wrapper/  # Layout wrapper
├── containers/
│   ├── janus-videoroom/     # Video room manager
│   ├── janus-audioroom/     # Audio room manager
│   └── device-selector/     # Media device picker
├── services/
│   ├── janus.service.ts     # Core Janus communication
│   └── webrtc.service.ts    # WebRTC session management
└── store/
    ├── janus.actions.ts     # NgRx actions
    └── janus.reducers.ts    # State management
```

**Dependencies:**
```json
{
  "janus-angular": "^0.1.6",
  "janus-gateway-js": "^2.0.2",
  "janus-gateway-tsdx": "^0.3.2"
}
```

**Migration Steps:**
1. Copy angular-janus-master to src/assets/
2. Update imports for Angular 13
3. Configure Janus server URLs
4. Create video room page/component
5. Integrate with existing Events system
6. Test with Janus server

---

### 3. Janus Audio Bridge (PENDING)

**Source:** `reference-projects/connectix-app/src/app/pages/chat-room/`

**Features:**
- Audio conference rooms
- Participant management
- Mute/unmute controls
- Room PIN support

**Migration Steps:**
1. Copy chat-room page
2. Update module imports
3. Configure audio bridge plugin
4. Test with Janus server

---

### 4. Campaign Management (PENDING)

**Source:** `reference-projects/connectix-app/src/app/core/_base/layout/services/campaign.service.ts`

**API Endpoints:**
```
GET    /api/campaigns
GET    /api/campaigns/{uuid}
GET    /api/campaigns/{uuid}?action=workflows
GET    /api/campaigns/{uuid}?action=workflow_events
GET    /api/campaign_numbers
GET    /api/campaign_numbers/{uuid}?action=dial
PATCH  /api/campaigns/{uuid}
PATCH  /api/workflows/{uuid}
PATCH  /api/workflow_events/{uuid}
POST   /api/campaigns (duplicate)
POST   /api/campaign_numbers/import
```

**Features:**
- Campaign CRUD
- Workflow management
- Number import/export
- Dial from campaign
- Workflow events

**Migration Steps:**
1. Copy campaign.service.ts
2. Create campaign page/module
3. Create campaign number components
4. Create workflow editor
5. Test API integration

---

### 5. Contact Management (PENDING)

**Source:**
- `reference-projects/connectix-app/src/app/pages/contact-list/`
- `reference-projects/connectix-app/src/app/pages/contact-detail/`

**Features:**
- Contact list with search
- Contact details
- Call from contact
- Video call integration
- Permission-based actions

**Migration Steps:**
1. Copy contact pages
2. Update ConferenceData provider
3. Integrate with phone service
4. Add Janus video support

---

### 6. Dashboard Widgets (PENDING)

**Source:** `reference-projects/connectix-app/src/app/pages/dashboard/`

**Features:**
- Widget-based layout
- Configurable widgets
- Real-time updates

**Widget Types:**
- Call statistics
- Active calls
- Agent status
- Campaign progress

**Migration Steps:**
1. Design widget system
2. Create widget components
3. Create dashboard layout
4. Add real-time updates via ActionCable

---

### 7. Reports & Analytics (PENDING)

**Source:** `reference-projects/connectix-app/src/app/core/_base/layout/services/report.service.ts`

**Features:**
- Report generation
- Data export (CSV, Excel)
- Custom filters
- Date range selection

**Migration Steps:**
1. Copy report service
2. Create report page
3. Add export functionality
4. Create visualizations

---

## Services to Migrate

| Service | Source | Description | Priority |
|---------|--------|-------------|----------|
| campaign.service.ts | connectix-app | Campaign management | P2 |
| report.service.ts | connectix-app | Reporting | P3 |
| rule.service.ts | connectix-app | Workflow rules | P2 |
| did.service.ts | connectix-app | DID management | P3 |
| ivr.service.ts | connectix-app | IVR management | P3 |
| notification.service.ts | connectix-app | Notifications | P2 |

---

## Shared Components to Migrate

| Component | Source | Description |
|-----------|--------|-------------|
| dialpad | ✅ Exists | Number input keypad |
| filter | ✅ Exists | Advanced filtering |
| date-time-picker | ✅ Exists | Date/time selection |
| logo | ✅ Exists | Brand logo |
| settings | ✅ Exists | Settings panel |

---

## Pipes to Verify

| Pipe | Source | Status |
|------|--------|--------|
| truncate | connectix-app | Verify |
| time-elapsed | connectix-app | Verify |
| first-letter | connectix-app | Verify |
| humanize | connectix-app | Verify |
| group-by-date | connectix-app | Verify |
| safe | connectix-app | Verify |
| join | connectix-app | Verify |

---

## Infrastructure Requirements

### 1. SIP Server
- WSS endpoint for WebRTC
- STUN/TURN servers
- Extension provisioning

### 2. Janus Gateway
- Video Room plugin
- Audio Bridge plugin
- WebSocket endpoint

### 3. Backend API
- REST API for all services
- ActionCable for real-time events
- JWT authentication

### 4. Media Server
- Recording storage
- Playback endpoint

---

## Migration Timeline (Suggested)

### Phase 1: Core (Completed)
- ✅ WebRTC Phone
- ✅ Call Controls
- ✅ Basic UI

### Phase 2: Video
- [ ] Janus Video Room
- [ ] Janus Audio Bridge
- [ ] Device Selection

### Phase 3: Business
- [ ] Campaign Management
- [ ] Contact Management
- [ ] Time Conditions

### Phase 4: Analytics
- [ ] Dashboard
- [ ] Reports
- [ ] Widgets

---

## Testing Strategy

### Unit Tests
- Service methods
- Component logic
- Pipe transformations

### Integration Tests
- API communication
- WebSocket events
- Phone operations

### E2E Tests (Playwright)
- Login flow
- Call scenarios
- Video room join
- Campaign operations

### Manual Tests
- Real WebRTC calls
- Audio quality
- Video quality
- Cross-browser

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| SIP.js API changes | High | Pin version, test thoroughly |
| Janus compatibility | High | Use tested version, staging |
| Angular version mismatch | Medium | Update imports as needed |
| Browser WebRTC support | Medium | Use adapter.js, test browsers |
| Server connectivity | High | Fallback modes, retry logic |

---

## Next Steps

1. **Immediate:** Test WebRTC phone with real SIP server
2. **Short-term:** Migrate Janus video components
3. **Medium-term:** Add campaign management
4. **Long-term:** Full dashboard implementation
