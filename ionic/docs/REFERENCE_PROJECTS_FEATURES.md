# Reference Projects - Feature Documentation

## Overview

This document details all features found in the reference projects that can be migrated to voipappz-app.

---

## 1. CONNECTIX-APP (Primary Reference)

**Location:** `reference-projects/connectix-app/`
**Type:** Full Ionic 3 Application
**Framework:** Ionic 3 + Angular 5 (needs upgrade to Ionic 6 + Angular 13)

---

### 1.1 WebRTC/SIP Phone Implementation

**Location:** `src/app/core/providers/phone/`

| File | Purpose |
|------|---------|
| `webrtc-phone.ts` | Core SIP.js implementation |
| `phone.ts` | Phone provider facade |
| `api-phone.ts` | API-based phone |

**Features:**
- SIP.UA User Agent management
- Call initiation (invite)
- Call answering (accept)
- Call rejection (reject)
- Call hangup (bye, cancel)
- DTMF tone sending
- Hold/Unhold
- Mute/Unmute
- Blind transfer (refer)
- Attended transfer
- Audio device selection
- Ringtone management
- Connection status tracking

**Dependencies:**
```json
{
  "sip.js": "^0.12.0"  // Old version, upgraded to 0.21.x
}
```

**STUN/TURN Configuration:**
```typescript
iceServers: [
  { urls: ['stun:acvideo.voipappz.io'] },
  {
    urls: [
      'turn:eu-turn3.xirsys.com:80?transport=udp',
      'turn:eu-turn3.xirsys.com:3478?transport=udp',
      'turns:eu-turn3.xirsys.com:443?transport=tcp'
    ],
    username: '...',
    credential: '...'
  }
]
```

---

### 1.2 Janus Video Room

**Location:** `src/assets/angular-janus-master/projects/janus/src/lib/`

#### Components

| Component | Location | Purpose |
|-----------|----------|---------|
| JanusVideoroomComponent | `containers/janus-videoroom/` | Main video room container |
| JanusAudioroomComponent | `containers/janus-audioroom/` | Audio bridge container |
| DeviceSelectorComponent | `containers/device-selector/` | Media device picker |
| VideoBoxComponent | `components/video-box/` | Participant video display |
| SelfVideoComponent | `components/self-video/` | Local video preview |
| AudioBoxComponent | `components/audio-box/` | Audio participant display |
| DefaultVideoRoomComponent | `components/default-video-room/` | Pre-configured room |
| VideoRoomWrapperComponent | `components/video-room-wrapper/` | Layout wrapper |

#### Services

| Service | Purpose |
|---------|---------|
| JanusService | Core Janus Gateway communication |
| WebrtcService | WebRTC session management |
| Devices | Media device enumeration |

#### State Management (NgRx)

| File | Purpose |
|------|---------|
| `store/janus.store.ts` | Component store |
| `store/janus.actions.ts` | Redux actions |
| `store/janus.reducers.ts` | State reducers |

#### Models

```typescript
// Janus store models
interface JanusState {
  iceServers: RTCIceServer[];
  janusServer: { wsUrl: string; httpUrl: string };
  roomId: number;
  participants: Participant[];
  localStream: MediaStream;
}

interface Participant {
  id: number;
  display: string;
  audio: boolean;
  video: boolean;
  stream?: MediaStream;
}
```

---

### 1.3 Call Management

**Location:** `src/app/core/_base/layout/services/call.service.ts`

#### API Endpoints

```typescript
GET    /api/calls                              // List calls
GET    /api/calls?page=X                       // Paginated
GET    /api/calls?action=params                // Get parameters
GET    /api/calls?action=segments              // Get segments
GET    /api/calls?action=columns               // Get columns
GET    /api/calls?action=export                // Export calls
GET    /api/calls/{uuid}?action=load           // Get call detail
GET    /api/calls/{uuid}?action=run            // Run call
PATCH  /api/calls/{uuid}                       // Update call
PATCH  /api/calls/{uuid}?action=blacklist_add  // Blacklist number
PATCH  /api/calls/{uuid}?action=blacklist_remove
```

#### Features

- Call history with pagination
- Filter by type (all, missed, rejected, outgoing, incoming)
- Inline search
- Export functionality
- Blacklist management
- Column customization
- Segment-based filtering

---

### 1.4 Campaign Management

**Location:** `src/app/core/_base/layout/services/campaign.service.ts`

#### Data Models

```typescript
interface TyCampaign {
  uuid: string;
  name: string;
  status: string;
  numbers_group_count: number;
}

interface TyCampaignNumber {
  uuid: string;
  number: string;
  status: string;
  recording_url?: string;
}
```

#### API Endpoints

```typescript
GET    /api/campaigns
GET    /api/campaigns/{uuid}
GET    /api/campaigns/{uuid}?action=workflows
GET    /api/campaigns/{uuid}?action=workflow_events
GET    /api/campaign_numbers
GET    /api/campaign_numbers/{uuid}?action=dial
PATCH  /api/campaigns/{uuid}
PATCH  /api/workflows/{uuid}
PATCH  /api/workflow_events/{uuid}
POST   /api/campaigns                          // Duplicate
POST   /api/campaign_numbers/import
```

#### Features

- Campaign CRUD operations
- Workflow management
- Workflow events
- Number import/export
- Dial from campaign
- Recording access
- Status tracking

---

### 1.5 Contact Management

**Location:** `src/app/pages/contact-list/` and `src/app/pages/contact-detail/`

#### Features

- Contact list with search
- Contact detail view
- Call from contact (audio/video)
- Permission-based actions
- Dialpad integration

#### Permissions Model

