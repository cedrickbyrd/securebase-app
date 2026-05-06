const Stripe = require('stripe');
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
// Assuming you're using the AWS SDK v3 as is standard now
const sesClient = new SESClient({ region: "us-east-1" }); 

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

/**
 * Config table that drives auto-enrollment for each assessment SKU.
 * Adding support for a new SKU requires only a new entry here plus the matching
 * ASSESSMENT_UPGRADES entry in the checkout API and the env var it references.
 *
 * Each entry must contain:
 *   subscriptionPriceEnvVar {string} — env var name holding the Stripe subscription Price ID
 *   creditDescription       {string} — description stamped on the Stripe balance transaction
 *   source                  {string} — value for the subscription's metadata.source field
 *   displayTier             {string} — human-readable tier name used in logs and emails
 *   displayPilotPrice       {string} — pilot price string for informational use
 *   emailSubject            {string} — SES email subject line
 *   emailIntro              {string} — HTML opening sentence (may include <strong>)
 *   emailSteps              {string[]} — ordered list items explaining what happens next
 *   ctaLabel                {string} — label for the "Access portal" CTA button
 */
const UPGRADE_CONFIG = {
  pilot_compliance: {
    subscriptionPriceEnvVar: 'STRIPE_PRICE_FINTECH',
    creditDescription: 'Compliance Jumpstart credit toward Fintech subscription',
    source: 'pilot_compliance_upgrade',
    displayTier: 'Fintech',
    displayPilotPrice: '$4,000/mo pilot',
    emailSubject: 'Welcome to SecureBase — Your Compliance Jumpstart + Fintech Tier Enrollment',
    emailIntro: 'Your <strong>Compliance Jumpstart</strong> payment has been received.',
    emailSteps: [
      'Your SOC 2-ready Terraform modules and Compliance Matrix PDF are available in the portal.',
      'You have been automatically enrolled in the <strong>Fintech tier</strong> ($4,000/mo pilot) with a <strong>30-day free trial</strong> — no billing until your pilot period is complete.',
      'Your $495 pilot fee has been applied as a credit toward your first Fintech invoice.',
    ],
    ctaLabel: 'Access Your Compliance Dashboard',
  },
  hipaa_assessment: {
    subscriptionPriceEnvVar: 'STRIPE_PRICE_HEALTHCARE',
    creditDescription: 'HIPAA Readiness Assessment credit toward Healthcare subscription',
    source: 'hipaa_assessment_upgrade',
    displayTier: 'Healthcare',
    displayPilotPrice: '$7,500/mo pilot',
    emailSubject: 'Welcome to SecureBase — Your HIPAA Readiness Assessment + Healthcare Enrollment',
    emailIntro: 'Your <strong>HIPAA Readiness Assessment</strong> payment has been received.',
    emailSteps: [
      'Your scored §164.308/310/312 findings dashboard is available now in the portal.',
      'You have been automatically enrolled in the <strong>Healthcare tier</strong> ($7,500/mo pilot) with a <strong>30-day free trial</strong> — no billing until your assessment period is complete.',
      'Your $1,995 assessment fee has been applied as a credit toward your first Healthcare invoice.',
    ],
    ctaLabel: 'Access Your HIPAA Dashboard',
  },
};

/**
 * Handle auto-enrollment for assessment SKUs.
 *
 * @param {object} session        - Stripe Checkout Session object from the webhook event.
 * @param {object} config         - Entry from UPGRADE_CONFIG for the session's tier.
 * @param {string|undefined} pilotCouponId - Stripe coupon ID to apply (50% off pilot), or falsy to skip.
 *
 * Steps:
 *   1. Apply the assessment fee as a negative Stripe customer balance credit so Stripe
 *      automatically deducts it from the first real invoice when the trial ends.
 *   2. Create the target subscription with a 30-day trial and the pilot coupon.
 *
 * The credit is applied *before* the subscription is created so that if
 * createBalanceTransaction throws, the outer catch block prevents the subscription
 * from being created in an uncredited state.
 */
