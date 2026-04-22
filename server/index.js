app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    console.log("🔥 WEBHOOK HIT");

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
        console.error("❌ Signature error:", err.message);
        return res.status(400).send("Webhook Error");
    }

    console.log("📡 Event:", event.type);

    try {

        // ✅ CASE 1: Checkout completed
        if (event.type === 'checkout.session.completed') {
            const session = event.data.object;

            console.log("🧾 Session:", session.id);

            const orderId = session.metadata?.orderId;

            if (!orderId) {
                console.error("❌ No orderId in metadata");
                return res.json({ received: true });
            }

            const orderRef = db.collection('orders').doc(orderId);
            const orderDoc = await orderRef.get();

            if (!orderDoc.exists) {
                console.error("❌ Order not found:", orderId);
                return res.json({ received: true });
            }

            const data = orderDoc.data();

            // prevent duplicates
            if (data.status === 'Paid') {
                console.log("⚠️ Already paid");
                return res.json({ received: true });
            }

            await orderRef.update({
                status: 'Paid',
                stripeSessionId: session.id,
                paymentIntentId: session.payment_intent,
                amount: session.amount_total / 100,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Order marked PAID (session)");
        }


        // ✅ CASE 2: Payment intent succeeded (backup safety)
        if (event.type === 'payment_intent.succeeded') {
            const paymentIntent = event.data.object;

            console.log("💰 PaymentIntent:", paymentIntent.id);

            const snapshot = await db.collection('orders')
                .where('paymentIntentId', '==', paymentIntent.id)
                .get();

            if (snapshot.empty) {
                console.log("⚠️ No order found for paymentIntent");
                return res.json({ received: true });
            }

            const doc = snapshot.docs[0];

            if (doc.data().status === 'Paid') {
                console.log("⚠️ Already paid (intent)");
                return res.json({ received: true });
            }

            await doc.ref.update({
                status: 'Paid',
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log("✅ Order marked PAID (paymentIntent)");
        }

        res.json({ received: true });

    } catch (error) {
        console.error("❌ Webhook error:", error);
        res.status(500).send("Webhook failed");
    }
});