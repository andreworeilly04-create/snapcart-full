require('dotenv').config();
const express = require('express');
const cors = require('cors');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// =========================
// ENV VALIDATION
// =========================
if (!process.env.STRIPE_SECRET_KEY) {
    console.error("❌ Missing STRIPE_SECRET_KEY");
    process.exit(1);
}

if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("❌ Missing STRIPE_WEBHOOK_SECRET");
    process.exit(1);
}

const CLIENT_URL =
    process.env.CLIENT_URL || "https://snapcart-full-beta.vercel.app";

// =========================
// FIREBASE INIT
// =========================
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();
const app = express();

// =========================
// CORS
// =========================
app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin.includes('localhost') || origin.includes('vercel.app')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

// =========================
// MIDDLEWARE
// =========================
app.use(express.json());

// =========================
// HEALTH CHECK
// =========================
app.get('/', (req, res) => {
    res.send('Server is running');
});

// =========================
// AUTH MIDDLEWARE
// =========================
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

// =========================
// COD TOTAL CALC
// =========================
const calculateTotal = (items) => {
    const subtotal = items.reduce((total, item) => {
        const price = Number(String(item.price).replace(/[^0-9.]/g, ""));
        const qty = Number(item.quantity);

        return total + (price * qty);
    }, 0);

    const shipping = items.length > 0 ? 5.99 : 0;
    const tax = subtotal * 0.10;

    return Number((subtotal + shipping + tax).toFixed(2));
};

// =========================
// STRIPE ITEM CLEANER (FIXED)
// =========================
const validateAndFormatItems = (items) => {
    return items.map((item, index) => {

        const price = Number(String(item.price).replace(/[^0-9.]/g, ""));
        const quantity = Number(item.quantity);

        if (!item.name) throw new Error(`Item ${index} missing name`);
        if (!Number.isFinite(price) || price <= 0)
            throw new Error(`Invalid price for ${item.name}`);
        if (!Number.isFinite(quantity) || quantity <= 0)
            throw new Error(`Invalid quantity for ${item.name}`);

        return {
            price_data: {
                currency: 'usd',
                product_data: {
                    name: item.name
                },
                unit_amount: Math.round(price * 100),
            },
            quantity
        };
    });
};

// =========================
// STRIPE CHECKOUT (FIXED + SAFE)
// =========================
app.post('/create-checkout-session', async (req, res) => {
    const { items, userId, address } = req.body;

    if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Invalid items" });
    }

    if (!userId || !address) {
        return res.status(400).json({ error: "Missing userId or address" });
    }

    try {
        const lineItems = validateAndFormatItems(items);

        // ✅ KEEP IMAGES IN FIRESTORE
        const cleanedItems = items.map(item => ({
            name: item.name,
            price: Number(String(item.price).replace(/[^0-9.]/g, "")),
            quantity: Number(item.quantity),
            image: item.image || null
        }));

        const orderRef = await db.collection('orders').add({
            userId,
            items: cleanedItems,
            address,
            status: 'Pending',
            paymentMethod: 'stripe',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        const session = await stripe.checkout.sessions.create({
            mode: 'payment',
            payment_method_types: ['card'],
            line_items: lineItems,
            success_url: `${CLIENT_URL}/orders`,
            cancel_url: `${CLIENT_URL}/checkout`,
            metadata: {
                orderId: orderRef.id,
                userId
            }
        });

        return res.json({ url: session.url });

    } catch (error) {
        console.error("❌ STRIPE ERROR:", error);
        return res.status(400).json({ error: error.message });
    }
});

// =========================
// COD ORDER (FIXED + IMAGES)
// =========================
app.post('/create-cod-order', async (req, res) => {
    const { items, userId, address } = req.body;

    if (!items || !userId || !address) {
        return res.status(400).json({ error: "Missing fields" });
    }

    try {
        const cleanedItems = items.map(item => ({
            name: item.name,
            price: Number(String(item.price).replace(/[^0-9.]/g, "")),
            quantity: Number(item.quantity),
            image: item.image || null
        }));

        const total = calculateTotal(cleanedItems);

        const orderRef = await db.collection('orders').add({
            userId,
            items: cleanedItems,
            address,
            amount: total,
            status: 'Order Placed (COD)',
            paymentMethod: 'COD',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

        res.status(201).json({ success: true, orderId: orderRef.id });

    } catch (error) {
        console.error("❌ COD error:", error);
        res.status(500).json({ error: error.message });
    }
});

// =========================
// ORDER UPDATE
// =========================
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
        console.error("❌ Update error:", error);
        res.status(500).json({ error: error.message });
    }
});

// =========================
// WEBHOOK (UNCHANGED)
// =========================
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
        return res.status(400).send('Webhook Error');
    }

    try {
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;
            const orderId = session.metadata?.orderId;

            if (!orderId) return res.status(400).send("Missing orderId");

            const orderRef = db.collection('orders').doc(orderId);

            await orderRef.update({
                status: 'Paid',
                amount: session.amount_total / 100,
                currency: session.currency,
                stripeSessionId: session.id,
                customerEmail: session.customer_details?.email || null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Order PAID:", orderId);
        }

        res.json({ received: true });

    } catch (error) {
        console.error("❌ Webhook processing error:", error);
        res.status(500).send("Webhook failed");
    }
});

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 4000;

app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Running on http://localhost:${PORT}`);
});

module.exports = app;