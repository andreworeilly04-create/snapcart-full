require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// ======================
// ENV CHECK
// ======================
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ Missing STRIPE_SECRET_KEY");
    process.exit(1);
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
    process.exit(1);
}

const CLIENT_URL = process.env.CLIENT_URL || "https://snapcart-store.vercel.app";

// ======================
// FIREBASE INIT
// ======================
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// ======================
// MIDDLEWARE
// ======================
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || origin.includes('localhost') || origin.includes('vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json());


// ======================
// HEALTH CHECK
// ======================
app.get('/', (req, res) => {
    res.send('Server running');
});


// ======================
// STRIPE CHECKOUT (CLEAN + SAFE)
// ======================
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items, userId, address } = req.body;

        console.log("🧾 Incoming request:", req.body);

        // 🔴 VALIDATION 1
        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Cart is empty or invalid" });
        }

        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        if (!address) {
            return res.status(400).json({ error: "Missing address" });
        }

        // 🔴 CLEAN ITEMS (VERY IMPORTANT)
        const line_items = items.map((item, index) => {
            const price = Number(item.price);
            const quantity = Number(item.quantity);

            console.log(`🔍 ITEM ${index}:`, item);

            if (!price || price <= 0 || isNaN(price)) {
                throw new Error(`Invalid price at item ${index}`);
            }

            if (!quantity || quantity <= 0 || isNaN(quantity)) {
                throw new Error(`Invalid quantity at item ${index}`);
            }

            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name || `Product ${index + 1}`
                    },
                    unit_amount: Math.round(price * 100),
                },
                quantity
            };
        });

        // 🔥 CREATE STRIPE SESSION
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',

            line_items,

            success_url: `${CLIENT_URL}/orders`,
            cancel_url: `${CLIENT_URL}/checkout`,

            metadata: {
                userId: String(userId),
                address: JSON.stringify(address),
                items: JSON.stringify(items)
            }
        });

        console.log("✅ Stripe session created:", session.id);

        return res.json({ url: session.url });

    } catch (error) {
        console.error("❌ Stripe error:", error.message);
        return res.status(500).json({ error: error.message });
    }
});


// ======================
// WEBHOOK (ORDER CREATION ONLY HERE)
// ======================
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error("❌ Webhook error:", err.message);
        return res.status(400).send("Webhook Error");
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            console.log("🔥 PAYMENT SUCCESS:", session.id);

            // prevent duplicates
            const existing = await db.collection('orders')
                .where('stripeSessionId', '==', session.id)
                .limit(1)
                .get();

            if (!existing.empty) {
                console.log("⚠️ Duplicate order skipped");
                return res.json({ received: true });
            }

            let items = [];
            let address = {};

            try {
                items = JSON.parse(session.metadata?.items || '[]');
                address = JSON.parse(session.metadata?.address || '{}');
            } catch (e) {
                console.error("❌ Metadata parse error:", e.message);
            }

            const userId = session.metadata?.userId || "guest";

            await db.collection('orders').add({
                userId,
                items,
                address,
                amount: session.amount_total ? session.amount_total / 100 : 0,
                status: 'Paid',
                paymentMethod: 'stripe',
                stripeSessionId: session.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ ORDER SAVED");
        }

        res.json({ received: true });

    } catch (error) {
        console.error("❌ Webhook crash:", error);
        res.status(500).send("Webhook failed");
    }
});


// ======================
// COD ORDER
// ======================
app.post('/create-cod-order', async (req, res) => {
    try {
        const { items, userId, address } = req.body;

        if (!items || !userId || !address) {
            return res.status(400).json({ error: "Missing fields" });
        }

        const total = items.reduce((sum, item) =>
            sum + Number(item.price) * Number(item.quantity), 0
        );

        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            amount: total,
            status: 'COD',
            paymentMethod: 'COD',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        return res.status(201).json({
            success: true,
            orderId: orderRef.id
        });

    } catch (error) {
        console.error("❌ COD error:", error.message);
        return res.status(500).json({ error: error.message });
    }
});


// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;