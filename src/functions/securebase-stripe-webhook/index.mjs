import Stripe from 'stripe';
const AWS = require('aws-sdk');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const docClient = new AWS.DynamoDB.DocumentClient();

export const handler = async (event) => {
    const sig = event.headers['Stripe-Signature'];
    let stripeEvent;

    try {
        // Verification using the Prod Secret we just reverted in Secrets Manager
        stripeEvent = stripe.webhooks.constructEvent(event.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return { statusCode: 400, body: `Webhook Error: ${err.message}` };
    }

    if (stripeEvent.type === 'checkout.session.completed') {
        const session = stripeEvent.data.object;

        // FULFILLMENT: Update DynamoDB status to 'pro'
        const params = {
            TableName: 'securebase-users', // Replace with your actual table name
            Key: { email: session.customer_email },
            UpdateExpression: "set #s = :status, #p = :priceId",
            ExpressionAttributeNames: { "#s": "status", "#p": "priceId" },
            ExpressionAttributeValues: {
                ":status": "pro",
                ":priceId": session.line_items?.[0]?.price?.id || 'subscription_active'
            }
        };

        await docClient.update(params).promise();
        console.log(`Successfully upgraded user: ${session.customer_email}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
