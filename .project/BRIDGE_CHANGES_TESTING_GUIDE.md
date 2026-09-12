# Bridge Management Implementation - Testing Guide

## Overview

This document provides comprehensive testing documentation for the bridge management features implemented across the admin dashboard. All changes have been committed to the `dev-fixes-2025` branch.

## Summary of Changes

### 1. Inline Announcement Creation
**Feature**: Add "+ Create New Announcement" option in dropdown selects across all bridge components

**Files Modified**:
- `BotBridge.jsx` - Added inline announcement creation
- `QueueBridge.jsx` - Added inline creation for hold and intro announcements
- `IVRBridge.jsx` - Already had inline announcement creation

**Implementation Pattern**:
```javascript
<MenuItem
  key="add_new"
  onMouseDown={handleCreateNewAnnouncement}
  sx={{ color: 'primary.main', fontWeight: 'bold' }}
>
  + Create New Announcement
</MenuItem>
```

### 2. Global Bridge Type Enforcement
**Feature**: Standardize allowed bridge types across all screens and remove legacy 'que' alias

**Allowed Bridge Types**: `["extension", "queue", "ivr", "number", "call_condition", "vml", "conference", "bot"]`

**Files Modified**:
- `bridgeApi.js` - Global type enforcement, removed 'que' alias
- `IVRBridge.jsx` - Updated bridge types array (8 types)
- `QueueBridge.jsx` - Updated bridge types array
- `DIDDialog.jsx` - Replaced 'que' with 'queue'
- `voipResourcesApi.js` - Removed 'que' normalization

### 3. IVR Entry Name Field
**Feature**: Add required 'name' field to IVR entries to fix API validation

**Files Modified**:
- `IVRBridge.jsx` - Added name field with default value `Entry ${number}`

**UI Changes**:
- Grid updated from 4 to 5 columns: Key | Name | Bridge Type | Bridge | Delete
- Added TextField for entry name editing

### 4. Bridge Display in DID List
**Feature**: Show bridge information in DID table with clickable edit functionality

**Files Modified**:
- `DIDs.jsx` - Added Bridge column, edit dialog handling

**UI Behavior**:
- IVR and Queue bridge names are clickable (dotted underline)
- Clicking opens edit dialog for the bridge
- Other bridge types show name but are not editable
- Auto-refresh DID list after bridge update

### 5. Queue Bridge Comprehensive Update
**Feature**: Complete rewrite to match IVR pattern with agents management

**Files Modified**:
- `QueueBridge.jsx` - Major rewrite (358 insertions, 53 deletions)

**New Features**:
- Edit mode support (`mode` prop: 'create' | 'edit')
- `queue` prop for existing data
- `hideEnvironment` prop
- Announcement loading via bridgeApi
- Inline announcement creation (hold & intro)
- **Agents Management**: Two-panel UI with search, tier controls
- Wider dialog (maxWidth="md")

---

## Testing Instructions

### Test 1: Inline Announcement Creation

**Objective**: Verify announcement creation from bridge dropdowns

**Steps**:
1. Open Bot Bridge dialog
2. Click on Announcement dropdown
3. Verify "+ Create New Announcement" option appears at the top
4. Click the option
5. Verify AnnouncementBridge dialog opens
6. Create a new announcement
7. Verify the new announcement appears in the dropdown and is auto-selected

**Expected Results**:
- Create option visible in Bot, Queue (hold & intro), IVR dropdowns
- Dialog opens without changing dropdown value
- New announcement immediately available after creation

**Test Files**:
- BotBridge: `/components/Bridges/BotBridge/BotBridge.jsx`
- QueueBridge: `/components/Bridges/QueueBridge/QueueBridge.jsx`

---

### Test 2: Global Bridge Types

**Objective**: Verify only allowed bridge types are available

**Steps**:
1. Open IVR Bridge dialog
2. Check available bridge types in entry dropdowns
3. Open Queue Bridge dialog
4. Check max wait time bridge type dropdown
5. Open DID Dialog
6. Check bridge type dropdown

**Expected Results**:
- All dropdowns show: Extension, Queue, IVR, Number, Call Condition, VML, Conference, Bot
- NO 'que' option visible anywhere
- All references use 'queue' not 'que'

**Verification Points**:
- IVRBridge: 8 bridge types available
- QueueBridge: 8 bridge types available
- DIDDialog: 8 bridge types + announcement
- No console errors about unknown bridge types

---

### Test 3: IVR Entry Creation with Names

**Objective**: Verify IVR entries include name field and save successfully

**Steps**:
1. Open IVR Bridge dialog (create new IVR)
2. Fill required fields (name, environment)
3. Add timeout announcement
4. Add entries with different keys (e.g., 1, 2, 3, *)
5. Verify each entry has:
   - Default name: "Entry 1", "Entry 2", etc.
   - Name field is editable
   - Bridge Type dropdown
   - Bridge dropdown
6. Select bridge types and bridges for entries
7. Save IVR

