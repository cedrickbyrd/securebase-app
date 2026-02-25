const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SB_SUPABASE_SERVICE_ROLE_KEY
);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // 1. Verify the webhook came from Stripe
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // 2. Handle the checkout.session.completed event
  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object;
    const userEmail = session.customer_details.email;

    // 3. Promote the user to 'editor'
    const { error } = await supabase
      .from('profiles')
      .update({ role: 'editor' })
      .eq('email', userEmail);

    // 4. Log the conversion in the Activity Feed for SOC 2
    await supabase.from('activity_feed').insert([{
      action_type: 'SUBSCRIPTION_ACTIVATED',
      metadata: { email: userEmail, session_id: session.id }
    }]);

    if (error) {
      console.error('RBAC Update Failed:', error);
      return { statusCode: 500, body: 'Database update failed' };
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) };
};
