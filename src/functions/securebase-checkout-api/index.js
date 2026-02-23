const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  // 1. Logic Guard
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method Not Allowed' }) };
  }

  try {
    const { customer_email, price_id, plan_name } = JSON.parse(event.body);

    // 2. Create Stripe Session
    const session = await stripe.checkout.sessions.create({
      customer_email: customer_email,
      payment_method_types: ['card'],
      line_items: [{
        price: price_id,
        quantity: 1,
      }],
      mode: 'subscription',
      // Metadata is key for your "White-Glove" automation
      metadata: {
        plan: plan_name,
        company_email: customer_email,
        provisioning_status: 'queued' 
      },
      success_url: `${process.env.URL}/?session_id={CHECKOUT_SESSION_ID}&tab=success`,
      cancel_url: `${process.env.URL}/?tab=pricing`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ checkout_url: session.url }),
    };
  } catch (error) {
    console.error('Stripe Session Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};
