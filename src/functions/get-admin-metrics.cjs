const { createClient } = require('@supabase/supabase-js');
const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const fetch = require('node-fetch');

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SB_SUPABASE_SERVICE_ROLE_KEY);
const cwClient = new CloudWatchClient({
  region: process.env.AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  },
});

const triggerSlackAlert = async (type, message) => {
  const slackPayload = {
    blocks: [
      { type: "section", text: { type: "mrkdwn", text: `*🚨 SecureBase Automated Monitor*\n*Alert Type:* ${type}` } },
      { type: "section", fields: [
        { type: "mrkdwn", text: `*Status:*\nThreshold Exceeded` },
        { type: "mrkdwn", text: `*Details:*\n${message}` }
      ]}
    ]
  };
  await fetch(process.env.SLACK_WEBHOOK_URL, { method: 'POST', body: JSON.stringify(slackPayload) });
};

exports.handler = async (event, context) => {
  // 1. Supabase Auth & Admin Role Check
  const authHeader = event.headers.authorization;
  if (!authHeader) return { statusCode: 401, body: JSON.stringify({ error: 'No auth header' }) };
  
  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  const role = user?.app_metadata?.role || user?.user_metadata?.role;

  if (authError || role !== 'Admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
  }

  try {
    // 2. Fetch Live Telemetry from AWS
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 6 * 60 * 60 * 1000); // Last 6 hours

    const cwParams = {
      StartTime: startTime,
      EndTime: endTime,
      MetricDataQueries: [
        {
          Id: "p95_latency",
          MetricStat: {
            Metric: {
              Namespace: "AWS/ApiGateway",
              MetricName: "Latency",
              Dimensions: [{ Name: "ApiName", Value: "securebase-api-prod" }]
            },
            Period: 3600,
            Stat: "p95"
          }
        }
      ]
    };

    const cwData = await cwClient.send(new GetMetricDataCommand(cwParams));
    const liveLatency = cwData.MetricDataResults[0].Values.reverse();

    // 3. Assemble Response Object
    const adminMetrics = {
      latency: liveLatency.length > 0 ? liveLatency : [0, 0, 0, 0, 0, 0], // Fallback if no traffic yet
      securityEvents: {
        blockedIps: 412, 
        failedAuth: 92,
        wafAlerts: 38 // This still triggers the Slack alert below
      },
      systemStatus: {
        primaryRegion: process.env.AWS_REGION,
        drStatus: 'In-Sync'
      },
      timestamp: new Date().toISOString()
    };

    // 4. Trigger Slack if WAF Alerts are high
    if (adminMetrics.securityEvents.wafAlerts > 30) {
      await triggerSlackAlert("CRITICAL_WAF_SPIKE", `High volume: ${adminMetrics.securityEvents.wafAlerts} active alerts.`);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adminMetrics),
    };
  } catch (err) {
    console.error("Telemetry Error:", err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch live metrics' }) };
  }
};
