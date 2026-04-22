require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// 🔥 ENV VALIDATION
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ Missing STRIPE_SECRET_KEY");
    process.exit(1);
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
    process.exit(1);
}

const CLIENT_URL = process.env.CLIENT_URL || "https://snapcart-store.vercel.app";

// 🔥 FIREBASE INIT (SAFE)
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const app = express();

// ✅ CORS (STRICT)
const allowedOrigins = [
    "http://localhost:3000",
    CLIENT_URL
];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("CORS blocked"));
        }
    },
    credentials: true
}));

// ✅ HEALTH CHECK
app.get('/', (req, res) => {
    res.send('Server running');
});

// 🔐 AUTH MIDDLEWARE
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) return res.status(401).send("Unauthorized");

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("❌ Auth error:", err);
        res.status(401).send("Invalid token");
    }
};

// 🔥 STRIPE WEBHOOK
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
        console.error("❌ Signature error:", err.message);
        return res.status(400).send("Webhook Error");
    }

    console.log("📡 Event:", event.type);

    if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const orderId = session.metadata?.orderId;

        if (!orderId) {
            return res.status(400).send("Missing orderId");
        }

        try {
            const orderRef = db.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                return res.status(404).send("Order not found");
            }

            const data = orderDoc.data();

            // ✅ Prevent duplicates
            if (data.status === 'Paid' || data.stripeSessionId === session.id) {
                console.log("⚠️ Already processed");
                return res.json({ received: true });
            }

            await orderRef.update({
                status: 'Paid',
                stripeSessionId: session.id,
                paymentIntentId: session.payment_intent,
                amount: session.amount_total / 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Order marked as PAID:", orderId);

        } catch (err) {
            console.error("❌ DB error:", err);
            return res.status(500).send("DB error");
        }
    }

    res.json({ received: true });
});

// ✅ JSON AFTER WEBHOOK
app.use(express.json());

// 💰 SAFE TOTAL CALCULATION (example placeholder)
const calculateTotal = (items) => {
    return items.reduce((sum, item) => {
        return sum + (Number(item.price) * Number(item.quantity));
    }, 0);
};

// 🧾 CREATE CHECKOUT SESSION
app.post('/create-checkout-session', verifyToken, async (req, res) => {
    const { items, address } = req.body;
    const userId = req.user.uid;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Invalid items" });
    }

    if (!address) {
        return res.status(400).json({ error: "Missing address" });
    }

    try {
        const total = calculateTotal(items);

        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            status: 'Pending Payment',
            paymentMethod: 'stripe',
            amount: total,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',

            line_items: items.map(item => ({
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name
                    },
                    unit_amount: Math.round(Number(item.price) * 100),
                },
                quantity: Number(item.quantity),
            })),

            success_url: `${CLIENT_URL}/orders`,
            cancel_url: `${CLIENT_URL}/checkout`,

            metadata: {
                orderId: orderRef.id
            }
        });

        res.json({ url: session.url });

    } catch (err) {
        console.error("❌ Stripe error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 💵 CASH ON DELIVERY
app.post('/create-cod-order', verifyToken, async (req, res) => {
    const { items, address } = req.body;
    const userId = req.user.uid;

    if (!items || !address) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        const total = calculateTotal(items);

        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            amount: total,
            status: 'Order Placed (COD)',
            paymentMethod: 'COD',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ orderId: orderRef.id });

    } catch (err) {
        console.error("❌ COD error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 🔄 UPDATE ORDER STATUS (SECURE)
app.post('/update-order-status', verifyToken, async (req, res) => {
    const { orderId, newStatus } = req.body;

    if (!orderId || !newStatus) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        const ref = db.collection('orders').doc(orderId);
        const doc = await ref.get();

        if (!doc.exists) {
            return res.status(404).send("Order not found");
        }

        if (doc.data().userId !== req.user.uid) {
            return res.status(403).send("Forbidden");
        }

        await ref.update({
            status: newStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });

    } catch (err) {
        console.error("❌ Update error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 🚀 START SERVER
const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on port ${PORT}`);
});

module.exports = app;