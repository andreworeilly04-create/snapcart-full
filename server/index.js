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

// 🔥 INIT FIREBASE
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// ✅ CORS
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

// ✅ HEALTH CHECK
app.get('/', (req, res) => {
    res.send('Server is running');
});


// 🔐 AUTH MIDDLEWARE
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) return res.status(401).send('Unauthorized');

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("❌ Auth error:", err);
        res.status(401).send('Invalid token');
    }
};


// 🔥 STRIPE WEBHOOK (ONLY PLACE ORDER IS CREATED)
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
        console.error("❌ Webhook signature error:", err.message);
        return res.status(400).send("Webhook Error");
    }

    console.log("📡 Stripe Event:", event.type);

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            console.log("🧾 Session ID:", session.id);

            // ✅ Prevent duplicates
            const existing = await db.collection('orders')
                .where('stripeSessionId', '==', session.id)
                .limit(1)
                .get();

            if (!existing.empty) {
                console.log("⚠️ Order already exists. Skipping.");
                return res.json({ received: true });
            }

            // ✅ Parse metadata safely
            let items = [];
            let address = {};

            try {
                items = JSON.parse(session.metadata.items || '[]');
                address = JSON.parse(session.metadata.address || '{}');
            } catch (err) {
                console.error("❌ Metadata parse error:", err);
            }

            const userId = session.metadata.userId || "guest";

            // ✅ Create order AFTER payment success
            const orderRef = await db.collection('orders').add({
                userId,
                items,
                address,
                amount: session.amount_total / 100,
                status: 'Paid',
                paymentMethod: 'stripe',
                stripeSessionId: session.id,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Order created:", orderRef.id);
        }

        res.json({ received: true });

    } catch (error) {
        console.error("❌ Webhook processing error:", error);
        res.status(500).send("Webhook failed");
    }
});


// ✅ JSON middleware AFTER webhook
app.use(express.json());


// 💰 HELPER
const calculateTotal = (items) => {
    return items.reduce((total, item) => {
        return total + (Number(item.price) * Number(item.quantity));
    }, 0);
};


// 🧾 CREATE CHECKOUT SESSION (NO ORDER CREATION HERE)
app.post('/create-checkout-session', async (req, res) => {
    const { items, userId, address } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items must be non-empty array" });
    }

    if (!userId || !address) {
        return res.status(400).json({ error: "Missing userId or address" });
    }

    try {
        console.log("🛒 Creating Stripe session ONLY (no DB write)");

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

            // 🔥 Pass all order data here
            metadata: {
                userId,
                items: JSON.stringify(items),
                address: JSON.stringify(address)
            }
        });

        console.log("✅ Stripe session created:", session.id);

        res.json({ url: session.url });

    } catch (error) {
        console.error("❌ Stripe session error:", error);
        res.status(500).json({ error: error.message });
    }
});


// 💵 CASH ON DELIVERY (INTENTIONAL ORDER CREATION)
app.post('/create-cod-order', async (req, res) => {
    const { items, userId, address } = req.body;

    if (!items || !userId || !address) {
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

        console.log("📝 COD Order:", orderRef.id);

        res.status(201).json({
            success: true,
            orderId: orderRef.id
        });

    } catch (error) {
        console.error("❌ COD error:", error);
        res.status(500).json({ error: error.message });
    }
});


// 🔄 UPDATE ORDER STATUS
app.post('/update-order-status', verifyToken, async (req, res) => {
    const { orderId, newStatus } = req.body;

    if (!orderId || !newStatus) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Status updated:", orderId);

        res.json({ success: true });

    } catch (error) {
        console.error("❌ Status update error:", error);
        res.status(500).json({ error: error.message });
    }
});


// 🚀 START SERVER
const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = app;