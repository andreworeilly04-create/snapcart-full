require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const app = express();

// ======================
// ENV FIX (IMPORTANT)
// ======================
const CLIENT_URL =
    process.env.CLIENT_URL ||
    "https://snapcart-store.vercel.app"; // fallback so Stripe never breaks

if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ Missing STRIPE_SECRET_KEY");
    process.exit(1);
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
    process.exit(1);
}

// ======================
// FIREBASE INIT
// ======================
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

// ======================
// CORS
// ======================
app.use(cors({
    origin: true,
    credentials: true
}));

// ======================
// IMPORTANT: BODY PARSERS
// ======================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ======================
// HEALTH CHECK
// ======================
app.get('/', (req, res) => {
    res.send('Server running');
});

// ======================
// STRIPE WEBHOOK (RAW BODY)
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

    console.log("🔥 EVENT:", event.type);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
            console.log("🧾 SESSION:", session.id);

            // prevent duplicates
            const existing = await db.collection('orders')
                .where('stripeSessionId', '==', session.id)
                .get();

            if (!existing.empty) {
                console.log("⚠️ Duplicate order ignored");
                return res.json({ received: true });
            }

            // ======================
            // SAFE ORDER CREATION
            // ======================
            const order = {
                userId: session.metadata?.userId || "guest",
                amount: session.amount_total / 100,
                status: "Paid",
                paymentMethod: "Stripe",
                stripeSessionId: session.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('orders').add(order);

            console.log("✅ ORDER SAVED");

        } catch (err) {
            console.error("❌ Order save error:", err);
        }
    }

    res.json({ received: true });
});

// ======================
// STRIPE CHECKOUT SESSION
// ======================
app.post('/create-checkout-session', async (req, res) => {

    try {
        const { items, userId, address } = req.body;

        console.log("🧾 REQUEST:", req.body);

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Cart empty" });
        }

        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        // ======================
        // FIX: Stripe metadata limit (500 chars)
        // 👉 DO NOT send full cart
        // ======================
        const line_items = items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name
                },
                unit_amount: Math.round(item.price * 100),
            },
            quantity: item.quantity
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',

            line_items,

            success_url: `${CLIENT_URL}/orders`,
            cancel_url: `${CLIENT_URL}/checkout`,

            // ONLY SAFE DATA HERE
            metadata: {
                userId: String(userId)
            }
        });

        console.log("✅ STRIPE SESSION:", session.id);

        res.json({ url: session.url });

    } catch (error) {
        console.error("❌ STRIPE ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});

// ======================
// COD ORDER
// ======================
app.post('/create-cod-order', async (req, res) => {

    try {
        const { items, userId, address } = req.body;

        if (!items || !userId) {
            return res.status(400).json({ error: "Missing fields" });
        }

        const total = items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const doc = await db.collection('orders').add({
            userId,
            items,
            address,
            amount: total,
            status: "COD",
            paymentMethod: "COD",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ COD ORDER SAVED:", doc.id);

        res.json({ success: true, orderId: doc.id });

    } catch (err) {
        console.error("❌ COD ERROR:", err);
        res.status(500).json({ error: err.message });
    }
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
    console.log("🚀 Server running on port", PORT);
});

module.exports = app;