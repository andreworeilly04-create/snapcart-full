require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// 🔥 ENV CHECK
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ Missing STRIPE_SECRET_KEY");
    process.exit(1);
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
    process.exit(1);
}

const CLIENT_URL = process.env.CLIENT_URL || "https://snapcart-store.vercel.app";

// 🔥 FIREBASE INIT
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
// AUTH MIDDLEWARE
// ======================
const verifyToken = async (req, res, next) => {
    const token = req.headers.authorization?.split('Bearer ')[1];

    if (!token) return res.status(401).send('Unauthorized');

    try {
        req.user = await admin.auth().verifyIdToken(token);
        next();
    } catch (err) {
        console.error("❌ Auth error:", err);
        res.status(401).send('Invalid token');
    }
};


// ======================
// STRIPE WEBHOOK (ROBUST)
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
        console.error("❌ Webhook signature error:", err.message);
        return res.status(400).send("Webhook Error");
    }

    console.log("📡 WEBHOOK EVENT:", event.type);

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            console.log("🔥 WEBHOOK TRIGGERED");
            console.log("🧾 SESSION ID:", session.id);
            console.log("📦 METADATA:", session.metadata);

            // 🔥 Prevent duplicates
            const existing = await db.collection('orders')
                .where('stripeSessionId', '==', session.id)
                .limit(1)
                .get();

            if (!existing.empty) {
                console.log("⚠️ Duplicate order ignored");
                return res.json({ received: true });
            }

            // 🔥 SAFE PARSE
            let items = [];
            let address = {};

            try {
                items = session.metadata.items ? JSON.parse(session.metadata.items) : [];
                address = session.metadata.address ? JSON.parse(session.metadata.address) : {};
            } catch (e) {
                console.error("❌ Metadata parse error:", e.message);
            }

            const userId = session.metadata.userId || "guest";

            // 🔥 CREATE ORDER
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

            console.log("✅ ORDER CREATED:", orderRef.id);
        }

        res.json({ received: true });

    } catch (error) {
        console.error("❌ WEBHOOK ERROR:", error);
        res.status(500).send("Webhook failed");
    }
});


// ======================
// JSON MIDDLEWARE (AFTER WEBHOOK)
// ======================
app.use(express.json());


// ======================
// STRIPE CHECKOUT SESSION (DEBUGGED)
// ======================
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items, userId, address } = req.body;

        console.log("🧾 REQUEST RECEIVED:", req.body);

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Cart is empty or invalid" });
        }

        if (!userId || !address) {
            return res.status(400).json({ error: "Missing userId or address" });
        }

        // 🔥 VALIDATE CART
        const line_items = items.map((item, i) => {
            const price = Number(item.price);
            const quantity = Number(item.quantity);

            console.log(`🔍 ITEM ${i}:`, item);

            if (isNaN(price) || price <= 0) {
                throw new Error(`Invalid price: ${JSON.stringify(item)}`);
            }

            if (isNaN(quantity) || quantity <= 0) {
                throw new Error(`Invalid quantity: ${JSON.stringify(item)}`);
            }

            return {
                price_data: {
                    currency: 'usd',
                    product_data: {
                        name: item.name || "Product"
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
                items: JSON.stringify(items),
                address: JSON.stringify(address)
            }
        });

        console.log("✅ STRIPE SESSION CREATED:", session.id);

        return res.json({ url: session.url });

    } catch (error) {
        console.error("❌ STRIPE CHECKOUT ERROR:", error.message);

        return res.status(500).json({
            error: error.message
        });
    }
});


// ======================
// COD ORDER
// ======================
app.post('/create-cod-order', async (req, res) => {
    const { items, userId, address } = req.body;

    if (!items || !userId || !address) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        const total = items.reduce((sum, item) =>
            sum + Number(item.price) * Number(item.quantity), 0);

        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            amount: total,
            status: 'Order Placed (COD)',
            paymentMethod: 'COD',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({
            success: true,
            orderId: orderRef.id
        });

    } catch (error) {
        console.error("❌ COD ERROR:", error);
        res.status(500).json({ error: error.message });
    }
});


// ======================
// UPDATE ORDER STATUS
// ======================
app.post('/update-order-status', verifyToken, async (req, res) => {
    const { orderId, newStatus } = req.body;

    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });

    } catch (error) {
        console.error("❌ UPDATE ERROR:", error);
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