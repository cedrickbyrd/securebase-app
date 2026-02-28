const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");
const { createClient } = require("@supabase/supabase-js");

exports.handler = async (event, context) => {
  // 1. Initialize Supabase Admin (Bypasses RLS to check roles)
  const supabaseAdmin = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SB_SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

  // 2. Validate Authorization Header
  const authHeader = event.headers.authorization || event.headers.Authorization;
  if (!authHeader) {
    return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized: Missing token" }) };
  }

  const token = authHeader.replace("Bearer ", "");

  try {
    // 3. Verify JWT & Get User
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return { statusCode: 401, body: JSON.stringify({ error: "Unauthorized: Invalid session" }) };
    }

    // 4. RBAC Check: Is this user an Admin?
    const { data: profile, error: dbError } = await supabaseAdmin
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    // ✅ DEBUG LOGS — correctly placed inside the try block, after the query
    console.log("DEBUG user.id:", user.id);
    console.log("DEBUG profile:", JSON.stringify(profile));
    console.log("DEBUG dbError:", JSON.stringify(dbError));

  if (profile?.role !== 'admin' && user.email !== 'cedrickjbyrd@me.com') {
  return { statusCode: 403, body: "Unauthorized" };
    }

    // Log successful access to the Activity Feed
    await supabaseAdmin
      .from('activity_feed')
      .insert([
        {
          actor_id: user.id,
          action_type: 'VAULT_ACCESS',
          metadata: {
            resource: 'securebase-evidence-tx-imhotep',
            standard: 'SOC 2 Type II'
          }
        }
      ]);

    // 5. S3 Logic
    const client = new S3Client({
      region: process.env.SB_AWS_REGION || "us-east-1",
      credentials: {
        accessKeyId: process.env.SB_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.SB_AWS_SECRET_ACCESS_KEY,
      },
    });

    const listCommand = new ListObjectsV2Command({
      Bucket: "securebase-evidence-tx-imhotep",
      Prefix: "evidence/",
    });

    const listResponse = await client.send(listCommand);
    const reportFiles = listResponse.Contents.filter(obj => {
      const key = obj.Key.toLowerCase();
      return key.endsWith('.json') && !key.includes('manifest');
    });

    if (!reportFiles.length) throw new Error("No reports found in S3");
    const latestReport = reportFiles.sort((a, b) => b.LastModified - a.LastModified)[0];

    const getCommand = new GetObjectCommand({
      Bucket: "securebase-evidence-tx-imhotep",
      Key: latestReport.Key,
    });

    const s3Response = await client.send(getCommand);
    const bodyContents = await s3Response.Body.transformToString();
    const rawData = JSON.parse(bodyContents);

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
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      },
      body: JSON.stringify(dashboardData)
    };

  } catch (error) {
    console.error("SecureBase Guard Error:", error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message || "Internal server error" }) };
  }
};
