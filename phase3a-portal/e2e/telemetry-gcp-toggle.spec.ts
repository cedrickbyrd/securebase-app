import { test, expect } from '@playwright/test';

interface DemoBeaconRequest {
  event: string;
  payload: {
    provider?: 'aws' | 'gcp';
    domain?: string;
    switchedFrom?: 'aws' | 'gcp';
    findingId?: string;
    [key: string]: any;
  };
  timestamp: string;
}

test.describe('SecureBase Telemetry & GCP Provider Toggle E2E', () => {
  const API_URL = process.env.API_URL || 'https://securebase-api.onrender.com';

  test('backend endpoint accepts telemetry beacon and responds 200 OK under 500ms', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.post(`${API_URL}/api/v1/telemetry/beacon`, {
      data: {
        event: 'DRIFT_INSPECTED',
        payload: {
          sessionId: 'test-session-e2e',
          domain: 'cnboftexas.com',
          provider: 'gcp',
          findingId: 'SEC-GCP-001',
        },
        timestamp: new Date().toISOString(),
      },
    });

    const elapsed = Date.now() - startTime;

    if (response.status() === 503 && process.env.STRICT_API !== 'true') {
      test.info().annotations.push({
        type: 'warning',
        description: `Render backend at ${API_URL} returned 503 (cold start / suspended).`,
      });
      return;
    }

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('queued');
    expect(elapsed).toBeLessThan(500);
  });

  test('portal switches provider state, mounts GCP findings, and fires conversion telemetry', async ({ page }) => {
    const capturedBeacons: DemoBeaconRequest[] = [];

    // 1. Intercept compliance history fetch so Compliance.jsx mounts immediately without external timeout
    await page.route(/.*\/api\/v1\/compliance\/history.*/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          tenant: 'demo',
          overallScore: 98,
          frameworks: {
            ffiec: { score: 98, passing: 42, total: 43 },
            soc2: { score: 100, passing: 64, total: 64 },
            hipaa: { score: 96, passing: 38, total: 40 },
          },
        }),
      });
    });

    // 2. Intercept outbound telemetry beacons
    await page.route('**/api/v1/telemetry/beacon', async (route) => {
      const data = route.request().postDataJSON() as DemoBeaconRequest;
      if (data) capturedBeacons.push(data);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'queued' }),
      });
    });

    // Navigate directly to /compliance preserving UTM attribution
    await page.goto('/compliance?tenant=demo&utm_source=cnboftexas.com&utm_campaign=ffiec_q4', {
      waitUntil: 'domcontentloaded',
    });

    // 3. Verify initial AWS default state from ProviderToggle.tsx
    const awsPill = page.getByTestId('provider-pill-aws');
    await expect(awsPill).toHaveAttribute('data-active', 'true');
    await expect(page.getByText('s3://prod-audit-records-2026')).toBeVisible();

    // 4. Toggle to GCP
    const gcpPill = page.getByTestId('provider-pill-gcp');
    await expect(gcpPill).toBeVisible();
    await gcpPill.click();

    await expect(gcpPill).toHaveAttribute('data-active', 'true');
    await expect(page.getByText('gs://prod-audit-records-2026')).toBeVisible();
    await expect(page.getByText('SEC-GCP-001')).toBeVisible();

    await expect
      .poll(() =>
        capturedBeacons.some(
          (b) =>
            b.event === 'PROVIDER_SWITCHED' &&
            b.payload?.provider === 'gcp' &&
            b.payload?.switchedFrom === 'aws'
        )
      )
      .toBe(true);

    // 5. Trigger simulated remediation for GCP
    const remediateButton = page.getByTestId('remediate-btn-SEC-GCP-001');
    await expect(remediateButton).toBeVisible();
    await remediateButton.click();

    await expect
      .poll(() =>
        capturedBeacons.some(
          (b) =>
            b.event === 'SIMULATED_REMEDIATION_TRIGGERED' &&
            b.payload?.provider === 'gcp' &&
            b.payload?.findingId === 'SEC-GCP-001'
        )
      )
      .toBe(true);

    // 6. Verify Pre-Footer GCP Marketplace CTA link & attribution
    const gcpMarketplaceCta = page.locator(
      'a[href="https://console.cloud.google.com/marketplace/product/tximhotep-public/securebase"]'
    );
    await expect(gcpMarketplaceCta).toBeVisible();

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      gcpMarketplaceCta.click(),
    ]);
    await popup.close();

    await expect
      .poll(() =>
        capturedBeacons.some(
          (b) =>
            b.event === 'MARKETPLACE_CTA_CLICKED' &&
            b.payload?.provider === 'gcp'
        )
      )
      .toBe(true);
  });
});
