# Known Issues & Technical Debt

## Active Issues

### 1. Subscriptions Page - API Integration Verified ✅
**Status:** 🟢 Frontend Complete, Backend Exists
**Priority:** Low (Ready for Use)
**Component:** `src/components/Subscriptions/Subscriptions.jsx`

**Verification Complete (Dec 18, 2024):**
✅ API service fully implemented: `src/services/api/subscriptionsApi.js`
✅ Custom hook with CRUD operations: `useSubscriptions.js`
✅ Component with full UI: `Subscriptions.jsx`
✅ Filter components: `SubscriptionsFilters.jsx`
✅ Dialog for create/edit: `SubscriptionDialog.jsx`
✅ Error handling and loading states
✅ Backend API endpoint exists: `/api/subscriptions`

**AngularJS Reference Verified:**
- Resource: `/opt/src/va-voipbox-admin/src/scripts/services/subscriptions/resource.js`
- State: `/opt/src/va-voipbox-admin/src/scripts/states/subscriptions.js`
- API Pattern: Matches legacy implementation

**API Endpoints Confirmed:**
- `GET /api/subscriptions` - List subscriptions
- `GET /api/subscriptions/:id` - Get single subscription
- `POST /api/subscriptions` - Create subscription
- `PATCH /api/subscriptions/:id` - Update subscription
- `DELETE /api/subscriptions/:id` - Delete subscription
- `GET /api/subscriptions?action=types` - Get types
- `GET /api/subscriptions?action=statuses` - Get statuses
- `PATCH /api/subscriptions/:id` (action: cancel/terminate) - Special actions

**Status:**
Frontend implementation is complete and matches AngularJS patterns. The page will work once:
1. Backend API has subscription data to display
2. User has proper permissions to view subscriptions
3. Environment context is properly set

**Note:** If page shows "No subscriptions", this is correct behavior when no data exists in the database. Not an error.

---

### 2. Environments Table - Layout Fixed ✅
**Status:** 🟢 Resolved (Dec 18, 2024)
**Priority:** Complete
**Component:** `src/components/Environments/Environments.jsx`

**Issue Resolved:**
✅ Table now fills entire available height
✅ Proper scrolling behavior for large datasets
✅ Pagination stays fixed at bottom
✅ Matches DIDs/Services full-screen layout pattern

**Changes Made:**
- Changed content area overflow from 'auto' to 'hidden'
- Made TableContainer scrollable with flex-grow: 1
- Fixed pagination positioning with flexShrink: 0
- Added proper height constraints to Paper component
- Header uses flexShrink: 0 (doesn't shrink)

**Commit:** `337a340` (Dec 18, 2024)

---

### 3. Filters Implementation - Complete ✅
**Status:** 🟢 Resolved (Dec 18, 2024)
**Priority:** Complete
**Component:** Multiple (All screens with filters)

**Implementation Complete:**
✅ Created 5 reusable filter components in `src/components/shared/Filters/`
✅ TextSearchFilter - Text input with search icon
✅ DropdownFilter - Material-UI Select for options
✅ BooleanFilter - Yes/No/All dropdown
✅ DateRangeFilter - Start/End date pickers
✅ FilterBar - Container with Apply/Clear buttons

**Screens with Filters Implemented:**
✅ **DIDs** - Search (name/number), Type, Status, Provider
✅ **Services** - Search (name), Type, Status
✅ **Users** - Name/Email search, Status (already had complete implementation)
✅ **Environments** - Search, Type, Status (already had complete implementation)
✅ **Subscriptions** - Has SubscriptionsFilters component

**Filter Features:**
- Collapsible UI to save screen space
- Apply/Clear functionality
- Temporary filter state (prevents unnecessary API calls)
- Proper API parameter building: `search[field]=value`
- Matches AngularJS smart-table patterns
- Material-UI v7 components throughout

**Commits:**
- `8f01c20` - Filter components and implementation (Dec 18, 2024)
- Fixed localhost:3000 configuration issue in same commit

---

## Test Infrastructure Issues

### 2. Cypress Tests - API Availability
**Status:** 🟡 Intermittent
**Priority:** High
**Component:** Cypress E2E Tests

**Issue:**
API endpoint (`https://cloud.voipappz.io`) returns intermittent 503 errors during test runs.

**Error Message:**
```
"failure to get a peer from the ring-balancer"
HTTP Status: 503
```

**Impact:**
- All Cypress tests fail at login
- Cannot verify CRUD operations
- Test suite unreliable

**Workaround:**
- Tests include retry logic (2 retries configured)
- 503 errors are logged but don't immediately fail tests
- Tests wait for successful auth state

**Long-term Fix:**
- Investigate load balancer configuration
- Consider test environment with dedicated API instance
- Add API health checks before test runs

**Related Files:**
- `cypress.config.ts` (retry configuration)
- `cypress/support/commands.ts` (login with retry)
- `.env` (API endpoint configuration)

---

## Planned Enhancements

### 3. Live Feature Enhancement
**Status:** 🟢 Planned
**Priority:** High
**Component:** Live Dashboard

**Description:**
Enhance Live page with additional data views:
- Live Calls/Sessions table
- SIP Registrations table
- Table/Chart toggle functionality
- Enhanced counter cards

**Plan Document:** `.project/live-feature-plan.md`

**Estimated Time:** 4 hours

---

## Documentation Needs

### 4. Environment Setup Documentation
**Status:** ✅ Complete
**Component:** CLAUDE.md

**Completed:**
- ✅ .env file requirements documented
- ✅ API endpoint configuration explained
- ✅ Credential verification commands added
- ✅ Proxy configuration documented

---

## Technical Debt

### 5. Code Quality Items

**TypeScript Migration:**
- Many components use `.jsx` without TypeScript
- Consider gradual migration to `.tsx`
- Add proper type definitions

**Testing Coverage:**
- Unit tests missing for most components
- Only E2E tests currently implemented
- Add Jest + React Testing Library

**Performance Optimization:**
- Review WebSocket connection pooling
- Optimize re-renders in Live dashboard
- Consider React.memo for heavy components

**Accessibility:**
- Add ARIA labels consistently
- Keyboard navigation improvements
- Screen reader testing needed

---

## Recently Resolved

### ✅ Cypress Test Structure
**Resolved:** December 2024
- Fixed login command with proper auth wait
- Added Material-UI selector patterns
- Implemented API intercepts for data loading
- Added locale error suppression

### ✅ Environment Variable Management
**Resolved:** December 2024
- Moved credentials to .env file
- Documented configuration requirements
- Added verification scripts

---

## Update Log

- **2024-12-17:** Added Subscriptions API integration issue
- **2024-12-17:** Documented Cypress API availability issue
- **2024-12-17:** Added Live feature enhancement plan

---

**Maintenance Notes:**
- Review this document monthly
- Mark resolved items with ✅ and date
- Archive resolved items after 3 months
- Link to relevant GitHub issues when available
