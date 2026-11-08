export const sendSalesAlert = async (domain: string, eventType: string, provider: string, metadata: any) => {
  const webhookUrl = process.env.SALES_ALERT_WEBHOOK_URL;
  if (!webhookUrl) return;

  const providerBadge = provider.toUpperCase() === 'GCP' ? '🟦 Google Cloud' : '🟧 AWS';
  
  const payload = {
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🔥 High-Intent Prospect Activity Detected'
        }
      },
      {
        type: 'section',
        fields: [
          { type: 'mrkdwn', text: `*Domain:*\n\`${domain}\`` },
          { type: 'mrkdwn', text: `*Environment:*\n${providerBadge}` },
          { type: 'mrkdwn', text: `*Action:*\n\`${eventType}\`` },
          { type: 'mrkdwn', text: `*Timestamp:*\n<!date^${Math.floor(Date.now() / 1000)}^{date_num} {time_secs}|${new Date().toISOString()}>` }
        ]
      }
    ]
  };

  await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};
