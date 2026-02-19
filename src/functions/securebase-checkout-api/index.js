import Stripe from 'stripe';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
    try {
        const body = JSON.parse(event.body);
        
        // Validation for the data we just verified
        if (!body.customer_email || !body.price_id) {
            return { statusCode: 400, body: JSON.stringify({ error: "Missing customer_email or price_id" }) };
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [{ price: body.price_id, quantity: 1 }],
            mode: 'subscription',
            // FIX: Updated to your production Netlify domain
            success_url: 'https://securebase-app.netlify.app/dashboard?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://securebase-app.netlify.app/pricing',
            customer_email: body.customer_email,
            metadata: {
                customer_name: body.customer_name || 'Customer'
            }
        });

        return {
            statusCode: 200,
            headers: { "Access-Control-Allow-Origin": "*" }, // Ensure CORS is open for Netlify
            body: JSON.stringify({ checkout_url: session.url, session_id: session.id })
        };
    } catch (err) {
        return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
    }
};
