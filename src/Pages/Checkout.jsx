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

    const subtotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    const shipping = cart.length > 0 ? 5.99 : 0;
    const tax = subtotal * 0.10;
    const total = subtotal + shipping + tax;

    const updateQuantity = (id, change, size) => {
        const updatedCart = cart.map((item) =>
            item.id === id && item.size === size
                ? { ...item, quantity: Math.max(1, item.quantity + change) }
                : item
        );

        setCart(updatedCart);
        localStorage.setItem('snapcart_items', JSON.stringify(updatedCart));
    };

    const removeFromCart = (itemObject) => {
        const updatedCart = cart.filter(
            item => item.id !== itemObject.id || item.size !== itemObject.size
        );

        setCart(updatedCart);
        localStorage.setItem('snapcart_items', JSON.stringify(updatedCart));
    };

    const handleCheckout = async (e) => {
        e.preventDefault();

        const currentUser = auth.currentUser;

        if (!currentUser) {
            toast.error("You must be logged in to place an order!");
            return;
        }

        if (!paymentMethod) {
            toast.error("Please select a payment method");
            return;
        }

        const { address, city, state, zipCode, firstName, lastName } = addressData;

        if (!address || !city || !state || !zipCode || !firstName || !lastName) {
            toast.error("Please fill in all fields");
            return;
        }

        const API_BASE_URL = process.env.REACT_APP_API_URL || 'https://snapcart-full-4.onrender.com';

        // 💵 CASH ON DELIVERY
        if (paymentMethod === 'COD') {
            try {
                const response = await fetch(`${API_BASE_URL}/create-cod-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: cart,
                        userId: currentUser.uid,
                        address: addressData
                    }),
                });

                if (response.ok) {
                    localStorage.removeItem('snapcart_items');
                    setCart([]);
                    toast.success("Order placed successfully (COD)");
                    navigate('/orders');
                } else {
                    toast.error("COD order failed");
                }

            } catch (error) {
                console.error(error);
                toast.error("COD error occurred");
            }
        }

        // 💳 STRIPE
        else if (paymentMethod === 'stripe') {
            try {
                const response = await fetch(`${API_BASE_URL}/create-checkout-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: cart,
                        userId: currentUser.uid,
                        address: addressData
                    }),
                });

                const session = await response.json();

                if (session.url) {
                    // ✅ Redirect to Stripe (DO NOT clear cart here)
                    window.location.href = session.url;
                } else {
                    toast.error("Failed to start Stripe checkout");
                }

            } catch (error) {
                console.error(error);
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

                                <div className="quantity-controls">
                                    <button
                                        className="qty-btn"
                                        onClick={() => updateQuantity(item.id, -1, item.size)}
                                    >-</button>

                                    <span className="qty-number">{item.quantity}</span>

                                    <button
                                        className="qty-btn"
                                        onClick={() => updateQuantity(item.id, 1, item.size)}
                                    >+</button>
                                </div>

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
            <div className="input__title--container">
                <h4 className="input__title">Delivery Information</h4>
            </div>

            <div className="input_container">
                <input onChange={onChangeHandler} name='firstName' value={addressData.firstName} type="text" placeholder="First Name" required />
                <input onChange={onChangeHandler} name='lastName' value={addressData.lastName} type="text" placeholder="Last Name" required />
                <input onChange={onChangeHandler} name='email' value={addressData.email} type="email" placeholder="Email" required />
                <input onChange={onChangeHandler} name='address' value={addressData.address} type="text" placeholder="Address" required />
                <input onChange={onChangeHandler} name='city' value={addressData.city} type="text" placeholder="City" required />
                <input onChange={onChangeHandler} name='state' value={addressData.state} type="text" placeholder="State" required />
                <input onChange={onChangeHandler} name='country' value={addressData.country} type="text" placeholder="Country" required />
                <input onChange={onChangeHandler} name='zipCode' value={addressData.zipCode} type="number" placeholder="Zip Code" required />
            </div>

            {/* PAYMENT METHOD */}
            <h4 className="payment__method--title">Select Payment Method</h4>

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
                    alt="Cash on Delivery"
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