**Expected Results**:
- Each entry has 5 columns: Key | Name | Bridge Type | Bridge | Delete
- Default names auto-populate
- Can edit entry names
- Save succeeds without "entry_X_name is not present" error
- IVR saves with all entry names

**API Validation**:
- Check network request payload includes `entry_1_name`, `entry_2_name`, etc.
- API returns 200/201 status

---

### Test 4: Bridge Display and Edit in DID List

**Objective**: Verify bridge information displays and edit functionality works

**Steps**:
1. Navigate to DIDs screen
2. Verify "Bridge" column in table
3. Check DIDs with different bridge types:
   - IVR bridge: Name should be clickable (dotted underline)
   - Queue bridge: Name should be clickable
   - Number bridge: Shows "Number" (not clickable)
   - Other bridges: Shows name (not clickable)
4. Click on IVR bridge name
5. Verify IVR edit dialog opens with existing data
6. Update IVR name
7. Save changes
8. Verify DID list refreshes and shows updated bridge name
9. Repeat for Queue bridge

**Expected Results**:
- Bridge column visible with sorting capability
- IVR/Queue names are clickable with hover effect (blue color)
- Edit dialog opens in edit mode with pre-filled data
- Changes save successfully
- DID list auto-refreshes after save

**UI Verification**:
- Dotted underline on IVR/Queue bridge names
- Hover changes color to primary blue
- Click opens edit dialog (not DID edit dialog)

---

### Test 5: Queue Agents Management

**Objective**: Verify queue agents can be added, removed, and configured

**Steps**:

#### Create New Queue with Agents:
1. Open Queue Bridge dialog (create mode)
2. Fill basic queue information
3. Scroll to "Queue Agents" section
4. Verify two-panel layout:
   - Left: "All Agents" panel
   - Right: "Selected Agents" panel
5. Search for agent in left panel
6. Click agent to add to queue
7. Verify agent appears in right panel
8. Set agent tier level (1-9)
9. Set agent tier position (1-9)
10. Add multiple agents
11. Save queue

#### Edit Existing Queue:
1. From DID list, click on Queue bridge name
2. Verify Queue edit dialog opens
3. Verify existing agents are loaded in right panel
4. Verify agent tiers are displayed correctly
5. Add new agent
6. Remove existing agent (click delete icon)
7. Update agent tier settings
8. Save changes

**Expected Results**:
- All Agents panel shows extensions from environment
- Search filters agents by name/email
- Adding agent moves it to Selected Agents panel
- Agent shows: Name, Email, Tier Level, Tier Position
- Can set tier level 1-9
- Can set tier position 1-9
- Delete icon removes agent from queue
- Save includes agents data in API request
- Edit mode loads existing agents with tiers

**API Validation**:
```json
{
  "agents": [
    {
      "uuid": "agent-uuid",
      "tier": {
        "level": "1",
        "position": "1"
      },
      "status": ""
    }
  ]
}
```

**Data Validation**:
- Agent name uses `agent.name` property (not fullname)
- Tier levels and positions are strings ("1" not 1)
- Agents array included in both create and update requests

---

## Testing Checklist

### Inline Announcement Creation
- [ ] Bot Bridge: "+ Create New Announcement" visible
- [ ] Queue Bridge Hold: "+ Create New Announcement" visible
- [ ] Queue Bridge Intro: "+ Create New Announcement" visible
- [ ] IVR Bridge: "+ Create New Announcement" visible
- [ ] Dialog opens without changing select value
- [ ] New announcement auto-selected after creation

### Global Bridge Types
- [ ] IVR entries show 8 bridge types (no 'que')
- [ ] Queue max wait time shows 8 bridge types (no 'que')
- [ ] DID dialog shows 8 bridge types + announcement
- [ ] No 'que' references in UI
- [ ] No console errors about unknown types
- [ ] 'queue' used consistently everywhere

### IVR Entry Names
- [ ] Entry grid has 5 columns (Key, Name, Bridge Type, Bridge, Delete)
- [ ] Default names auto-populate: "Entry 1", "Entry 2", etc.
- [ ] Name field is editable
- [ ] Save succeeds without name validation errors
- [ ] API request includes entry_X_name fields

### Bridge Display in DID List
- [ ] "Bridge" column visible in table
- [ ] Column is sortable
- [ ] IVR bridge names are clickable (dotted underline)
- [ ] Queue bridge names are clickable (dotted underline)
- [ ] Number bridges show "Number" (not clickable)
- [ ] Other bridges show name (not clickable)
- [ ] Hover changes clickable names to blue
- [ ] Click opens edit dialog (not DID dialog)

### IVR Edit from DID List
- [ ] Click IVR bridge name opens IVR edit dialog
- [ ] Dialog shows in edit mode with existing data
- [ ] All IVR fields pre-filled correctly
- [ ] Entries loaded with names and bridges
- [ ] Can update IVR name and settings
- [ ] Save updates IVR successfully
- [ ] DID list auto-refreshes after save
- [ ] Updated bridge name visible in table

