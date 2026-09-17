# WebRTC Phone Test Plan

## Overview

This document outlines the testing strategy for the WebRTC SIP phone implementation using SIP.js 0.21.x in the VoipAppz Ionic Angular application.

## Architecture

```
┌─────────────────┐     WSS      ┌─────────────────┐
│   Ionic App     │◄────────────►│   SIP Server    │
│  (SIP.js UA)    │              │  (FreeSWITCH/   │
│                 │              │   Obulex)       │
└────────┬────────┘              └────────┬────────┘
         │                                │
         │ WebRTC                         │ RTP/SRTP
         │                                │
         ▼                                ▼
┌─────────────────┐              ┌─────────────────┐
│  STUN/TURN      │              │   PSTN/SIP      │
│  Servers        │              │   Trunks        │
└─────────────────┘              └─────────────────┘
```

## Test Environments

### 1. Development/Staging Environment
- **API**: https://mtnunicom.mtn.com.gh/ (or staging)
- **ActionCable WSS**: wss://mtn-portal.voipappz.io:8443/
- **SIP WSS**: Configured per extension (environment.wss_server)
- **STUN**: stun:acvideo.voipappz.io
- **TURN**: eu-turn3.xirsys.com (with credentials)

### 2. Test SIP Credentials
Obtain test extension credentials from the admin portal:
```json
{
  "username": "6000",
  "password": "xxxxx",
  "environment": {
    "domain": "bpo.voipappz.io",
    "wss_server": "switch-staging.voipappz.io:8443"
  }
}
```

## Test Scenarios

### 1. Registration Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| REG-001 | Register with valid credentials | Status: "Ready" |
| REG-002 | Register with invalid password | Status: "Error: Registration Failed" |
| REG-003 | Register with unreachable WSS | Status: "Connection Failed" |
| REG-004 | Unregister | Status: "Unregistered" |
| REG-005 | Re-register after disconnect | Status: "Ready" |

### 2. Outgoing Call Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| OUT-001 | Call valid extension | Call connects, audio works |
| OUT-002 | Call external number | Call connects via trunk |
| OUT-003 | Call invalid number | Call fails gracefully |
| OUT-004 | Cancel outgoing call | Call cancelled, UI reset |
| OUT-005 | Outgoing call rejected | Status shows rejected |

### 3. Incoming Call Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| IN-001 | Receive incoming call | Ringtone plays, UI shows caller |
| IN-002 | Answer incoming call | Call connects, audio works |
| IN-003 | Reject incoming call | Call rejected, ringtone stops |
| IN-004 | Auto-answer (x-va-meta) | Call auto-answered |
| IN-005 | Reject when in call | Second call rejected |

### 4. Call Control Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| CTL-001 | Mute microphone | Local audio muted |
| CTL-002 | Unmute microphone | Local audio restored |
| CTL-003 | Hold call | Call on hold, music plays |
| CTL-004 | Unhold call | Call resumed |
| CTL-005 | Send DTMF | Tones sent to remote |
| CTL-006 | Hangup active call | Call ends cleanly |

### 5. Transfer Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| TRF-001 | Blind transfer | Call transferred, original ends |
| TRF-002 | Attended transfer | Consult call, then transfer |
| TRF-003 | Cancel transfer | Return to original call |

### 6. Conference Tests

| Test Case | Description | Expected Result |
|-----------|-------------|-----------------|
| CNF-001 | Create conference | Conference created |
| CNF-002 | Add participant | Participant joined |
| CNF-003 | Remove participant | Participant removed |

## Manual Testing Procedure

### Prerequisites
1. Chrome/Firefox browser with WebRTC support
2. Valid SIP extension credentials
3. Microphone access granted
4. Network access to SIP WSS server

### Step-by-Step Test

1. **Login**
   ```
   - Navigate to http://localhost:8100/login
   - Enter credentials (email/password)
   - Click Login
   - Verify redirect to /app/calls
   ```

2. **Check WebRTC Status**
   ```
   - Look for phone status indicator
   - Should show "Ready" after registration
   - Check browser console for:
     [WebRTCPhone] Registerer state: Registered
   ```

