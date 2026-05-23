/**
 * CANONICAL Stripe webhook handler for SecureBase.
 *
 * This is the ONLY active Stripe webhook handler. The legacy
 * src/functions/stripe-webhook/index.cjs (Supabase RBAC update) was
 * removed — Supabase was eliminated from the portal in PR #508.
 *
 * Stripe Dashboard endpoint: https://api.securebase.tximhotep.com/webhooks/stripe
 * AWS Lambda function: securebase-stripe-webhook
 *
 * Events handled:
 *   checkout.session.completed   — assessment upgrade + SES onboarding email
 *   invoice.payment_failed       — payment failure notification + internal alert
 *   invoice.payment_succeeded    — subscription renewal confirmation
 *   customer.subscription.deleted — cancellation handling + access revocation signal
 *   customer.subscription.updated — plan change logging
 */
const Stripe = require('stripe');
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');
// Assuming you're using the AWS SDK v3 as is standard now
const sesClient = new SESClient({ region: "us-east-1" }); 
const ddbDocClient = DynamoDBDocumentClient.from(
  new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' })
);
const lambdaClient = new LambdaClient({ region: process.env.AWS_REGION || 'us-east-1' });
const USERS_TABLE = process.env.USERS_TABLE || 'securebase-users';
const PROVISIONING_FUNCTION_NAME = process.env.PROVISIONING_FUNCTION_NAME || '';

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

