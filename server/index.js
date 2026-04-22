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

const CLIENT_URL =
    process.env.CLIENT_URL || "https://snapcart-store.vercel.app";

// ======================
// CORS
// ======================
app.use(cors({
    origin: true,
    credentials: true
}));

// ======================
// JSON BODY PARSER
// ======================
app.use(express.json());

// ======================
// HEALTH CHECK
// ======================
app.get('/', (req, res) => {
    res.send('Server running');
});


// ======================================================
// 💳 CREATE STRIPE SESSION (ORDER = PENDING)
// ======================================================
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items, userId, address } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Cart empty" });
        }

        if (!userId) {
            return res.status(400).json({ error: "Missing userId" });
        }

        // ✅ FIX NAN ISSUES
        const cleanItems = items.map(item => ({
            name: item.name || "Product",
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1,
            image: item.image || ""
        }));

        // ✅ TOTAL
        const total = cleanItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        console.log("💰 TOTAL:", total);

        // ======================
        // CREATE ORDER FIRST (PENDING)
        // ======================
        const orderRef = await db.collection('orders').add({
            userId,
            items: cleanItems,
            address,
            amount: total,
            status: "Pending Payment",
            paymentMethod: "Stripe",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("🟡 ORDER CREATED:", orderRef.id);

        // ======================
        // STRIPE SESSION
        // ======================
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',

            line_items: cleanItems.map(item => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name,
                        images: item.image ? [item.image] : []
                    },
                    unit_amount: Math.round(item.price * 100),
                },
                quantity: item.quantity
            })),

            success_url: `${CLIENT_URL}/orders`,
            cancel_url: `${CLIENT_URL}/checkout`,

            // IMPORTANT
            metadata: {
                orderId: orderRef.id
            }
        });

        res.json({ url: session.url });

    } catch (error) {
        console.error("❌ STRIPE ERROR:", error.message);
        res.status(500).json({ error: error.message });
    }
});


// ======================================================
// 🔥 STRIPE WEBHOOK (MARK ORDER AS PAID)
// ======================================================
app.post(
    '/webhook',
    express.raw({ type: 'application/json' }),
    async (req, res) => {

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

        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            const orderId = session.metadata?.orderId;

            if (!orderId) {
                console.log("❌ Missing orderId");
                return res.json({ received: true });
            }

            try {
                await db.collection('orders').doc(orderId).update({
                    status: "Paid",
                    stripeSessionId: session.id,
                    paidAt: admin.firestore.FieldValue.serverTimestamp(),
                    amount: (session.amount_total || 0) / 100
                });

                console.log("✅ ORDER MARKED PAID:", orderId);

            } catch (err) {
                console.error("❌ UPDATE ERROR:", err);
            }
        }

        res.json({ received: true });
    }
);


// ======================================================
// 💵 COD ORDER (UNCHANGED)
// ======================================================
app.post('/create-cod-order', async (req, res) => {
    try {
        const { items, userId, address } = req.body;

        const cleanItems = items.map(item => ({
            name: item.name || "Product",
            price: Number(item.price) || 0,
            quantity: Number(item.quantity) || 1
        }));

        const total = cleanItems.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
        );

        const doc = await db.collection('orders').add({
            userId,
            items: cleanItems,
            address,
            amount: total,
            status: "COD",
            paymentMethod: "COD",
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

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