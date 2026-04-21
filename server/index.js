require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// 🔥 ENV VALIDATION
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ Missing STRIPE_SECRET_KEY in .env");
    process.exit(1);
}

const clientUrl = process.env.CLIENT_URL || "http://localhost:3000";

if (!process.env.CLIENT_URL) {
    console.warn("⚠️ CLIENT_URL missing, using default http://localhost:3000");
}

// 🔥 INIT FIREBASE
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// ✅ CORS
app.use(cors({ origin:[clientUrl, "https://snapcart-sigma-inky.vercel.app"], credentials:true,
    methods: ['GET', 'POST', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization']
}));

// ✅ HEALTH CHECK
app.get('/', (req, res) => {
    res.send('Server is running');
});


// 🔐 AUTH MIDDLEWARE (optional)
const verifyToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    console.log("AUTH HEADER:", authHeader);

    const token = authHeader?.split('Bearer ')[1];

    if (!token) {
        return res.status(401).send('Unauthorized');
    }

    try {
        const decoded = await admin.auth().verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (err) {
        console.error("❌ Auth error:", err);
        res.status(401).send('Invalid token');
    }
};


// 🔥 STRIPE WEBHOOK (MUST BE BEFORE express.json)
app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
        console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
        return res.status(500).send("Webhook not configured");
    }

    let event;

    try {
        event = stripe.webhooks.constructEvent(
            req.body,
            sig,
            process.env.STRIPE_WEBHOOK_SECRET
        );
    } catch (err) {
        console.error("❌ Webhook signature error:", err.message);
        return res.status(400).send(`Webhook Error`);
    }

    console.log("📡 Event received:", event.type);

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            console.log("🧾 Full session:", session);

            const orderId = session.metadata?.orderId;

            console.log("📦 Order ID from metadata:", orderId);

            if (!orderId) {
                return res.status(400).send("Missing orderId in metadata");
            }

            const orderRef = db.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                console.error("❌ Order not found:", orderId);
                return res.status(404).send("Order not found");
            }

            // ✅ Prevent duplicate processing
            if (orderDoc.data().status === 'Paid') {
                console.log("⚠️ Order already processed");
                return res.json({ received: true });
            }

            await orderRef.update({
                status: 'Paid',
                stripeSessionId: session.id,
                amount: session.amount_total / 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Order marked as PAID");
        }

        res.json({ received: true });

    } catch (error) {
        console.error("❌ Webhook processing error:", error);
        res.status(500).send("Webhook failed");
    }
});


// ✅ JSON middleware AFTER webhook
app.use(express.json());


// 💰 HELPER: CALCULATE TOTAL
const calculateTotal = (items) => {
    return items.reduce((total, item) => {
        return total + (Number(item.price) * Number(item.quantity));
    }, 0);
};


// 🧾 CREATE STRIPE CHECKOUT SESSION
app.post('/create-checkout-session', async (req, res) => {
    console.log("📥 Incoming body:", req.body);

    const { items, userId, address } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Items must be a non-empty array" });
    }

    if (!userId || !address) {
        return res.status(400).json({ error: "Missing userId or address" });
    }

    try {
        // ✅ SAFE CLIENT URL
        const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";
        console.log("🌐 CLIENT_URL:", CLIENT_URL);

        // ✅ CALCULATE TOTAL
        const total = calculateTotal(items);
        console.log("💰 Calculated total:", total);

        // ✅ CREATE ORDER
        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            status: 'Pending Payment',
            paymentMethod: 'stripe',
            amount: total,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("📝 Order created:", orderRef.id);

        // ✅ CREATE STRIPE SESSION
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

        console.log("✅ Stripe session created:", session.id);

        res.json({ url: session.url });

    } catch (error) {
        console.error("❌ Stripe session error:", error);
        res.status(500).json({ error: error.message });
    }
});


// 💵 CASH ON DELIVERY
app.post('/create-cod-order', async (req, res) => {
    console.log("📥 COD body:", req.body);

    const { items, userId, address } = req.body;

    if (!items || !userId || !address) {
        return res.status(400).json({ error: "Missing required fields" });
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

        console.log("📝 COD Order created:", orderRef.id);

        res.status(201).json({ success: true, orderId: orderRef.id });

    } catch (error) {
        console.error("❌ COD error:", error);
        res.status(500).json({ error: error.message });
    }
});


// 🔄 UPDATE ORDER STATUS
app.post('/update-order-status', verifyToken, async (req, res) => {
    console.log("📥 Update status body:", req.body);

    const { orderId, newStatus } = req.body;

    if (!orderId || !newStatus) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        await db.collection('orders').doc(orderId).update({
            status: newStatus,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log("✅ Order status updated:", orderId);

        res.json({ success: true });

    } catch (error) {
        console.error("❌ Status update error:", error);
        res.status(500).json({ error: error.message });
    }
});


// 🚀 START SERVER
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});