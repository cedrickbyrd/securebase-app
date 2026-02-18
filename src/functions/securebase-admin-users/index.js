import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, ScanCommand } from "@aws-sdk/lib-dynamodb";

const client = new DynamoDBClient({
    region: process.env.SB_AWS_REGION,
    credentials: {
        accessKeyId: process.env.SB_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.SB_AWS_SECRET_ACCESS_KEY,
    }
});
const docClient = DynamoDBDocumentClient.from(client);

export const handler = async (event) => {
    const params = {
        TableName: 'securebase-users',
        FilterExpression: "#s = :status",
        ExpressionAttributeNames: { "#s": "status" },
        ExpressionAttributeValues: { ":status": "pro" }
    };

    try {
        const data = await docClient.send(new ScanCommand(params));
        
        return {
            statusCode: 200,
            headers: { 
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*" // Allows your frontend to call it
            },
            body: JSON.stringify({ 
                count: data.Count,
                users: data.Items 
            })
        };
    } catch (err) {
        console.error("Admin API Error:", err);
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
