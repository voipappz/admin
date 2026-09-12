# Quick Start Guide - Users CRUD Tests

## 🚀 Get Started in 3 Steps

### Step 1: Start the Dev Server

```bash
# Terminal 1 - Start dev server
npm run dev
```

Wait for the server to start (you'll see output like "Local: http://localhost:3000")

### Step 2: Run the Tests

```bash
# Terminal 2 - Run all users CRUD tests
npx playwright test tests/users-crud.spec.ts
```

### Step 3: View Results

```bash
# View HTML report
npx playwright show-report
```

## 📊 Quick Test Commands

### Run All Users CRUD Tests (23 tests)
```bash
npx playwright test tests/users-crud.spec.ts
```

### Run Specific Test Suites

```bash
# CREATE operations only (3 tests)
npx playwright test tests/users-crud.spec.ts -g "CREATE Operations"

# READ operations only (3 tests)
npx playwright test tests/users-crud.spec.ts -g "READ Operations"

# UPDATE operations only (2 tests)
npx playwright test tests/users-crud.spec.ts -g "UPDATE Operations"

# DELETE operations only (3 tests)
npx playwright test tests/users-crud.spec.ts -g "DELETE Operations"

# FILTERING operations only (3 tests)
npx playwright test tests/users-crud.spec.ts -g "FILTERING"
```

### Run Single Specific Test

```bash
# Test user creation
npx playwright test tests/users-crud.spec.ts -g "should create a new user"

# Test user update
npx playwright test tests/users-crud.spec.ts -g "should update user information"

# Test user deletion
npx playwright test tests/users-crud.spec.ts -g "should delete user successfully"
```

## 🔍 Debug Mode

### Run with UI Mode (Visual Debugger)
```bash
npx playwright test tests/users-crud.spec.ts --ui
```

### Run in Headed Mode (See Browser)
```bash
npx playwright test tests/users-crud.spec.ts --headed
```

### Run with Step-by-Step Debugging
```bash
npx playwright test tests/users-crud.spec.ts --debug
```

## 📋 Test Coverage Summary

| Category | Tests | Description |
|----------|-------|-------------|
| **READ** | 3 | Table display, pagination, sorting |
| **CREATE** | 3 | Dialog, validation, user creation |
| **UPDATE** | 2 | Edit dialog, update operations |
| **DELETE** | 3 | Confirmation, cancel, deletion |
| **FILTERING** | 3 | Filter controls, search, clear |
| **UI/UX** | 4 | Refresh, selection, loading, counts |
| **RESPONSIVE** | 2 | Mobile and tablet viewports |
| **ERROR HANDLING** | 2 | Empty states, dialog behavior |
| **API** | 1 | Direct API integration testing |
| **TOTAL** | **23** | Complete CRUD test coverage |

## ✅ Expected Output

When all tests pass, you'll see:

```
Running 23 tests using 1 worker

  ✓  should load and display users table with proper structure
  ✓  should display pagination controls
  ✓  should support table sorting by columns
  ✓  should open create user dialog when Add User button is clicked
  ✓  should validate required fields when creating user
  ✓  should create a new user successfully
  ✓  should open edit dialog with pre-filled data
  ✓  should update user information successfully
  ✓  should open delete confirmation dialog
  ✓  should cancel user deletion
  ✓  should delete user successfully
  ✓  should display filter controls
  ✓  should filter users by name
  ✓  should clear filters
  ✓  should have refresh button that reloads data
  ✓  should highlight selected row on click
  ✓  should display loading state during operations
  ✓  should display user count and pagination info
  ✓  should work on mobile viewport
  ✓  should work on tablet viewport
  ✓  should handle empty table state
  ✓  should handle dialog close without saving
  ✓  should make proper API calls for user listing

  23 passed (2m 34s)
```

## 🐛 Troubleshooting

### Dev Server Not Running

**Problem**: Tests fail with "page.goto: timeout"

**Solution**:
```bash
# Make sure dev server is running first
npm run dev

# Then run tests in another terminal
npx playwright test tests/users-crud.spec.ts
```

### Authentication Errors

**Problem**: Tests fail with "Unauthorized" or "Invalid credentials"

**Solution**: Check your `.env` file has correct credentials:
```bash
VITE_API_BASE_URL=https://cloud.voipappz.io
TEST_EMAIL=vadmin@voipappz.com
TEST_PASSWORD=Nir5060
```

### Port Already in Use

**Problem**: "Port 3000 is already in use"

**Solution**:
```bash
# Find and kill the process
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 npm run dev
```

### Element Not Found

**Problem**: Tests fail with "element not found"

**Solution**: The UI may have changed. Run in debug mode to inspect:
```bash
npx playwright test tests/users-crud.spec.ts --debug
```

## 📚 More Information

- **Full Documentation**: `tests/README-USERS-CRUD.md`
- **Test File**: `tests/users-crud.spec.ts`
- **Auth Fixture**: `tests/auth-fixture.ts`
- **Playwright Docs**: https://playwright.dev

## 🎯 Pro Tips

### Watch Mode (Auto-rerun on Changes)
```bash
npx playwright test tests/users-crud.spec.ts --ui
```

### Run Only Failed Tests
```bash
npx playwright test tests/users-crud.spec.ts --last-failed
```

### Generate Code for New Tests
```bash
npx playwright codegen http://localhost:3000/users
```

### Run Tests in Parallel
```bash
npx playwright test tests/users-crud.spec.ts --workers=4
```

### Save Test Results
```bash
npx playwright test tests/users-crud.spec.ts --reporter=html,json
```

## 🔄 Continuous Development Workflow

1. **Start Dev Server** (leave running)
   ```bash
   npm run dev
   ```

2. **Make Code Changes** to Users component

3. **Run Tests** to verify changes
   ```bash
   npx playwright test tests/users-crud.spec.ts
   ```

4. **Fix Failures** if any

5. **Commit** when all tests pass
   ```bash
   git add .
   git commit -m "feat: update users CRUD functionality"
   ```

## 🎓 Learning Path

### Beginner
1. Run all tests: `npx playwright test tests/users-crud.spec.ts`
2. View report: `npx playwright show-report`
3. Read the test file to understand structure

### Intermediate
1. Run in UI mode: `--ui`
2. Run specific test suites: `-g "CREATE"`
3. Inspect failing tests with `--debug`

### Advanced
1. Write new tests following existing patterns
2. Create custom fixtures for reusable logic
3. Integrate with CI/CD pipeline
4. Add visual regression testing

---

**Need Help?** Check the full documentation in `tests/README-USERS-CRUD.md`
