require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

const app = express();

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
// 🔥 IMPORTANT FIX (MUST BE HERE)
// ======================
// This fixes: req.body undefined
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ======================
// HEALTH CHECK
// ======================
app.get('/', (req, res) => {
    res.send('Server running');
});


// ======================
// STRIPE WEBHOOK (MUST USE RAW BODY)
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

    console.log("🔥 WEBHOOK EVENT:", event.type);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        try {
            console.log("🧾 SESSION ID:", session.id);

            const existing = await db.collection('orders')
                .where('stripeSessionId', '==', session.id)
                .get();

            if (!existing.empty) {
                console.log("⚠️ Duplicate order skipped");
                return res.json({ received: true });
            }

            const order = {
                userId: session.metadata.userId,
                amount: session.amount_total / 100,
                status: "Paid",
                paymentMethod: "stripe",
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

        console.log("🧾 REQUEST BODY:", req.body);

        if (!items || !items.length) {
            return res.status(400).json({ error: "Cart empty" });
        }

        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

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

            success_url: `${process.env.CLIENT_URL}/orders`,
            cancel_url: `${process.env.CLIENT_URL}/checkout`,

            metadata: {
                userId: String(userId)
            }
        });

        console.log("✅ STRIPE SESSION CREATED:", session.id);

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

        const total = items.reduce((sum, item) =>
            sum + item.price * item.quantity, 0);

        const doc = await db.collection('orders').add({
            userId,
            items,
            address,
            amount: total,
            status: "COD",
            paymentMethod: "COD",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true, orderId: doc.id });

    } catch (err) {
        console.error(err);
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