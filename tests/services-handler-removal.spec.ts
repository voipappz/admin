import { test, expect } from './auth-fixture';

/**
 * Service dialog must match the API surface.
 *
 * A Service is the EventStore pub/sub router: it subscribes to triggers and
 * dispatches via a pre-built Handler, or routes matching events to its linked
 * Workflows. Raw handler code (Ruby::Box / Monaco editor) belongs to the
 * Workflow, NOT the Service — so the "Handler Code" section was removed.
 *
 * This UI test guards that removal: the Handler selector stays, the code editor
 * is gone.
 */
test.describe('Service dialog — Handler Code removed (belongs to Workflow)', () => {
  test('New Service dialog keeps Handler but not Handler Code / Ruby::Box', async ({ authenticatedPage: page }) => {
    await page.goto('/services', { waitUntil: 'domcontentloaded', timeout: 20000 });
    await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {});

    // Open the create dialog via the (now accessible) Add Service button
    await page.getByRole('button', { name: 'Add Service' }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('New Service')).toBeVisible({ timeout: 10000 });

    // Kept: the Handler section header (exact match avoids "Handler Type" label)
    await expect(dialog.getByText('Handler', { exact: true })).toBeVisible();

    // Kept: Event Triggers
    await expect(dialog.getByText('Event Triggers')).toBeVisible();

    // Removed: the Handler Code (Ruby::Box) editor and all its traces
    await expect(dialog.getByText('Handler Code')).toHaveCount(0);
    await expect(dialog.getByText('Ruby::Box')).toHaveCount(0);
    await expect(dialog.locator('.monaco-editor')).toHaveCount(0);

    // Removed: the Actions section (HStore actions are no longer edited here)
    await expect(dialog.getByText('Add Action')).toHaveCount(0);
    await expect(dialog.getByText(/configured/)).toHaveCount(0);
  });
});
