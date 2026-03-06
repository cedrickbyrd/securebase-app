const { createClient } = require('@supabase/supabase-js');
const fetch = require('node-fetch');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SB_SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method Not Allowed' };

  // 1. RBAC Security Check
  const authHeader = event.headers.authorization;
  const token = authHeader?.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || user?.app_metadata?.role !== 'Admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  const { type, severity, message } = JSON.parse(event.body);

  // 2. Format Slack Message (Block Kit)
  const slackPayload = {
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*🚨 SecureBase Security Alert*\n*Type:* ${type}\n*Severity:* ${severity}`
        }
      },
      {
        type: "section",
        fields: [
          { type: "mrkdwn", text: `*Message:*\n${message}` },
          { type: "mrkdwn", text: `*Time:*\n${new Date().toLocaleString()}` }
        ]
      }
    ]
  };

  // 3. Post to Slack
  try {
    const response = await fetch(process.env.SLACK_WEBHOOK_URL, {
      method: 'POST',
      body: JSON.stringify(slackPayload),
    });

    return { statusCode: 200, body: JSON.stringify({ sent: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
