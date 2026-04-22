// api/create-checkout-session.js (or .ts)
// This is your backend API route

import Stripe from 'stripe';

// Initialize Stripe with your secret key
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { priceId, plan } = req.body;

    // Validate the price ID
    if (!priceId) {
      return res.status(400).json({ error: 'Price ID is required' });
    }

    // Verify this is the correct price ID for SecureBase Standard
    const validPriceId = 'price_1SrgqW5bg6XXXrmNzkk8O5E5';
    
    if (priceId !== validPriceId) {
      console.warn(`Warning: Unexpected price ID: ${priceId}`);
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId, // price_1SrgqW5bg6XXXrmNzkk8O5E5
          quantity: 1,
        },
      ],
      success_url: `${process.env.NEXT_PUBLIC_BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL}/pricing`,
      metadata: {
        plan: plan || 'standard',
      },
      // Optional: Add customer email pre-fill
      // customer_email: userEmail,
    });

    console.log('✅ Checkout session created:', session.id);

    return res.status(200).json({
      url: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('❌ Stripe checkout error:', error);
    
    return res.status(500).json({ 
      error: error.message || 'Failed to create checkout session'
    });
  }
}
