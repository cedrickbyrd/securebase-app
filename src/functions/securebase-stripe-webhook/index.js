import Stripe from 'stripe';
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const client = new DynamoDBClient({
    region: process.env.SB_AWS_REGION,
    credentials: {
        accessKeyId: process.env.SB_AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.SB_AWS_SECRET_ACCESS_KEY,
    }
});
const docClient = DynamoDBDocumentClient.from(client);

// Slack Helper Function
async function sendSlackNotification(session) {
    const slackUrl = process.env.SLACK_WEBHOOK_URL;
    if (!slackUrl) return;

    const amount = (session.amount_total / 100).toFixed(2);
    const email = session.customer_details?.email || session.customer_email;

    const payload = {
        text: `💰 *New SecureBase Sale!*`,
        attachments: [{
            color: "#36a64f",
            fields: [
                { title: "Customer", value: email, short: true },
                { title: "Amount", value: `$${amount}`, short: true },
                { title: "Status", value: "Provisioning AWS Environment", short: false }
            ]
        }]
    };

    await fetch(slackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
}

export const handler = async (event) => {
    const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
    let stripeEvent;

    try {
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;
        const customerEmail = session.customer_details?.email || session.customer_email;

        // 1. Update DynamoDB
        const command = new UpdateCommand({
            TableName: 'securebase-users',
            Key: { email: customerEmail },
            UpdateExpression: "set #s = :status, #p = :priceId",
            ExpressionAttributeNames: { "#s": "status", "#p": "priceId" },
            ExpressionAttributeValues: {
                ":status": "pro",
                ":priceId": session.metadata?.plan_name || 'pilot_v1'
            }
        });

        try {
            await docClient.send(command);
            // 2. Trigger Slack Notification
            await sendSlackNotification(session);
            console.log(`🚀 Automated fulfillment complete for: ${customerEmail}`);
        } catch (err) {
            console.error('Fulfillment Error:', err);
        }
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
