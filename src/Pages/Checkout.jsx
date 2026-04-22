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

    const onChangeHandler = (event) => {
        const { name, value } = event.target;
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

                toast.success("Order placed successfully (COD)");
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

                if (!res.ok) {
                    toast.error(data.error || "Stripe request failed");
                    return;
                }

                if (!data.url) {
                    toast.error("Stripe session missing URL");
                    return;
                }

                // IMPORTANT: do NOT clear cart here
                window.location.href = data.url;

            } catch (err) {
                console.error(err);
                toast.error("Stripe checkout failed");
            }
        }
    };

    return (
        <section id="checkout">

            <div className="checkout__title--container">
                <h3 className="checkout__title">Checkout</h3>
            </div>

            {/* CART ITEMS */}
            <div className="cart__container">
                <div className="card-details">
                    {cart.map((item) => (
                        <div key={`${item.id}-${item.size}`} className="cart__item-card">

                            <img className="cart-item-image" src={item.image} alt={item.name} />

                            <div>
                                <h4 className="item_name">{item.name}</h4>
                                {item.size && <p className="item_size">Size: {item.size}</p>}

                                <p className="item_quantity">Quantity: {item.quantity}</p>
                            </div>

                            <span className="item_price">
                                ${(item.price * item.quantity).toFixed(2)}
                            </span>

                        </div>
                    ))}
                </div>
            </div>

            {/* DELIVERY INFO */}
            <div className="input_container">
                <input onChange={onChangeHandler} name="firstName" value={addressData.firstName} placeholder="First Name" />
                <input onChange={onChangeHandler} name="lastName" value={addressData.lastName} placeholder="Last Name" />
                <input onChange={onChangeHandler} name="email" value={addressData.email} placeholder="Email" />
                <input onChange={onChangeHandler} name="address" value={addressData.address} placeholder="Address" />
                <input onChange={onChangeHandler} name="city" value={addressData.city} placeholder="City" />
                <input onChange={onChangeHandler} name="state" value={addressData.state} placeholder="State" />
                <input onChange={onChangeHandler} name="country" value={addressData.country} placeholder="Country" />
                <input onChange={onChangeHandler} name="zipCode" value={addressData.zipCode} placeholder="Zip Code" />
            </div>

            {/* PAYMENT METHOD */}
            <figure className="payment__method__container">
                <img
                    className={`stripe ${paymentMethod === 'stripe' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('stripe')}
                    src={StripeImg}
                    alt="Stripe"
                />

                <img
                    className={`COD ${paymentMethod === 'COD' ? 'selected' : ''}`}
                    onClick={() => setPaymentMethod('COD')}
                    src={COD}
                    alt="COD"
                />
            </figure>

            {/* ORDER SUMMARY */}
            <div className="cart-summary--checkout">
                <h3 className="order_summary">Order Summary</h3>

                <div className="summary-line">
                    <span>Price:</span>
                    <span>${subtotal.toFixed(2)}</span>
                </div>

                <div className="summary-line">
                    <span>Shipping:</span>
                    <span>${shipping.toFixed(2)}</span>
                </div>

                <div className="summary-line">
                    <span>Tax:</span>
                    <span>${tax.toFixed(2)}</span>
                </div>

                <div className="summary-line--total">
                    <span>Total:</span>
                    <span>${total.toFixed(2)}</span>
                </div>

                <button onClick={handleCheckout} className="checkout_btn">
                    Place Order
                </button>
            </div>

        </section>
    );
};

export default Checkout;