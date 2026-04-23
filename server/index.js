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

const CLIENT_URL = process.env.CLIENT_URL || "https://snapcart-full-beta.vercel.app";

// 🔥 INIT FIREBASE
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// ✅ CORS
app.use(cors({ 
    origin: function (origin, callback) {
        if (!origin || origin.includes('localhost') || origin.includes('vercel.app')){
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials:true,
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

// 🔥 STRIPE WEBHOOK (must be before express.json)
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

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const orderId = session.metadata?.orderId;

            if (!orderId) return res.status(400).send("Missing orderId");

            const orderRef = db.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                return res.status(404).send("Order not found");
            }

            // ✅ Prevent duplicate processing
            if (orderDoc.data().status?.includes('Paid')) {
                return res.json({ received: true });
            }

            await orderRef.update({
                status: 'Paid (Stripe)',
                stripeSessionId: session.id,
                amount: session.amount_total / 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Order marked paid:", orderId);
        }

        res.json({ received: true });

    } catch (error) {
        console.error("❌ Webhook error:", error);
        res.status(500).send("Webhook failed");
    }
});

// ✅ JSON AFTER webhook
app.use(express.json());


// 💰 CALCULATE TOTAL (DB only)
const calculateTotals = (items) => {
    const subtotal = items.reduce((t, item) => {
        return t + Number(item.price) * Number(item.quantity);
    }, 0);

    const tax = subtotal * 0.10;
    const shipping = 5.99;

    return { subtotal, tax, shipping, total: subtotal + tax + shipping };
};


// 🧾 CREATE STRIPE CHECKOUT SESSION
app.post('/create-checkout-session', async (req, res) => {
    const { items, userId, address } = req.body;

    console.log("📥 Request:", req.body);

    // ✅ VALIDATION
    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Cart is empty" });
    }

    if (!userId || !address) {
        return res.status(400).json({ error: "Missing userId or address" });
    }

    for (const item of items) {
        if (
            !item.name ||
            isNaN(item.price) ||
            isNaN(item.quantity) ||
            item.quantity <= 0
        ) {
            return res.status(400).json({ error: "Invalid item data" });
        }
    }

    try {
        const { subtotal, tax, shipping, total } = calculateTotals(items);

        // 📝 CREATE ORDER
        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            status: 'Payment Incomplete (Stripe)',
            paymentMethod: 'stripe',
            amount: total,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        // ✅ BUILD LINE ITEMS CORRECTLY
        const line_items = items.map(item => ({
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name
                },
                unit_amount: Math.round(Number(item.price) * 100),
            },
            quantity: Number(item.quantity),
        }));

        // ➕ SHIPPING
        line_items.push({
            price_data: {
                currency: 'usd',
                product_data: { name: 'Shipping' },
                unit_amount: Math.round(shipping * 100),
            },
            quantity: 1,
        });

        // ➕ TAX
        line_items.push({
            price_data: {
                currency: 'usd',
                product_data: { name: 'Tax' },
                unit_amount: Math.round(tax * 100),
            },
            quantity: 1,
        });

        // 💳 CREATE SESSION
        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            mode: 'payment',
            line_items,
            success_url: `${CLIENT_URL}/orders`,
            cancel_url: `${CLIENT_URL}/checkout`,
            metadata: {
                orderId: orderRef.id
            }
        });

        console.log("✅ Session:", session.id);

        res.json({ url: session.url });

    } catch (error) {
        console.error("❌ Stripe error:", error);
        res.status(500).json({ error: error.message });
    }
});


// 💵 CASH ON DELIVERY
app.post('/create-cod-order', async (req, res) => {
    const { items, userId, address } = req.body;

    if (!items || !userId || !address) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        const { total } = calculateTotals(items);

        const orderRef = await db.collection('orders').add({
            userId,
            items,
            address,
            amount: total,
            status: 'Payment Pending (COD)',
            paymentMethod: 'COD',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ success: true, orderId: orderRef.id });

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