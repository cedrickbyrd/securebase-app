const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SB_SUPABASE_SERVICE_ROLE_KEY // Use Service Role for internal metric aggregation
);

exports.handler = async (event, context) => {
  // 1. Logic: Only allow GET requests
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // 2. Security: Validate the User Session
  const authHeader = event.headers.authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: 'No authorization header' }) };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);

  if (authError || !user) {
    return { statusCode: 401, body: JSON.stringify({ error: 'Unauthorized' }) };
  }

  // 3. RBAC Check: Ensure the user is an Admin
  const role = user.app_metadata?.role || user.user_metadata?.role;
  if (role !== 'Admin') {
    return { statusCode: 403, body: JSON.stringify({ error: 'Forbidden: Admin access required' }) };
  }

  try {
    // 4. Data Aggregation (Phase 5: Real-world stats)
    // In a full Phase 5 setup, you'd query CloudWatch or a 'metrics' table here.
    // For now, we provide the schema that AdminDashboard.jsx expects.
    const adminMetrics = {
      latency: [105, 130, 115, 170, 145, 125], // API response times
      securityEvents: {
        blockedIps: 412,
        failedAuth: 92,
        wafAlerts: 38
      },
      systemStatus: {
        primaryRegion: 'us-east-1',
        drRegion: 'us-west-2',
        drStatus: 'In-Sync'
      },
      timestamp: new Date().toISOString()
    };

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
