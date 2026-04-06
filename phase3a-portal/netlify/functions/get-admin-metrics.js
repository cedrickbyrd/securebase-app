const { CloudWatchClient } = require("@aws-sdk/client-cloudwatch");

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || 'https://demo.securebase.tximhotep.com';

exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, OPTIONS'
      },
      body: ''
    };
  }

  // Auth check: require Bearer token (validated by Cognito/API Gateway in production)
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return {
      statusCode: 401,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      body: JSON.stringify({ error: 'Unauthorized' })
    };
  }

  // Determine which metric path was requested (from query or path)
  const queryParams = event.queryStringParameters || {};
  const timeRange = queryParams.timeRange || '24h';

  try {
    // NOTE: Real CloudWatch calls require AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY,
    // or an attached IAM role on the Netlify function runtime.
    // Returning structured mock data until AWS credentials are configured in Netlify env.
    const now = new Date().toISOString();

    const metricsData = {
      platform: {
        totalCustomers: 12,
        activeUsers: 89,
        mrr: 48000,
        apiCallsToday: 15420,
        uptimePercent: 99.97,
        timeRange
      },
      security: {
        blockedIps: 12,
        failedAuth: 5,
        wafAlerts: 2,
        openFindings: 3
      },
      infrastructure: {
        primaryRegion: "us-east-1",
        drRegion: "us-west-2",
        drStatus: "SYNC_COMPLETE",
        lambdaErrors: 0,
        dbConnections: 14
      },
      latency: {
        p50: 38,
        p95: 87,
        p99: 142
      },
      costs: {
        currentMonth: 2840,
        projectedMonth: 3100,
        trend: "stable"
      },
      deployments: {
        lastDeploy: now,
        status: "success",
        version: "1.4.2"
      },
      timestamp: now
    };

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Cache-Control': 'no-cache'
      },
      body: JSON.stringify(metricsData)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': ALLOWED_ORIGIN },
      body: JSON.stringify({ error: err.message })
    };
  }
};
