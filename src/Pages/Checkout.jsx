import React, { useState } from 'react';
import './Checkout.css';
import StripeImg from '../assets/stripe.png';
import COD from '../assets/cash_on_delivery.png';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { auth } from '../Firebase';

const Checkout = ({ cart, setCart }) => {
    const navigate = useNavigate();
    const [paymentMethod, setPaymentMethod] = useState("");

    const [addressData, setAddressData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        address: '',
        city: '',
        state: '',
        country: '',
        zipCode: '',
    });

    const onChangeHandler = (e) => {
        const { name, value } = e.target;
        setAddressData(prev => ({ ...prev, [name]: value }));
    };

    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const shipping = cart.length > 0 ? 5.99 : 0;
    const tax = subtotal * 0.10;
    const total = subtotal + shipping + tax;

    const handleCheckout = async (e) => {
        e.preventDefault();

        const user = auth.currentUser;

        if (!user) {
            toast.error("You must be logged in");
            return;
        }

        if (!paymentMethod) {
            toast.error("Select a payment method");
            return;
        }

        const { address, city, state, zipCode, firstName, lastName } = addressData;

        if (!address || !city || !state || !zipCode || !firstName || !lastName) {
            toast.error("Fill all required fields");
            return;
        }

        const API = process.env.REACT_APP_API_URL || 'https://snapcart-full-4.onrender.com';

        // ======================
        // COD FLOW
        // ======================
        if (paymentMethod === 'COD') {
            try {
                const res = await fetch(`${API}/create-cod-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: cart,
                        userId: user.uid,
                        address: addressData
                    })
                });

                const data = await res.json();

                if (!res.ok) {
                    toast.error(data.error || "COD failed");
                    return;
                }

                localStorage.removeItem('snapcart_items');
                setCart([]);

                toast.success("COD order placed");
                navigate('/orders');

            } catch (err) {
                console.error(err);
                toast.error("COD error occurred");
            }
        }

        // ======================
        // STRIPE FLOW
        // ======================
        else if (paymentMethod === 'stripe') {
            try {
                const res = await fetch(`${API}/create-checkout-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: cart,
                        userId: user.uid,
                        address: addressData
                    })
                });

                const data = await res.json();

                console.log("Stripe response:", data);

                if (!res.ok) {
                    toast.error(data.error || "Stripe request failed");
                    return;
                }

                if (!data.url) {
                    toast.error("Stripe session missing URL");
                    return;
                }

                // DO NOT clear cart here (Stripe redirect)
                window.location.href = data.url;

            } catch (err) {
                console.error(err);
                toast.error("Stripe checkout failed");
            }
        }
    };

    return (
        <section id="checkout">

            <h3 className="checkout__title">Checkout</h3>

            {/* CART */}
            <div>
                {cart.map(item => (
                    <div key={`${item.id}-${item.size}`}>
                        <p>{item.name} x {item.quantity}</p>
                    </div>
                ))}
            </div>

            {/* ADDRESS */}
            <div>
                <input name="firstName" value={addressData.firstName} onChange={onChangeHandler} placeholder="First Name" />
                <input name="lastName" value={addressData.lastName} onChange={onChangeHandler} placeholder="Last Name" />
                <input name="email" value={addressData.email} onChange={onChangeHandler} placeholder="Email" />
                <input name="address" value={addressData.address} onChange={onChangeHandler} placeholder="Address" />
                <input name="city" value={addressData.city} onChange={onChangeHandler} placeholder="City" />
                <input name="state" value={addressData.state} onChange={onChangeHandler} placeholder="State" />
                <input name="country" value={addressData.country} onChange={onChangeHandler} placeholder="Country" />
                <input name="zipCode" value={addressData.zipCode} onChange={onChangeHandler} placeholder="Zip Code" />
            </div>

            {/* PAYMENT */}
            <div>
                <img
                    src={StripeImg}
                    alt="stripe"
                    onClick={() => setPaymentMethod('stripe')}
                    style={{ border: paymentMethod === 'stripe' ? '2px solid green' : '' }}
                />

                <img
                    src={COD}
                    alt="cod"
                    onClick={() => setPaymentMethod('COD')}
                    style={{ border: paymentMethod === 'COD' ? '2px solid green' : '' }}
                />
            </div>

            {/* SUMMARY */}
            <div>
                <p>Total: ${total.toFixed(2)}</p>
            </div>

            <button onClick={handleCheckout}>
                Place Order
            </button>

        </section>
    );
};

export default Checkout;