### Queue Edit from DID List
- [ ] Click Queue bridge name opens Queue edit dialog
- [ ] Dialog shows in edit mode with existing data
- [ ] All queue fields pre-filled correctly
- [ ] Existing agents loaded in right panel
- [ ] Agent tiers displayed correctly
- [ ] Can add/remove agents
- [ ] Can update agent tiers
- [ ] Save updates queue successfully
- [ ] DID list auto-refreshes after save

### Queue Agents Management
- [ ] Two-panel layout visible (All Agents | Selected Agents)
- [ ] All Agents panel shows extensions
- [ ] Search filters agents by name/email
- [ ] Click agent adds to Selected Agents
- [ ] Agent displays: name (using agent.name property)
- [ ] Agent displays: email
- [ ] Tier Level dropdown (1-9)
- [ ] Tier Position dropdown (1-9)
- [ ] Delete icon removes agent
- [ ] Selected count updates correctly
- [ ] Create queue saves agents data
- [ ] Edit queue loads existing agents
- [ ] Update queue saves agents changes

---

## Files Modified

### Bridge Components
- `/src/components/Bridges/BotBridge/BotBridge.jsx`
- `/src/components/Bridges/IVRBridge/IVRBridge.jsx`
- `/src/components/Bridges/QueueBridge/QueueBridge.jsx`

### DID Components
- `/src/components/DIDs/DIDs.jsx`
- `/src/components/DIDs/DIDDialog/DIDDialog.jsx`

### API Services
- `/src/services/api/bridgeApi.js`
- `/src/services/api/voipResourcesApi.js`

### Test Files
- `/tests/did-ivr-creation.spec.ts` (lint fix)

---

## Known Issues and Fixes

### Issue 1: IVR Entry Name Validation Error
**Error**: `{"id":"not_acceptable","message":"entry_3_name is not present"}`
**Fix**: Added name field to IVR entries with default value and UI for editing
**Status**: ✅ Fixed

### Issue 2: Legacy 'que' Bridge Type
**Error**: Inconsistent bridge type references between 'que' and 'queue'
**Fix**: Removed all 'que' references, standardized on 'queue'
**Status**: ✅ Fixed

### Issue 3: Missing Bridge Types in IVR
**Error**: Only 5 bridge types available, missing extension, conference, bot, call_condition
**Fix**: Updated IVRBridge to include all 8 allowed types
**Status**: ✅ Fixed

### Issue 4: Agent Name Field
**Error**: Ambiguity between agent.name, agent.fullname, agent.username
**Fix**: Use only `agent.name` property consistently
**Status**: ✅ Fixed

---

## API Reference

### Bridge Types Endpoint
```
GET /api/assets/bridge_types
Response: ["extension", "queue", "ivr", "number", "call_condition", "vml", "conference", "bot"]
```

### Get Bridge Resources
```
GET /api/{bridge_type_plural}?environment_uuid={uuid}
Examples:
  GET /api/extensions?environment_uuid=xxx
  GET /api/queues?environment_uuid=xxx
  GET /api/ivrs?environment_uuid=xxx
```

### Create/Update Queue with Agents
```
POST/PATCH /api/queues
Content-Type: application/x-www-form-urlencoded

{
  "name": "Support Queue",
  "environment_uuid": "xxx",
  "strategy": "round_robin",
  "agents": [
    {
      "uuid": "agent-1-uuid",
      "tier": {
        "level": "1",
        "position": "1"
      }
    }
  ]
}
```

### Create/Update IVR with Entries
```
POST/PATCH /api/ivrs
Content-Type: application/x-www-form-urlencoded

{
  "name": "Main IVR",
  "environment_uuid": "xxx",
  "entry_1_name": "Sales",
  "entry_1_bridge_type": "queue",
  "entry_1_bridge_uuid": "queue-uuid",
  "entry_2_name": "Support",
  "entry_2_bridge_type": "extension",
  "entry_2_bridge_uuid": "ext-uuid"
}
```

---

## Commit Information

**Branch**: `dev-fixes-2025`
**Latest Commit**: `c4f64e4`
**Commit Message**: "feat: comprehensive QueueBridge update with edit mode and agents management"

**Previous Commits**:
- IVR entry name field addition
- Global bridge type enforcement
- Bridge display in DID list
- Inline announcement creation

---

## Next Steps

1. **Run Manual Testing**: Follow the testing instructions above
2. **Verify API Integration**: Check network requests/responses
3. **Test Edge Cases**:
   - Empty agent list
   - No announcements available
   - Invalid bridge selections
4. **Cross-browser Testing**: Test on Chrome, Firefox, Safari
5. **Mobile Responsiveness**: Test on tablet/mobile viewports
6. **Merge to Main**: After successful testing, merge `dev-fixes-2025` to `main`

---

## Support

For questions or issues:
1. Check API responses in browser DevTools Network tab
2. Review console logs for errors
3. Verify environment_uuid is set correctly
4. Ensure test data (extensions, announcements) exists in the environment

---

**Document Version**: 1.0
**Last Updated**: 2025-12-30
**Author**: Claude Code Agent
