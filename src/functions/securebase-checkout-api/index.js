import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
    // 1. Handle Preflight CORS (Required for browser-based fetch)
    if (event.httpMethod === "OPTIONS") {
        return {
            statusCode: 200,
            headers: {
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Headers": "Content-Type",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
            },
            body: "",
        };
    }

    try {
        const body = JSON.parse(event.body);
        
        // 2. Strict Validation
        if (!body.customer_email || !body.price_id) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ error: "Missing customer_email or price_id" }) 
            };
        }

        // 3. Create the Stripe Session
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: body.price_id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            // Uses dynamic metadata and description for user confidence
            subscription_data: {
                description: `SecureBase ${body.plan_name || 'Pilot'} - Audit-Ready Infrastructure`,
                metadata: {
                    plan: body.plan_name || 'Pilot',
                    customer_email: body.customer_email
                }
            },
            // Directs back to your production routes
            success_url: 'https://tximhotep.com/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://tximhotep.com/pricing?canceled=true',
            customer_email: body.customer_email,
        });

        // 4. Return the URL for redirect
        return {
            statusCode: 200,
            headers: { 
                "Access-Control-Allow-Origin": "*",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ 
                checkout_url: session.url, 
                session_id: session.id 
            })
        };
    } catch (err) {
        console.error("Stripe Error:", err.message);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: err.message }) 
        };
    }
};
