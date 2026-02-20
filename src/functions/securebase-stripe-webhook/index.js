const Stripe = require('stripe');
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
// Assuming you're using the AWS SDK v3 as is standard now
const sesClient = new SESClient({ region: "us-east-1" }); 

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event, context) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const email = session.customer_details.email;

    // 1. YOUR EXISTING LOGIC: Update DynamoDB to "pro"
    // await updateDynamoDB(email, "pro"); 

    // 2. NEW AUTOMATION: Trigger the SES Welcome Email
    try {
      const emailCommand = new SendEmailCommand({
        Source: "onboarding@tximhotep.com",
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: "Welcome to SecureBase - Your Pilot Onboarding" },
          Body: {
            Html: {
              Data: `
                <h2>Welcome to SecureBase!</h2>
                <p>We've successfully upgraded your account to <strong>Pro</strong>.</p>
                <p>To begin your automated onboarding, please follow the steps in your dashboard:</p>
                <a href="https://demo.securebase.tximhotep.com">Access SecureBase Portal</a>
              `
            }
          }
        }
      });
      await sesClient.send(emailCommand);
      console.log(`Onboarding email sent to ${email}`);
    } catch (sesError) {
      console.error("SES Error:", sesError);
      // We don't want to fail the whole webhook if just the email fails
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
