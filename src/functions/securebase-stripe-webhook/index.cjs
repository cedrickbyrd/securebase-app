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
    const email = session.metadata?.company_email || session.customer_details?.email;
    const plan = session.metadata?.plan || "Pro";
    const tier = session.metadata?.tier;

    // hipaa_assessment: auto-enroll the customer in the Healthcare tier with
    // deferred billing (30-day trial) and credit the $1,995 assessment fee
    // against their first Healthcare invoice via a Stripe customer balance.
    if (tier === 'hipaa_assessment' && session.metadata?.upgrade_to === 'healthcare') {
      const customerId = session.customer;
      const healthcarePriceId = process.env.STRIPE_PRICE_HEALTHCARE;
      // Support both env var naming conventions used across the codebase.
      const pilotCouponId = process.env.STRIPE_PILOT_COUPON || process.env.STRIPE_PILOT_COUPON_ID;
      const assessmentCreditCents = parseInt(session.metadata?.assessment_credit || '0', 10) * 100;

      if (!customerId) {
        console.error('hipaa_assessment completed but session.customer is missing — cannot create Healthcare subscription.');
      } else if (!healthcarePriceId) {
        console.error('STRIPE_PRICE_HEALTHCARE env var not set — cannot create deferred Healthcare subscription.');
      } else {
        try {
          // Apply $1,995 as a negative balance credit first.  Stripe automatically
          // applies it to the first invoice when the trial ends.  The subscription
          // is only created after the credit is confirmed so the state stays consistent.
          if (assessmentCreditCents > 0) {
            await stripe.customers.createBalanceTransaction(customerId, {
              amount: -assessmentCreditCents,
              currency: 'usd',
              description: 'HIPAA Readiness Assessment credit toward Healthcare subscription',
            });
            console.log(`Applied -$${assessmentCreditCents / 100} balance credit to customer ${customerId}`);
          }

          // Create Healthcare subscription with a 30-day trial so billing is
          // deferred while the assessment is delivered.
          const subParams = {
            customer: customerId,
            items: [{ price: healthcarePriceId }],
            trial_period_days: 30,
            metadata: {
              source: 'hipaa_assessment_upgrade',
              assessment_session_id: session.id,
            },
          };
          // Apply the pilot coupon (50% off → $7,500/mo) if available.
          if (pilotCouponId) {
            subParams.coupon = pilotCouponId;
          }
          const subscription = await stripe.subscriptions.create(subParams);
          console.log(`Healthcare subscription ${subscription.id} created for customer ${customerId} (trial ends ${new Date(subscription.trial_end * 1000).toISOString()})`);
        } catch (stripeError) {
          console.error('Failed to create deferred Healthcare subscription:', stripeError);
        }
      }
    }

    // 1. YOUR EXISTING LOGIC: Update DynamoDB to "pro"
    // await updateDynamoDB(email, "pro"); 

    // 2. NEW AUTOMATION: Trigger the SES Welcome Email
    if (!email) {
      console.error('checkout.session.completed: no email found in metadata or customer_details — skipping onboarding email.');
    } else {
      try {
        // Tailor the subject and body for hipaa_assessment purchasers.
        const isHipaaAssessment = tier === 'hipaa_assessment';
        const subject = isHipaaAssessment
          ? 'Welcome to SecureBase — Your HIPAA Readiness Assessment + Healthcare Enrollment'
          : `Welcome to SecureBase - Your ${plan} Onboarding`;
        const bodyHtml = isHipaaAssessment
          ? `
            <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
              <h2 style="color: #0d9488;">Welcome to SecureBase!</h2>
              <p>Your <strong>HIPAA Readiness Assessment</strong> payment has been received.</p>
              <p>Here's what happens next:</p>
              <ol style="padding-left: 1.25rem; line-height: 1.8;">
                <li>Your scored §164.308/310/312 findings dashboard is available now in the portal.</li>
                <li>You have been automatically enrolled in the <strong>Healthcare tier</strong> ($7,500/mo pilot) with a <strong>30-day free trial</strong> — no billing until your assessment period is complete.</li>
                <li>Your $1,995 assessment fee has been applied as a credit toward your first Healthcare invoice.</li>
              </ol>
              <div style="margin: 30px 0;">
                <a href="https://tximhotep.com/compliance"
                   style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
                   Access Your HIPAA Dashboard
                </a>
              </div>
              <p style="color: #64748b; font-size: 0.875rem;">Questions? Reply to this email or contact <a href="mailto:sales@securebase.tximhotep.com">sales@securebase.tximhotep.com</a>.</p>
            </div>
          `
          : `
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
          `;

        const emailCommand = new SendEmailCommand({
          Source: "onboarding@tximhotep.com",
          Destination: { ToAddresses: [email] },
          Message: {
            Subject: { Data: subject },
            Body: { Html: { Data: bodyHtml } },
          },
        });
        await sesClient.send(emailCommand);
        console.log(`Onboarding email sent to ${email} for tier=${tier}`);
      } catch (sesError) {
        console.error("SES Error:", sesError);
      }
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
