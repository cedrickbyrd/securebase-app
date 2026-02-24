const { S3Client, ListObjectsV2Command, GetObjectCommand } = require("@aws-sdk/client-s3");

exports.handler = async (event, context) => {
  // 1. Setup the S3 Client with PRIVATE environment variables
  const client = new S3Client({
    region: process.env.SB_AWS_REGION || "us-east-1",
    credentials: {
      accessKeyId: process.env.SB_AWS_ACCESS_KEY_ID, 
      secretAccessKey: process.env.SB_AWS_SECRET_ACCESS_KEY,
    },
  });

  try {
    // 2. Find the latest JSON in the bucket
    const listCommand = new ListObjectsV2Command({
      Bucket: "securebase-evidence-tx-imhotep",
      Prefix: "evidence/",
    });

    const listResponse = await client.send(listCommand);
    
    if (!listResponse.Contents || listResponse.Contents.length === 0) {
      return { statusCode: 404, body: JSON.stringify({ error: "No audit reports found" }) };
    }

    const latestJson = listResponse.Contents
      .filter(obj => obj.Key.endsWith('.json'))
      .sort((a, b) => b.LastModified - a.LastModified)[0];

    // 3. Fetch the actual content
    const getCommand = new GetObjectCommand({
      Bucket: "securebase-evidence-tx-imhotep",
      Key: latestJson.Key,
    });

    const response = await client.send(getCommand);
    const bodyContents = await response.Body.transformToString();

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: bodyContents
    };
  } catch (error) {
    console.error("S3 Backend Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to retrieve vault data" })
    };
  }
};