```typescript
interface ContactPermissions {
  allow_audio: boolean;
  allow_dialer: boolean;
  allow_video: boolean;
}
```

---

### 1.6 Time Conditions

**Location:** `src/app/core/_base/layout/services/time-condition.service.ts`

#### API Endpoints

```typescript
GET    /api/time_conditions
GET    /api/time_conditions/{uuid}
PATCH  /api/time_conditions/{uuid}
```

#### Features

- Time-based call routing
- Schedule management
- Hours configuration
- Modal-based editing

---

### 1.7 Locations & Identities

**Location:** `src/app/core/_base/layout/services/locations.service.ts`

#### Features

- Location management (home, work, mobile)
- Icon assignment
- Default location setting
- Resource type filtering (extension, IVR, number)

#### API Endpoints

```typescript
GET    /api/extensions
GET    /api/numbers/{uuid}
GET    /api/ivrs
PATCH  /api/extensions/{uuid}
```

---

### 1.8 Chat Room (Audio Bridge)

**Location:** `src/app/pages/chat-room/`

#### Features

- Audio conference rooms
- Participant management
- Mute/unmute controls
- Room PIN support
- Guest ID tracking
- Message display

#### Dependencies

- AudioCallService
- AudioBridgePlugin (janus-gateway-tsdx)
- WebrtcService

---

### 1.9 Dashboard

**Location:** `src/app/pages/dashboard/`

#### Features

- Widget-based layout
- Location selector
- Date picker
- Popover interactions

---

### 1.10 Reports

**Location:** `src/app/core/_base/layout/services/report.service.ts`

#### Features

- Report generation
- Data export
- Column customization
- Filter management

---

### 1.11 Authentication

**Location:** `src/app/core/providers/authentication/`

| File | Purpose |
|------|---------|
| `auth.ts` | Authentication service |
| `authTokenStatus.ts` | Token validation |

#### Features

- Email/password login
- Token-based login
- JWT token management
- Token refresh
- Signup flow

---

### 1.12 WebSocket (ActionCable)

**Location:** `src/app/core/_base/layout/services/action-cable.service.ts`

#### Features

- Real-time communication
- Channel management
- Event subscriptions
- Connection handling

#### Usage

```typescript
// Connect
websocket.connect();

// Join channel
websocket.join('AgentChannel', { agent_uuid: 'xxx' });

// Subscribe to events
websocket.getChannel('AgentChannel').received().subscribe(msg => {
  // Handle message
});

// Leave channel
websocket.leave('AgentChannel');
```

---

### 1.13 Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| DialpadComponent | `partials/dialpad/` | Number keypad |
| FilterComponent | `partials/filter/` | Advanced filtering |
| DateTimePickerPopover | `partials/date-time-picker-popover/` | Date/time selection |
| LogoComponent | `partials/logo/` | Brand logo |
| SettingsComponent | `partials/settings/` | Settings panel |

---

### 1.14 Pipes

| Pipe | Purpose |
|------|---------|
| `truncate` | Text truncation |
| `time-elapsed` | Duration formatting |
| `first-letter` | Initial extraction |
| `humanize` | Human-readable |
| `group-by-date` | Date grouping |
| `safe` | HTML sanitization |
| `join` | Array joining |
| `select2-adapter` | Select2 format |

---

### 1.15 Directives

| Directive | Purpose |
|-----------|---------|
| `tab-click-event` | Tab interaction |
| `sticky` | Sticky positioning |
| `auto-select` | Auto-select input |

---

### 1.16 Additional Services

| Service | Purpose |
|---------|---------|
| `did.service.ts` | DID number management |
| `ivr.service.ts` | IVR management |
| `extension.service.ts` | Extension management |
| `number.service.ts` | Phone number management |
| `rule.service.ts` | Workflow rules |
| `notification.service.ts` | Notifications |
| `message.service.ts` | Messaging |
| `user.service.ts` | User management |

---

## 2. VA-VOIPBOX-PORTAL

**Location:** `reference-projects/va-voipbox-portal/`
**Status:** Empty directory

---

## 3. VA-DASHBOARD

**Location:** `reference-projects/va-dashboard/`
**Status:** Empty directory

---

## Migration Priority Matrix

| Priority | Feature | Complexity | Dependencies |
|----------|---------|------------|--------------|
| P1 | WebRTC Phone | ✅ Done | SIP.js |
| P1 | Call History | ✅ Exists | API |
| P2 | Janus Video | High | Janus Server |
| P2 | Janus Audio | Medium | Janus Server |
| P2 | Campaign | High | API, Workflows |
| P3 | Contacts | Medium | API |
| P3 | Dashboard | Medium | Widgets |
| P3 | Reports | Medium | API |
| P4 | DID/IVR | Medium | API |

---

## File Mapping (Connectix → VoipAppz)

### Already Migrated

| Source (connectix-app) | Target (voipappz-app) |
|------------------------|----------------------|
| `providers/phone/webrtc-phone.ts` | `providers/phone/webrtc-phone.ts` ✅ |
| `providers/phone/phone.ts` | `providers/phone/phone.ts` ✅ |
| `providers/phone/api-phone.ts` | `providers/phone/api-phone.ts` ✅ |
| `services/call.service.ts` | `services/call.service.ts` ✅ |
| `services/action-cable.service.ts` | `services/action-cable.service.ts` ✅ |

### To Migrate

| Source (connectix-app) | Target (voipappz-app) |
|------------------------|----------------------|
| `assets/angular-janus-master/` | `assets/janus-angular/` |
| `services/campaign.service.ts` | `services/campaign.service.ts` |
| `pages/chat-room/` | `pages/chat-room/` |
| `pages/contact-detail/` | `pages/contact-detail/` |
