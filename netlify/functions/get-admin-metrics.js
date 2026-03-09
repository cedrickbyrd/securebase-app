const { CloudWatchClient, GetMetricDataCommand } = require("@aws-sdk/client-cloudwatch");
const { createClient } = require('@supabase/supabase-js');

const cwClient = new CloudWatchClient({ region: "us-east-1" }); // Adjust to your primary region
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

exports.handler = async (event, context) => {
  // 1. Auth Check: Verify JWT from AdminDashboard request
  const authHeader = event.headers.authorization;
  if (!authHeader) return { statusCode: 401, body: 'Unauthorized' };

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    return { statusCode: 403, body: JSON.stringify({ error: "Forbidden" }) };
  }

  try {
    // 2. Mocking AWS Data for initial Phase 5 deploy (Switch to actual SDK calls once TF is live)
    const metricsData = {
      latency: [42, 38, 55, 40, 35, 39], // Mock p95 latency in ms
      securityEvents: {
        blockedIps: 12,
        failedAuth: 5,
        wafAlerts: 2
      },
      systemStatus: {
        primaryRegion: "us-east-1",
        drRegion: "us-west-2",
        drStatus: "SYNC_COMPLETE"
      },
      timestamp: new Date().toISOString()
    };

    return {
      statusCode: 200,
      body: JSON.stringify(metricsData),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
