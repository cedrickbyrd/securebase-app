import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const handler = async (event) => {
    // Handle CORS preflight
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
        
        // Ensure both required fields exist
        if (!body.customer_email || !body.price_id) {
            return { 
                statusCode: 400, 
                body: JSON.stringify({ 
                    error: "Missing customer_email or price_id",
                    received: { email: !!body.customer_email, price: !!body.price_id }
                }) 
            };
        }

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price: body.price_id,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            // Updated to use the primary production domain
            success_url: 'https://tximhotep.com/success?session_id={CHECKOUT_SESSION_ID}',
            cancel_url: 'https://tximhotep.com/pricing',
            customer_email: body.customer_email,
            metadata: {
                customer_name: body.customer_name || 'Pilot Prospect',
                project: 'SecureBase'
            }
        });

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
        console.error("Stripe Session Error:", err.message);
        return { 
            statusCode: 500, 
            body: JSON.stringify({ error: err.message }) 
        };
    }
};
