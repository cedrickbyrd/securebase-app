const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch'); // Ensure node-fetch is available

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SB_SUPABASE_SERVICE_ROLE_KEY
);

// Helper function to send Slack alerts
const triggerSlackAlert = async (type, message) => {
  const slackPayload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🚨 SecureBase Automated Monitor*\n*Alert Type:* ${type}`
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Status:*\nThreshold Exceeded` },
          { type: "mrkdwn", text: `*Details:*\n${message}` }
        ]
      }
    ]
  };

  await fetch(process.env.SLACK_WEBHOOK_URL, {
    method: 'POST',
    body: JSON.stringify(slackPayload),
  });
};

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No authorization header' }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const role = user.app_metadata?.role || user.user_metadata?.role;
  if (role !== 'Admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden' }) };
  }

  try {
    const adminMetrics = {
      latency: [105, 130, 115, 170, 145, 125],
      securityEvents: {
        blockedIps: 412,
        failedAuth: 92,
        wafAlerts: 38 // Current value is > 30, this will trigger the alert
      },
      systemStatus: {
        primaryRegion: 'us-east-1',
        drRegion: 'us-west-2',
        drStatus: 'In-Sync'
      },
      timestamp: new Date().toISOString()
    };

    // --- AUTO-ALERT LOGIC ---
    if (adminMetrics.securityEvents.wafAlerts > 30) {
      // We wrap this in a try/catch or just fire it to avoid blocking the response
      await triggerSlackAlert(
        "CRITICAL_WAF_SPIKE", 
        `High volume of blocked requests detected: ${adminMetrics.securityEvents.wafAlerts} active alerts.`
      );
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminMetrics),
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to fetch admin metrics' }),
    };
  }
};
