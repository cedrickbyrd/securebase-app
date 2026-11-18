// securebase-api/src/services/alertService.ts
const HIGH_INTENT_EVENTS: Record<string, { tier: 'CRITICAL' | 'HIGH'; label: string }> = {
  MARKETPLACE_CTA_CLICKED: {
    tier: 'CRITICAL',
    label: 'Cloud Marketplace Procurement CTA Clicked',
  },
  EVIDENCE_PACKAGE_DOWNLOADED: {
    tier: 'CRITICAL',
    label: 'Examiner WORM Evidence Binder Downloaded',
  },
  SIMULATED_REMEDIATION_TRIGGERED: {
    tier: 'HIGH',
    label: 'OPA Auto-Remediation Triggered in Sandbox',
  },
};

export interface SalesAlertMetadata {
  findingId?: string;
  vaultUri?: string;
  marketplace?: string;
  productSlug?: string;
  campaign?: string;
  [key: string]: unknown;
}

export const sendSalesAlert = async (
  domain: string,
  eventType: string,
  provider: string,
  metadata: SalesAlertMetadata = {}
): Promise<{ dispatched: boolean; reason?: string }> => {
  const intent = HIGH_INTENT_EVENTS[eventType];
  if (!intent) {
    return { dispatched: false, reason: 'non_conversion_event' };
  }

  const slackWebhookUrl = process.env.SALES_ALERT_WEBHOOK_URL;
  const crmWebhookUrl = process.env.CRM_WEBHOOK_URL;
  if (!slackWebhookUrl && !crmWebhookUrl) {
    return { dispatched: false, reason: 'no_webhook_configured' };
  }

  const safeDomain = (domain || 'unknown-prospect').trim();
  const normalizedProvider = (provider || 'aws').toUpperCase();
  const providerBadge =
    normalizedProvider === 'GCP'
      ? '🟦 Google Cloud (`securebase-gcp-dev`)'
      : '🟧 AWS Commercial & Gov';

  const contextLines: string[] = [];
  if (metadata.findingId) contextLines.push(`• *Control / Finding:* \`${metadata.findingId}\``);
  if (metadata.vaultUri) contextLines.push(`• *WORM Vault:* \`${metadata.vaultUri}\``);
  if (metadata.productSlug) contextLines.push(`• *Listing:* \`${metadata.productSlug}\``);
  if (metadata.campaign) contextLines.push(`• *Campaign:* \`${metadata.campaign}\``);

  const slackPayload = {
    text: `[${intent.tier}] ${intent.label} — ${safeDomain} (${normalizedProvider})`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text:
            intent.tier === 'CRITICAL'
              ? '🚨 High-Intent Conversion Action Detected'
              : '🔥 Enterprise Sandbox Engagement Detected',
        },
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Prospect Domain:*\n\`${safeDomain}\`` },
          { type: 'mrkdwn', text: `*Cloud Control Plane:*\n${providerBadge}` },
          { type: 'mrkdwn', text: `*Conversion Event:*\n\`${eventType}\`` },
          {
            type: 'mrkdwn',
            text: `*Timestamp:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toISOString()}>`,
          },
        ],
      },
      ...(contextLines.length > 0
        ? [
            {
              type: 'section',
              text: {
                type: 'mrkdwn',
                text: `*Telemetry Context:*\n${contextLines.join('\n')}`,
              },
            },
          ]
        : []),
      {
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: { type: 'plain_text', text: 'Inspect Demo Environment' },
            url: `https://demo.securebase.tximhotep.com/compliance?tenant=demo&utm_source=${encodeURIComponent(safeDomain)}`,
          },
        ],
      },
    ],
  };

  const crmPayload = {
    source: 'securebase-demo-portal',
    tier: intent.tier,
    domain: safeDomain,
    eventType,
    provider: normalizedProvider.toLowerCase(),
    metadata,
    timestamp: new Date().toISOString(),
  };

  const deliveries: Promise<Response>[] = [];

  if (slackWebhookUrl) {
    deliveries.push(
      fetch(slackWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(slackPayload),
        signal: AbortSignal.timeout(4000),
      })
    );
  }

  if (crmWebhookUrl) {
    deliveries.push(
      fetch(crmWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(crmPayload),
        signal: AbortSignal.timeout(4000),
      })
    );
  }

  const results = await Promise.allSettled(deliveries);
  const anySucceeded = results.some((r) => r.status === 'fulfilled' && r.value.ok);

  return {
    dispatched: anySucceeded,
    reason: anySucceeded ? undefined : 'webhook_delivery_failed',
  };
};