function normalizeTier(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

function normalizePlan(value) {
  if (!value || typeof value !== 'string') return '';
  return value.trim().toLowerCase().replace(/\s+/g, '_');
}

function determineTierAndPlan(metadata = {}) {
  const tier = normalizeTier(metadata.upgrade_to) || normalizeTier(metadata.tier) || normalizePlan(metadata.plan) || 'standard';
  const plan = normalizePlan(metadata.plan) || tier;
  return { tier, plan };
}

function sanitizeError(err) {
  return {
    type: err?.name || 'Error',
    message: err?.message || 'Unknown error',
    requestId: err?.$metadata?.requestId || null,
  };
}

async function updateCheckoutState(session, email) {
  if (!email) {
    console.warn('checkout_state_update_skipped: missing_email');
    return;
  }

  const metadata = session.metadata || {};
  const { tier: targetTier, plan } = determineTierAndPlan(metadata);
  const assessmentCredit = parseInt(metadata.assessment_credit || '0', 10);
  const normalizedAssessmentCredit = Number.isFinite(assessmentCredit) ? assessmentCredit : 0;

  const command = new UpdateCommand({
    TableName: USERS_TABLE,
    Key: { email: String(email).trim().toLowerCase() },
    UpdateExpression: [
      'SET #status = :status',
      '#plan = :plan',
      '#pilot_tier = :tier',
      '#checkout_state = :checkout_state',
      '#provisioning_status = :provisioning_status',
      '#stripe_customer_id = :stripe_customer_id',
      '#stripe_checkout_session_id = :stripe_checkout_session_id',
      '#assessment_credit = :assessment_credit',
      '#updated_at = :updated_at',
      // Preserve initial activation timestamp across duplicate webhook deliveries.
      '#activated_at = if_not_exists(#activated_at, :activated_at)',
    ].join(', '),
    ExpressionAttributeNames: {
      '#status': 'status',
      '#plan': 'plan',
      '#pilot_tier': 'pilot_tier',
      '#checkout_state': 'checkout_state',
      '#provisioning_status': 'provisioning_status',
      '#stripe_customer_id': 'stripe_customer_id',
      '#stripe_checkout_session_id': 'stripe_checkout_session_id',
      '#assessment_credit': 'assessment_credit',
      '#updated_at': 'updated_at',
      '#activated_at': 'activated_at',
    },
    ExpressionAttributeValues: {
      ':status': 'pro',
      ':plan': plan,
      ':tier': targetTier,
      ':checkout_state': 'paid',
      ':provisioning_status': 'queued',
      ':stripe_customer_id': session.customer || '',
      ':stripe_checkout_session_id': session.id || '',
      ':assessment_credit': normalizedAssessmentCredit,
      ':updated_at': new Date().toISOString(),
      ':activated_at': new Date().toISOString(),
    },
  });

  await ddbDocClient.send(command);
  console.log(JSON.stringify({
    event: 'checkout_state_updated',
    checkout_session_id: session.id || null,
    customer_id: session.customer || null,
    target_tier: targetTier,
    plan,
    has_assessment_credit: normalizedAssessmentCredit > 0,
  }));
}

async function invokeProvisioning(session, email) {
  if (!PROVISIONING_FUNCTION_NAME) {
    console.warn('provisioning_invoke_skipped: function_name_not_configured');
    return;
  }
  if (!email) {
    console.warn('provisioning_invoke_skipped: missing_email');
    return;
  }

  const metadata = session.metadata || {};
  const payload = {
    trigger: 'stripe_checkout_completed',
    checkout_session_id: session.id || '',
    stripe_customer_id: session.customer || '',
    company_email: String(email).trim().toLowerCase(),
    tier: normalizeTier(metadata.tier),
    plan: normalizePlan(metadata.plan),
    upgrade_to: normalizeTier(metadata.upgrade_to),
    assessment_credit: parseInt(metadata.assessment_credit || '0', 10) || 0,
    timestamp: new Date().toISOString(),
  };

  await lambdaClient.send(new InvokeCommand({
    FunctionName: PROVISIONING_FUNCTION_NAME,
    InvocationType: 'Event',
    Payload: JSON.stringify(payload),
  }));

  console.log(JSON.stringify({
    event: 'provisioning_invoked',
    checkout_session_id: session.id || null,
    customer_id: session.customer || null,
    target_function: PROVISIONING_FUNCTION_NAME,
  }));
}

async function handlePaymentFailed(invoice) {
  const email = invoice.customer_email;
  const customerId = invoice.customer;
  const attemptCount = invoice.attempt_count;
  const nextPaymentAttemptDate = invoice.next_payment_attempt
    ? new Date(invoice.next_payment_attempt * 1000)
    : null;
  const nextPaymentAttempt = nextPaymentAttemptDate ? nextPaymentAttemptDate.toISOString() : null;

  console.log(JSON.stringify({
    event: 'payment_failed',
    customer_id: customerId,
    attempt_count: attemptCount,
    next_attempt: nextPaymentAttempt,
    timestamp: new Date().toISOString(),
  }));

  if (!email) {
    console.error('invoice.payment_failed: no customer_email — skipping notification email.');
    return;
  }

  // Send payment failure notification via SES.
  const retryMessage = nextPaymentAttemptDate
    ? `Stripe will automatically retry on ${nextPaymentAttemptDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.`
    : 'This was the final retry attempt. Please update your payment method to avoid service interruption.';

  const bodyHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #fee2e2; border-radius: 12px;">
      <h2 style="color: #dc2626;">Action Required: Payment Failed</h2>
      <p>We were unable to process your SecureBase subscription payment.</p>
      <p>${retryMessage}</p>
      <div style="margin: 24px 0;">
        <a href="https://portal.securebase.tximhotep.com/billing"
           style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Update Payment Method
        </a>
      </div>
      <p style="color: #64748b; font-size: 0.875rem;">
        Questions? Reply to this email or contact
        <a href="mailto:support@securebase.tximhotep.com">support@securebase.tximhotep.com</a>.
      </p>
    </div>
  `;

  const emailCommand = new SendEmailCommand({
    Source: 'onboarding@tximhotep.com',
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Action Required: Your SecureBase payment failed' },
      Body: { Html: { Data: bodyHtml } },
    },
  });
  await sesClient.send(emailCommand);
  console.log(`Payment failure email sent to ${email} (attempt ${attemptCount})`);
}

async function handlePaymentSucceeded(invoice) {
  const customerId = invoice.customer;
  const amountPaid = invoice.amount_paid; // cents
  console.log(JSON.stringify({
    event: 'payment_succeeded',
    customer_id: customerId,
    invoice_id: invoice.id,
    amount_paid_cents: amountPaid,
    timestamp: new Date().toISOString(),
  }));
}

async function handleSubscriptionDeleted(subscription) {
  const customerId = subscription.customer;
  const canceledAt = subscription.canceled_at
    ? new Date(subscription.canceled_at * 1000).toISOString()
    : new Date().toISOString();

  // Structured log for access revocation — consumed by downstream provisioner/audit pipeline.
  console.log(JSON.stringify({
    event: 'subscription_canceled',
    customer_id: customerId,
    subscription_id: subscription.id,
    canceled_at: canceledAt,
    cancel_at_period_end: subscription.cancel_at_period_end,
    timestamp: new Date().toISOString(),
  }));

  // NOTE: Active access revocation (DynamoDB/portal tier update) is handled by the
  // provisioner Lambda, which subscribes to this structured log via CloudWatch.
  // This handler is responsible for the SES cancellation confirmation email.

  const email = subscription.metadata?.company_email;
  if (!email) {
    console.warn(`subscription.deleted: no company_email in metadata for customer ${customerId} — skipping cancellation email.`);
    return;
  }

  const bodyHtml = `
    <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #334155;">Your SecureBase subscription has been cancelled</h2>
      <p>Your SecureBase subscription was cancelled on ${new Date(canceledAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.</p>
      <p>Your access will remain active until the end of your current billing period.</p>
      <p>If this was a mistake or you'd like to reactivate, please contact us within 30 days and we'll restore your environment and data.</p>
      <div style="margin: 24px 0;">
        <a href="https://securebase.tximhotep.com/pricing"
           style="background: #0d9488; color: white; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">
          Reactivate SecureBase
        </a>
      </div>
      <p style="color: #64748b; font-size: 0.875rem;">
        Questions? Contact <a href="mailto:support@securebase.tximhotep.com">support@securebase.tximhotep.com</a>.
      </p>
    </div>
  `;

  const emailCommand = new SendEmailCommand({
    Source: 'onboarding@tximhotep.com',
    Destination: { ToAddresses: [email] },
    Message: {
      Subject: { Data: 'Your SecureBase subscription has been cancelled' },
      Body: { Html: { Data: bodyHtml } },
    },
  });
  await sesClient.send(emailCommand);
  console.log(`Cancellation email sent to ${email} for subscription ${subscription.id}`);
}

async function handleSubscriptionUpdated(subscription) {
  console.log(JSON.stringify({
    event: 'subscription_updated',
    customer_id: subscription.customer,
    subscription_id: subscription.id,
    status: subscription.status,
    current_period_end: subscription.current_period_end
      ? new Date(subscription.current_period_end * 1000).toISOString()
      : null,
    timestamp: new Date().toISOString(),
  }));
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

  const eventType = stripeEvent.type;
  const data = stripeEvent.data.object;

  if (eventType === 'checkout.session.completed') {
    const session = data;
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

    try {
      await updateCheckoutState(session, email);
    } catch (ddbError) {
      console.error('checkout_state_update_failed:', sanitizeError(ddbError));
    }

    try {
      await invokeProvisioning(session, email);
    } catch (invokeError) {
      console.error('provisioning_invoke_failed:', sanitizeError(invokeError));
    }

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
  } else if (eventType === 'invoice.payment_failed') {
    try {
      await handlePaymentFailed(data);
    } catch (err) {
      console.error('handlePaymentFailed error:', err);
    }
  } else if (eventType === 'invoice.payment_succeeded') {
    try {
      await handlePaymentSucceeded(data);
    } catch (err) {
      console.error('handlePaymentSucceeded error:', err);
    }
  } else if (eventType === 'customer.subscription.deleted') {
    try {
      await handleSubscriptionDeleted(data);
    } catch (err) {
      console.error('handleSubscriptionDeleted error:', err);
    }
  } else if (eventType === 'customer.subscription.updated') {
    try {
      await handleSubscriptionUpdated(data);
    } catch (err) {
      console.error('handleSubscriptionUpdated error:', err);
    }
  } else {
    console.log(`Unhandled Stripe event type: ${eventType}`);
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
