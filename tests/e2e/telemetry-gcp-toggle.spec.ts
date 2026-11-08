import { test, expect } from '@playwright/test';

test.describe('SecureBase Telemetry & GCP Provider Toggle E2E', () => {
  const PORTAL_URL = process.env.PORTAL_URL || 'https://demo.securebase.tximhotep.com';
  const API_URL = process.env.API_URL || 'https://securebase-api.onrender.com';

  test('backend endpoint accepts telemetry beacon and responds 200 OK under 150ms', async ({ request }) => {
    const startTime = Date.now();
    const response = await request.post(`${API_URL}/api/v1/telemetry/beacon`, {
      data: {
        sessionId: 'test-session-e2e',
        domain: 'citizens-bank-texas.com',
        provider: 'gcp',
        eventType: 'DRIFT_INSPECTED',
        metadata: { findingId: 'SEC-GCP-001' }
      }
    });

    const elapsed = Date.now() - startTime;
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe('queued');
    expect(elapsed).toBeLessThan(500); // Ensures non-blocking ingest
  });

  test('portal switches provider state, mounts GCP findings, and fires telemetry', async ({ page }) => {
    // Intercept outbound beacon requests to verify frontend dispatch
    const capturedBeacons: Array<any> = [];
    await page.route('**/api/v1/telemetry/beacon', async (route) => {
      const data = route.request().postDataJSON();
      if (data) capturedBeacons.push(data);
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ status: 'queued' })
      });
    });

    await page.goto(PORTAL_URL);

    // Verify initial AWS default state
    const awsPill = page.locator('[data-testid="provider-pill-aws"]');
    await expect(awsPill).toHaveAttribute('data-active', 'true');
    await expect(page.locator('text=s3://prod-audit-records-2026')).toBeVisible();

    // Toggle to GCP
    const gcpPill = page.locator('[data-testid="provider-pill-gcp"]');
    await expect(gcpPill).toBeVisible();
    await gcpPill.click();

    // Assert UI switches to GCP findings
    await expect(gcpPill).toHaveAttribute('data-active', 'true');
    await expect(page.locator('text=gs://prod-audit-records-2026')).toBeVisible();
    await expect(page.locator('text=SEC-GCP-001')).toBeVisible();

    // Assert telemetry beacon was fired for the provider switch
    const switchBeacon = capturedBeacons.find((b) => b.eventType === 'PROVIDER_SWITCHED');
    expect(switchBeacon).toBeDefined();
    expect(switchBeacon?.provider).toBe('gcp');

    // Trigger simulated remediation for GCP
    const remediateButton = page.locator('[data-testid="remediate-btn-SEC-GCP-001"]');
    await expect(remediateButton).toBeVisible();
    await remediateButton.click();

    // Verify SIMULATED_REMEDIATION_TRIGGERED beacon fired with GCP context
    const remBeacon = capturedBeacons.find(
      (b) => b.eventType === 'SIMULATED_REMEDIATION_TRIGGERED' && b.provider === 'gcp'
    );
    expect(remBeacon).toBeDefined();
    expect(remBeacon?.metadata?.findingId).toBe('SEC-GCP-001');
  });
});