import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

// Initialize the client using your Netlify environment variables
const client = new DynamoDBClient({
  region: process.env.SB_AWS_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.SB_AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.SB_AWS_SECRET_ACCESS_KEY,
  },
});

const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event, context) => {
  try {
    // 1. Scan your metrics table (Ensure this matches your Terraform table name)
    const command = new ScanCommand({
      TableName: "SystemMetrics", 
      Limit: 10,
    });

    const response = await docClient.send(command);
    
    // Sort items by timestamp to ensure the chart flows correctly left-to-right
    const items = (response.Items || []).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

    // 2. Map DynamoDB attributes to Chart.js format
    const labels = items.map(item => 
      new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
    const dataPoints = items.map(item => item.uptimePercentage);

    return {
      statusCode: 200,
      headers: { 
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*" // Good for cross-origin testing
      },
      body: JSON.stringify({
        infraHealth: items[items.length - 1]?.status || "Operational",
        infraHealthChartData: {
          labels: labels.length > 0 ? labels : ["No Data"],
          datasets: [{
            label: "Uptime %",
            data: dataPoints.length > 0 ? dataPoints : [100],
            borderColor: "#10b981",
            tension: 0.1
          }]
        }
      }),
    };
  } catch (error) {
    console.error("AWS DynamoDB Error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Failed to fetch real-time telemetry",
        details: error.message 
      }),
    };
  }
};
