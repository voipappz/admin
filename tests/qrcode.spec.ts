import { test, expect } from './auth-fixture';
import { getAuthToken, getApiBaseUrl } from './crud-helpers';

/**
 * Extension QR code — token-gated flow (mirrors the WebRTC phone).
 *
 * The QR endpoint (/tasks/qrcode_extension/<uuid>.png) is gated by a short-lived
 * token minted from POST /tasks/webrtc_token (JWT-authorized). The admin now
 * mints that token and passes it as ?va_token=… (was sending no token -> 401).
 *
 * Verifies: mint requires the JWT; the QR rejects no/bogus tokens; and a freshly
 * minted token authorizes the QR (auth passes).
 */
test.describe('Extension QR code (token-gated)', () => {
  test.setTimeout(process.env.CI ? 90000 : 30000);
  const apiBaseUrl = getApiBaseUrl();

  test('mint a token, then the QR authorizes with it and 401s without it', async ({ authenticatedPage: page }) => {
    const authToken = await getAuthToken(page);

    // Grab an extension to test against
    const extResp = await page.request.get(`${apiBaseUrl}/api/extensions?per_page=5`, {
      headers: { Authorization: `Bearer ${authToken}` },
    });
    expect(extResp.status()).toBe(200);
    const extBody = await extResp.json();
    const list = Array.isArray(extBody) ? extBody : (extBody?.data || extBody?.records || []);
    if (!list.length) {
      console.log('⚠️ No extensions in this environment — skipping the happy-path assertion.');
      test.skip();
      return;
    }
    const uuid = list[0].uuid || list[0].id;
    expect(uuid).toBeTruthy();

    // 1) QR with NO token -> 401 (the bug we fixed)
    const noToken = await page.request.get(`${apiBaseUrl}/tasks/qrcode_extension/${uuid}.png`);
    expect(noToken.status()).toBe(401);

    // 2) QR with a BOGUS token -> 401
    const bogus = await page.request.get(`${apiBaseUrl}/tasks/qrcode_extension/${uuid}.png?va_token=bogus-not-a-real-token`);
    expect(bogus.status()).toBe(401);

    // 3) Mint a short-lived token (JWT-authorized) — same call the admin makes
    const mint = await page.request.post(`${apiBaseUrl}/tasks/webrtc_token`, {
      headers: { Authorization: `Bearer ${authToken}` },
      form: { extension_uuid: uuid },
    });
    expect(mint.status()).toBe(200);
    const mintBody = await mint.json();
    expect(mintBody.token).toBeTruthy();
    expect(mintBody.expires_in).toBeGreaterThan(0); // it expires
    console.log(`✅ minted token, expires_in=${mintBody.expires_in}s`);

    // 4) QR WITH the minted token -> auth passes (200 image; 404 only if this
    //    extension has no QR file yet — never 401)
    const withToken = await page.request.get(
      `${apiBaseUrl}/tasks/qrcode_extension/${uuid}.png?va_token=${encodeURIComponent(mintBody.token)}`,
    );
    expect(withToken.status()).not.toBe(401);
    expect([200, 404]).toContain(withToken.status());
    if (withToken.status() === 200) {
      const buf = await withToken.body();
      expect(buf.length).toBeGreaterThan(0);
      console.log(`✅ QR image authorized via minted token (${buf.length} bytes)`);
    }
  });

  test('mint endpoint requires the JWT', async ({ authenticatedPage: page }) => {
    // No Authorization header -> 401
    const resp = await page.request.post(`${apiBaseUrl}/tasks/webrtc_token`, {
      form: { extension_uuid: '00000000-0000-0000-0000-000000000000' },
    });
    expect(resp.status()).toBe(401);
  });
});
