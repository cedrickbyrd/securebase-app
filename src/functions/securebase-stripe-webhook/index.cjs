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
    const email = session.metadata?.company_email || session.customer_details.email;
    const plan = session.metadata?.plan || "Pro";
    // 1. YOUR EXISTING LOGIC: Update DynamoDB to "pro"
    // await updateDynamoDB(email, "pro"); 

    // 2. NEW AUTOMATION: Trigger the SES Welcome Email
    try {
      const emailCommand = new SendEmailCommand({
        Source: "onboarding@tximhotep.com",
        Destination: { ToAddresses: [email] },
        Message: {
          Subject: { Data: `Welcome to SecureBase - Your ${plan} Onboarding` },
          Body: {
            Html: {
              Data: `
                <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
                  <h2 style="color: #2563eb;">Welcome to SecureBase!</h2>
                  <p>We've successfully initiated your <strong>${plan}</strong> pilot.</p>
                  <p>Our team is now provisioning your dedicated AWS Landing Zone. You can track the real-time compliance status of your infrastructure here:</p>
                  <div style="margin: 30px 0;">
                    <a href="https://tximhotep.com/compliance" 
                       style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                       Access SecureBase Portal
                    </a>
                  </div>
                  <p style="color: #64748b; font-size: 0.875rem;">Run ID for your initial baseline: <strong>${session.id.slice(-8)}</strong></p>
                </div>
              `
            }
          }
        }
      });
      await sesClient.send(emailCommand);
      console.log(`Onboarding email sent to ${email} for ${plan}`);
    } catch (sesError) {
      console.error("SES Error:", sesError);
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
