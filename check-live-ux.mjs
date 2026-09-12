import { chromium } from '@playwright/test';

const apiBaseUrl = 'https://mtnunicom.mtn.com.gh:8000';
const email = 'akosua.bafu@mtn.com';
const password = 'GulLXb5DrqLJA7f9oIrDHH4m-Kk';
const otp = '902100';

function decodeJwt(token) {
  const payload = token.split('.')[1];
  return JSON.parse(Buffer.from(payload, 'base64').toString());
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Login
  console.log('Logging in...');
  const loginResp = await page.request.post(
    `${apiBaseUrl}/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
  );
  const loginData = await loginResp.json();
  console.log('Login:', loginData.otp_sent ? 'OTP sent' : 'failed');

  const otpResp = await page.request.post(
    `${apiBaseUrl}/auth/otp/verify?temp_token=${encodeURIComponent(loginData.temp_token)}&code=${otp}&email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`
  );
  const tokens = await otpResp.json();
  console.log('OTP:', tokens.access ? 'success' : 'failed');

  // Decode JWT to build full authData
  const decoded = decodeJwt(tokens.access);
  const refreshDecoded = tokens.refresh ? decodeJwt(tokens.refresh) : {};
  const accountUuid = refreshDecoded.account_uuid || decoded.account_uuid || decoded.uuid || null;
  const customer = decoded.customer || null;
  const meta = decoded.meta || {};
  const isRoot = meta.root === 'true' || meta.root === true;
  const acl = decoded.acl || null;

  const authData = {
    user: { email, firstName: '', lastName: '', fullName: '', uuid: accountUuid || '' },
    csrf: tokens.csrf,
    access: tokens.access,
    refresh: tokens.refresh,
    accessExpiresAt: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : null,
    refreshExpiresAt: refreshDecoded.exp ? new Date(refreshDecoded.exp * 1000).toISOString() : null,
    accountUuid, customerUuid: customer?.uuid || null,
    accountCustomer: customer, isRoot, acl
  };

  // Set full auth in localStorage
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded' });
  await page.evaluate((a) => { localStorage.setItem('auth', JSON.stringify(a)); }, authData);

  // Navigate to Live screen (defaults to Live Calls tab)
  await page.goto('http://localhost:3000/live', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  await page.screenshot({ path: '/tmp/live-calls-default.png', fullPage: false });
  console.log('Screenshot 1: Live Calls (default tab)');

  // Click on Live Agents tab (tab 0)
  const agentsTab = page.locator('button[role="tab"]').nth(0);
  await agentsTab.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/live-agents.png', fullPage: false });
  console.log('Screenshot 2: Live Agents tab');

  // Click on SIP Registrations tab
  const regsTab = page.locator('button[role="tab"]').nth(2);
  await regsTab.click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: '/tmp/live-regs.png', fullPage: false });
  console.log('Screenshot 3: SIP Registrations tab');

  await browser.close();
  console.log('Done!');
})();
