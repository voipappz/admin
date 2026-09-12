// verify-ux.mjs — Verify global CSS is applied on MTN environment
import { chromium } from 'playwright';

const BASE = 'http://localhost:3001';
const EMAIL = 'akosua.bafu@mtn.com';
const PASSWORD = 'GulLXb5DrqLJA7f9oIrDHH4m-Kk';
const OTP = '902100';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  // 1. Login page — verify inputs have branded styling
  console.log('=== LOGIN PAGE ===');
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: '/tmp/screenshots/01-login.png', fullPage: false });
  console.log('  ✅ 01-login.png');

  // Check computed styles on login inputs
  const loginInputStyle = await page.evaluate(() => {
    const input = document.querySelector('.MuiOutlinedInput-root');
    if (!input) return 'NO MUI INPUT FOUND on login';
    const cs = getComputedStyle(input);
    return {
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
      fontFamily: cs.fontFamily.slice(0, 50),
    };
  });
  console.log('  Login input computed style:', JSON.stringify(loginInputStyle));

  // 2. Authenticate
  console.log('\n🔐 Authenticating...');
  const loginResp = await page.request.post(
    `${BASE}/auth/login?email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}`
  );
  const loginData = await loginResp.json();
  if (!loginData.temp_token) {
    console.log('  FAIL:', JSON.stringify(loginData).slice(0, 100));
    await browser.close();
    process.exit(1);
  }
  const otpResp = await page.request.post(
    `${BASE}/auth/otp/verify?temp_token=${encodeURIComponent(loginData.temp_token)}&code=${OTP}&email=${encodeURIComponent(EMAIL)}&password=${encodeURIComponent(PASSWORD)}`
  );
  const tokens = await otpResp.json();
  if (!tokens.access) {
    console.log('  OTP FAIL:', JSON.stringify(tokens).slice(0, 100));
    await browser.close();
    process.exit(1);
  }
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.evaluate((t) => localStorage.setItem('auth', JSON.stringify(t)), tokens);
  console.log('  ✅ Authenticated');

  // 3. Dashboard — check filter input styling
  console.log('\n=== DASHBOARD (Live Agents) ===');
  await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 15000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/screenshots/02-dashboard.png', fullPage: false });
  console.log('  ✅ 02-dashboard.png');

  const dashInputStyle = await page.evaluate(() => {
    const input = document.querySelector('.MuiOutlinedInput-root');
    if (!input) return 'NO MUI INPUT on dashboard';
    const cs = getComputedStyle(input);
    return {
      borderRadius: cs.borderRadius,
      background: cs.backgroundColor,
      fontFamily: cs.fontFamily.slice(0, 50),
    };
  });
  console.log('  Dashboard input computed style:', JSON.stringify(dashInputStyle));

  // 4. Check what sidebar items this account CAN see
  console.log('\n=== SIDEBAR NAVIGATION ===');
  const sidebarItems = await page.evaluate(() => {
    const links = document.querySelectorAll('a[href], [role="button"]');
    const items = [];
    links.forEach(el => {
      const href = el.getAttribute('href');
      const text = el.textContent?.trim();
      if (href && href.startsWith('/') && text) {
        items.push({ href, text: text.slice(0, 30) });
      }
    });
    return items;
  });
  console.log('  Sidebar links:', JSON.stringify(sidebarItems, null, 2));

  // 5. Try each visible sidebar route
  const routes = [...new Set(sidebarItems.map(i => i.href))].filter(h => h !== '/' && h !== '/login');
  for (const route of routes.slice(0, 8)) {
    console.log(`\n=== ${route.toUpperCase()} ===`);
    try {
      await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await page.waitForTimeout(3000);
      const safeName = route.replace(/\//g, '_').replace(/^_/, '');
      await page.screenshot({ path: `/tmp/screenshots/03-${safeName}.png`, fullPage: false });
      console.log(`  ✅ 03-${safeName}.png`);

      // Check if this page has MUI inputs, dialogs, chips, etc.
      const pageElements = await page.evaluate(() => {
        const results = {};
        results.muiInputs = document.querySelectorAll('.MuiOutlinedInput-root').length;
        results.muiChips = document.querySelectorAll('.MuiChip-root').length;
        results.muiDialogTitles = document.querySelectorAll('.MuiDialogTitle-root').length;
        results.muiButtons = document.querySelectorAll('.MuiButton-root').length;
        results.muiIconButtons = document.querySelectorAll('.MuiIconButton-root').length;
        results.tables = document.querySelectorAll('.MuiTable-root').length;
        results.addIcons = document.querySelectorAll('[data-testid="AddIcon"]').length;

        // Check first input styling
        const firstInput = document.querySelector('.MuiOutlinedInput-root');
        if (firstInput) {
          const cs = getComputedStyle(firstInput);
          results.inputBorderRadius = cs.borderRadius;
          results.inputBg = cs.backgroundColor;
        }

        // Check first chip styling
        const firstChip = document.querySelector('.MuiChip-root');
        if (firstChip) {
          const cs = getComputedStyle(firstChip);
          results.chipFontFamily = cs.fontFamily.slice(0, 40);
        }

        return results;
      });
      console.log(`  Elements:`, JSON.stringify(pageElements));
    } catch (err) {
      console.log(`  ⚠️ ${route}: ${err.message}`);
    }
  }

  console.log('\n✅ Verification complete');
  await browser.close();
})();
