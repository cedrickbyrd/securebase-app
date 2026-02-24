const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");

exports.handler = async (event, context) => {
  const client = new S3Client({
    region: process.env.SB_AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.SB_AWS_ACCESS_KEY_ID, 
      secretAccessKey: process.env.SB_AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    const listCommand = new ListObjectsV2Command({
      Bucket: "securebase-evidence-tx-imhotep",
      Prefix: "evidence/",
    });

    const listResponse = await client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "No audit reports found" }) };
    }

    // UPDATED LOGIC: Filter for actual report data, ignoring manifests
    const reportFiles = listResponse.Contents.filter(obj => {
      const key = obj.Key.toLowerCase();
      return key.endsWith('.json') && !key.includes('manifest');
    });

    if (reportFiles.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "No valid summary report found" }) };
    }

    // Sort to get the most recent one
    const latestReport = reportFiles.sort((a, b) => b.LastModified - a.LastModified)[0];

    const getCommand = new GetObjectCommand({
      Bucket: "securebase-evidence-tx-imhotep",
      Key: latestReport.Key,
    });
    // ... (previous S3 setup code) ...

    const response = await client.send(getCommand);
    const bodyContents = await response.Body.transformToString();
    const rawData = JSON.parse(bodyContents);

    // MAPPER: Convert raw collector data to SecureBase Dashboard format
    const dashboardData = {
      audit_metadata: {
        standard: rawData.summary?.frameworks[0]?.toUpperCase() || "SOC 2",
        status: rawData.summary?.score_pct > 70 ? "In Compliance" : "Action Required",
        run_id: rawData.summary?.run_id,
        generated_at: rawData.summary?.finished_at
      },
      score: rawData.summary?.score_pct || 0,
      stats: {
        passed: rawData.summary?.passed || 0,
        failed: rawData.summary?.failed || 0,
        warned: rawData.summary?.warned || 0
      },
      // Map "evidence" array to "controls" for the UI
      controls: (rawData.evidence || []).map(item => ({
        id: item.control_ref,
        title: item.title,
        status: item.status === "PASS" ? "passed" : item.status === "WARN" ? "warning" : "failed",
        category: item.category,
        remediation: item.remediation
      }))
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dashboardData)
    };

// ... (error handling) ...
  }
};