3. **Make Outgoing Call**
   ```
   - Open dialpad
   - Enter number: 1234 (test extension)
   - Click call button
   - Verify console shows:
     [WebRTCPhone] call 1234 caller-id
     [WebRTCPhone] Session state changed: Establishing
     [WebRTCPhone] Session state changed: Established
   ```

4. **Receive Incoming Call**
   ```
   - From another SIP client, call your extension
   - Verify ringtone plays
   - Verify caller ID displayed
   - Click Answer
   - Verify audio works both ways
   ```

5. **Test Call Controls**
   ```
   - During active call:
   - Click Mute → verify microphone muted
   - Click Hold → verify call on hold
   - Click Hangup → verify call ends
   ```

## Browser Console Commands for Testing

```javascript
// Check WebRTC phone status
console.log(window.webrtcPhone?.registerer?.state);

// Check active sessions
console.log(window.webrtcPhone?.sessions);

// Check devices
console.log(window.webrtcPhone?.devices);

// Force registration
window.webrtcPhone?.register();

// Unregister
window.webrtcPhone?.unregister();
```

## Playwright E2E Test Approach

Since WebRTC requires real browser capabilities, E2E tests should:

1. **Use real Chromium browser** (not headless for WebRTC)
2. **Grant microphone permissions** automatically
3. **Mock API responses** but use real WebRTC
4. **Use test SIP server** for actual call testing

### Playwright Config for WebRTC

```typescript
// playwright.config.ts
export default defineConfig({
  use: {
    // Use headed mode for WebRTC
    headless: false,

    // Grant permissions
    permissions: ['microphone'],

    // Browser args for WebRTC
    launchOptions: {
      args: [
        '--use-fake-ui-for-media-stream',
        '--use-fake-device-for-media-stream',
      ]
    }
  }
});
```

## Integration with ActionCable

The phone works with ActionCable for:
- Real-time call events from server
- Call state synchronization
- Conference updates

Test ActionCable integration:
```javascript
// Subscribe to agent channel
websocket.join('AgentChannel', { agent_uuid: 'xxx' });

// Listen for call events
websocket.getChannel('AgentChannel').received().subscribe(msg => {
  console.log('Call event:', msg);
});
```

## Troubleshooting

### Common Issues

1. **"No Extension" status**
   - User data doesn't include extension
   - Check login response includes extension data

2. **"Connection Failed" status**
   - WSS server unreachable
   - Check network/firewall
   - Verify wss_server URL

3. **No audio**
   - Microphone permission denied
   - STUN/TURN servers not working
   - Check ICE candidates in console

4. **Registration fails**
   - Wrong password
   - Extension not enabled
   - Domain mismatch

### Debug Logging

Enable SIP.js debug logging:
```typescript
// In createUA(), set logLevel
logLevel: 'debug'  // 'error' | 'warn' | 'log' | 'debug'
```

## Test Coverage Matrix

| Component | Unit Test | Integration | E2E | Manual |
|-----------|-----------|-------------|-----|--------|
| Registration | ✓ | ✓ | ✓ | ✓ |
| Outgoing Call | ✓ | ✓ | ✓ | ✓ |
| Incoming Call | ✓ | ✓ | ✓ | ✓ |
| Mute/Unmute | ✓ | - | ✓ | ✓ |
| Hold/Unhold | ✓ | - | ✓ | ✓ |
| DTMF | ✓ | - | ✓ | ✓ |
| Blind Transfer | ✓ | ✓ | ✓ | ✓ |
| Attended Transfer | ✓ | ✓ | ✓ | ✓ |
| Conference | ✓ | ✓ | ✓ | ✓ |

## Sign-off Criteria

Before release, verify:
- [ ] All manual test cases pass
- [ ] No console errors during normal operation
- [ ] Audio quality acceptable
- [ ] Call stability (no drops)
- [ ] Proper cleanup on hangup
- [ ] Works on Chrome, Firefox, Safari
- [ ] Works on iOS/Android (Capacitor)
