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
// CORS
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

// ======================
// HEALTH CHECK
// ======================
app.get('/', (req, res) => {
    res.send('Server running');
});

// ======================
// AUTH (optional)
// ======================
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];
    if (!token) return res.status(401).send('Unauthorized');

    try {
        req.user = await admin.auth().verifyIdToken(token);
        next();
    } catch (err) {
        console.error(err);
        res.status(401).send('Invalid token');
    }
};

// =======================================================
// 🧾 CREATE STRIPE SESSION (FIXED - NO METADATA CART)
// =======================================================
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items, userId, address } = req.body;

        if (!items?.length) {
            return res.status(400).json({ error: "Cart is empty" });
        }

        if (!userId || !address) {
            return res.status(400).json({ error: "Missing userId or address" });
        }

        // Calculate total
        const total = items.reduce((sum, item) =>
            sum + Number(item.price) * Number(item.quantity), 0
        );

        // 1️⃣ CREATE ORDER FIRST (PENDING)
        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            amount: total,
            status: 'Pending Payment',
            paymentMethod: 'stripe',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // 2️⃣ CREATE STRIPE SESSION
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',

            line_items: items.map(item => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name
                    },
                    unit_amount: Math.round(Number(item.price) * 100)
                },
                quantity: Number(item.quantity)
            })),

            success_url: `${CLIENT_URL}/orders`,
            cancel_url: `${CLIENT_URL}/checkout`,

            // ONLY SAFE DATA HERE
            metadata: {
                orderId: orderRef.id,
                userId: String(userId)
            }
        });

        // store stripe session id
        await orderRef.update({
            stripeSessionId: session.id
        });

        return res.json({ url: session.url });

    } catch (error) {
        console.error("❌ Stripe error:", error);
        res.status(500).json({ error: error.message });
    }
});

// =======================================================
// 🔥 STRIPE WEBHOOK (UPDATES ORDER)
// =======================================================
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

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;

        const orderId = session.metadata?.orderId;

        if (!orderId) {
            console.log("⚠️ No orderId in metadata");
            return res.json({ received: true });
        }

        try {
            await db.collection('orders').doc(orderId).update({
                status: 'Paid',
                paidAt: admin.firestore.FieldValue.serverTimestamp(),
                stripeSessionId: session.id
            });

            console.log("✅ Order marked as PAID:", orderId);

        } catch (err) {
            console.error("❌ Order update failed:", err);
        }
    }

    res.json({ received: true });
});

// ======================
// COD ORDER (UNCHANGED)
// ======================
app.post('/create-cod-order', async (req, res) => {
    const { items, userId, address } = req.body;

    if (!items || !userId || !address) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        const total = items.reduce((sum, item) =>
            sum + Number(item.price) * Number(item.quantity), 0
        );

        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            amount: total,
            status: 'COD Order Placed',
            paymentMethod: 'COD',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            success: true,
            orderId: orderRef.id
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
});

// ======================
// START SERVER
// ======================
const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on ${PORT}`);
});

module.exports = app;