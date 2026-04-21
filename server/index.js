require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

const app = express();

// 🔐 ENV CHECK (no crashing)
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ STRIPE_SECRET_KEY missing");
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ STRIPE_WEBHOOK_SECRET missing");
}

const CLIENT_URL = process.env.CLIENT_URL || "https://snapcart-sigma-inky.vercel.app";

// 🔥 INIT FIREBASE (ENV-BASED)
try {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY
                ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
                : undefined,
        }),
    });
} catch (err) {
    console.error("❌ Firebase init error:", err);
}

const db = admin.firestore();

// ✅ CORS (relaxed for debugging)
app.use(cors({
    origin: true,
    credentials: true,
}));

// ✅ HEALTH CHECK
app.get('/', (req, res) => {
    res.status(200).send('Server is running');
});

// 🔐 AUTH MIDDLEWARE
const verifyToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader?.split('Bearer ')[1];

        if (!token) {
            return res.status(401).send('Unauthorized');
        }

        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;

        next();
    } catch (err) {
        console.error("❌ Auth error:", err);
        res.status(401).send('Invalid token');
    }
};

// 🔥 STRIPE WEBHOOK (raw BEFORE json)
app.use('/webhook', express.raw({ type: 'application/json' }));

app.post('/webhook', async (req, res) => {
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
        return res.status(400).send('Webhook Error');
    }

    console.log("📡 Event:", event.type);

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const orderId = session.metadata?.orderId;

            if (!orderId) {
                return res.status(400).send("Missing orderId");
            }

            const orderRef = db.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                return res.status(404).send("Order not found");
            }

            if (orderDoc.data().status === 'Paid') {
                return res.json({ received: true });
            }

            await orderRef.update({
                status: 'Paid',
                stripeSessionId: session.id,
                amount: session.amount_total / 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Order marked PAID:", orderId);
        }

        res.json({ received: true });

    } catch (err) {
        console.error("❌ Webhook processing error:", err);
        res.status(500).send("Webhook failed");
    }
});

// ✅ JSON AFTER webhook
app.use(express.json());

// 💰 HELPER
const calculateTotal = (items) => {
    return items.reduce((total, item) => {
        return total + (Number(item.price) * Number(item.quantity));
    }, 0);
};

// 🧾 CREATE CHECKOUT SESSION
app.post('/create-checkout-session', async (req, res) => {
    try {
        const { items, userId, address } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: "Invalid items" });
        }

        if (!userId || !address) {
            return res.status(400).json({ error: "Missing userId or address" });
        }

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
                    product_data: { name: item.name },
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
        console.error("❌ Stripe session error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 💵 COD
app.post('/create-cod-order', async (req, res) => {
    try {
        const { items, userId, address } = req.body;

        if (!items || !userId || !address) {
            return res.status(400).json({ error: "Missing fields" });
        }

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

        res.status(201).json({
            success: true,
            orderId: orderRef.id
        });

    } catch (err) {
        console.error("❌ COD error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 🔄 UPDATE STATUS
app.post('/update-order-status', verifyToken, async (req, res) => {
    try {
        const { orderId, newStatus } = req.body;

        if (!orderId || !newStatus) {
            return res.status(400).json({ error: "Missing fields" });
        }

        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.json({ success: true });

    } catch (err) {
        console.error("❌ Update error:", err);
        res.status(500).json({ error: err.message });
    }
});

// 🚀 EXPORT (NO app.listen)
module.exports = app;