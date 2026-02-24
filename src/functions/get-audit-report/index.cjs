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
    
    // Filter for the audit summary JSON, ignoring manifests
    const reportFiles = listResponse.Contents.filter(obj => {
      const key = obj.Key.toLowerCase();
      return key.endsWith('.json') && !key.includes('manifest');
    });

    const latestReport = reportFiles.sort((a, b) => b.LastModified - a.LastModified)[0];

    const getCommand = new GetObjectCommand({
      Bucket: "securebase-evidence-tx-imhotep",
      Key: latestReport.Key,
    });

    const response = await client.send(getCommand);
    const bodyContents = await response.Body.transformToString();
    const rawData = JSON.parse(bodyContents);

    // MAPPER: Translating raw collector data for the React Dashboard
    const dashboardData = {
      audit_metadata: {
        standard: "SOC 2 Type II",
        status: rawData.summary.score_pct >= 75 ? "In Compliance" : "Action Required",
        run_id: rawData.summary.run_id,
        generated_at: rawData.summary.finished_at
      },
      score: rawData.summary.score_pct,
      stats: {
        passed: rawData.summary.passed,
        warned: rawData.summary.warned,
        failed: rawData.summary.failed
      },
      // Transform "evidence" into "controls"
      controls: rawData.evidence.map(item => ({
        id: item.control_ref,
        title: item.title,
        status: item.status.toLowerCase() === "pass" ? "passed" : 
                item.status.toLowerCase() === "warn" ? "warning" : "failed",
        category: item.category,
        remediation: item.remediation
      }))
    };

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dashboardData)
    };
  } catch (error) {
    console.error("Mapping Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: "Failed to map vault data" }) };
  }
};