async function handleAssessmentUpgrade(session, config, pilotCouponId) {
  const customerId = session.customer;
  const subscriptionPriceId = process.env[config.subscriptionPriceEnvVar];
  const assessmentCreditCents = parseInt(session.metadata?.assessment_credit || '0', 10) * 100;

  if (!customerId) {
    console.error(`${session.metadata?.tier} completed but session.customer is missing — cannot create ${config.displayTier} subscription.`);
    return;
  }
  if (!subscriptionPriceId) {
    console.error(`${config.subscriptionPriceEnvVar} env var not set — cannot create deferred ${config.displayTier} subscription.`);
    return;
  }

  // Apply credit first; if it fails the outer catch prevents the subscription
  // from being created in an uncredited state.
  if (assessmentCreditCents > 0) {
    await stripe.customers.createBalanceTransaction(customerId, {
      amount: -assessmentCreditCents,
      currency: 'usd',
      description: config.creditDescription,
    });
    console.log(`Applied -$${assessmentCreditCents / 100} balance credit to customer ${customerId}`);
  }

  // Create the subscription with a 30-day trial so billing is deferred.
  const subParams = {
    customer: customerId,
    items: [{ price: subscriptionPriceId }],
    trial_period_days: 30,
    metadata: {
      source: config.source,
      assessment_session_id: session.id,
    },
  };
  // Apply the pilot coupon (50% off) if configured.
  if (pilotCouponId) {
    subParams.coupon = pilotCouponId;
  }
  const subscription = await stripe.subscriptions.create(subParams);
  console.log(`${config.displayTier} subscription ${subscription.id} created for customer ${customerId} (trial ends ${new Date(subscription.trial_end * 1000).toISOString()})`);
}

/**
 * Build the onboarding email HTML body for assessment SKU purchasers.
 *
 * @param {object} config - Entry from UPGRADE_CONFIG. Must include:
 *   emailIntro  {string}   — HTML opening sentence
 *   emailSteps  {string[]} — ordered list items (HTML allowed)
 *   ctaLabel    {string}   — text for the "Access portal" button
 * @returns {string} HTML string for the email body.
 */
function buildAssessmentEmail(config) {
  const steps = config.emailSteps
    .map((s) => `<li>${s}</li>`)
    .join('\n              ');
  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #0d9488;">Welcome to SecureBase!</h2>
      <p>${config.emailIntro}</p>
      <p>Here's what happens next:</p>
      <ol style="padding-left: 1.25rem; line-height: 1.8;">
        ${steps}
      </ol>
      <div style="margin: 30px 0;">
        <a href="https://tximhotep.com/compliance"
           style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
           ${config.ctaLabel}
        </a>
      </div>
      <p style="color: #64748b; font-size: 0.875rem;">Questions? Reply to this email or contact <a href="mailto:sales@securebase.tximhotep.com">sales@securebase.tximhotep.com</a>.</p>
    </div>
  `;
}

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
    const upgradeConfig = UPGRADE_CONFIG[tier];

    // Support both env var naming conventions used across the codebase.
    const pilotCouponId = process.env.STRIPE_PILOT_COUPON || process.env.STRIPE_PILOT_COUPON_ID;

    // Assessment SKUs: auto-enroll in the target subscription tier with deferred billing.
    if (upgradeConfig && session.metadata?.upgrade_to) {
      try {
        await handleAssessmentUpgrade(session, upgradeConfig, pilotCouponId);
      } catch (stripeError) {
        console.error(`Failed to create deferred ${upgradeConfig.displayTier} subscription:`, stripeError);
      }
    }

    // 1. YOUR EXISTING LOGIC: Update DynamoDB to "pro"
    // await updateDynamoDB(email, "pro"); 

    // 2. NEW AUTOMATION: Trigger the SES Welcome Email
    if (!email) {
      console.error('checkout.session.completed: no email found in metadata or customer_details — skipping onboarding email.');
    } else {
      try {
        const subject = upgradeConfig
          ? upgradeConfig.emailSubject
          : `Welcome to SecureBase - Your ${plan} Onboarding`;

        const bodyHtml = upgradeConfig
          ? buildAssessmentEmail(upgradeConfig)
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
