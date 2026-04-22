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
        setAddressData(data => ({ ...data, [name]: value }));
    };

    // =========================
    // SAFE TOTAL CALC (UI UNCHANGED)
    // =========================
    const subtotal = cart.reduce((acc, item) => {
        const price = Number(item.price);
        const qty = Number(item.quantity);

        if (!Number.isFinite(price) || !Number.isFinite(qty)) return acc;

        return acc + (price * qty);
    }, 0);

    const shipping = cart.length > 0 ? 5.99 : 0;
    const tax = subtotal * 0.10;
    const total = subtotal + shipping + tax;

    const updateQuantity = (id, change, size) => {
        const updatedCart = cart.map((item) =>
            item.id === id && item.size === size
                ? { ...item, quantity: Math.max(1, Number(item.quantity) + change) }
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

        if (
            !addressData.address ||
            !addressData.city ||
            !addressData.state ||
            !addressData.zipCode ||
            !addressData.firstName ||
            !addressData.lastName
        ) {
            toast.error("Please fill in all fields");
            return;
        }

        // =========================
        // 🔥 FIXED CART CLEANING (STRIPE FIX)
        // =========================
        const cleanedCart = cart
            .map(item => {
                const rawPrice = item.price;

                const price =
                    typeof rawPrice === "string"
                        ? parseFloat(rawPrice.replace(/[^0-9.]/g, ""))
                        : Number(rawPrice);

                const quantity = Number(item.quantity);

                return {
                    name: item.name,
                    price: isNaN(price) ? 0 : price,
                    quantity: isNaN(quantity) ? 1 : quantity
                };
            })
            .filter(item => item.price > 0 && item.quantity > 0);

        if (cleanedCart.length === 0) {
            toast.error("Cart is empty or invalid");
            return;
        }

        const API_BASE_URL =
            process.env.REACT_APP_API_URL ||
            'https://snapcart-full-4.onrender.com';

        // =========================
        // COD
        // =========================
        if (paymentMethod === 'COD') {
            try {
                const response = await fetch(`${API_BASE_URL}/create-cod-order`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: cleanedCart,
                        userId: currentUser.uid,
                        address: addressData,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "COD failed");
                }

                localStorage.removeItem('snapcart_items');
                setCart([]);

                toast.success("Order placed successfully");
                navigate('/orders');

            } catch (error) {
                console.error("COD ERROR:", error);
                toast.error("COD order failed");
            }
        }

        // =========================
        // STRIPE
        // =========================
        else if (paymentMethod === 'stripe') {
            try {
                const response = await fetch(`${API_BASE_URL}/create-checkout-session`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: cleanedCart,
                        userId: currentUser.uid,
                        address: addressData,
                    }),
                });

                const data = await response.json();

                if (!response.ok) {
                    throw new Error(data.error || "Stripe failed");
                }

                if (!data.url) {
                    throw new Error("No Stripe URL returned");
                }

                window.location.href = data.url;

            } catch (error) {
                console.error("STRIPE ERROR:", error);
                toast.error("Stripe checkout failed");
            }
        }
    };

    return (
        <section id="checkout">

            <div className="checkout__title--container">
                <h3 className="checkout__title">Checkout</h3>
            </div>

            <div className="cart__container">
                <div className="card-details">
                    {cart.map((item) => (
                        <div key={`${item.id}-${item.size}`} className="cart__item-card">

                            <img className="cart-item-image" src={item.image} alt={item.name} />

                            <div>
                                <h4 className="item_name">{item.name}</h4>

                                {item.size && (
                                    <p className="item_size">Size: {item.size}</p>
                                )}

                                <div className="quantity-controls">
                                    <button onClick={() => updateQuantity(item.id, -1, item.size)}>-</button>
                                    <span>{item.quantity}</span>
                                    <button onClick={() => updateQuantity(item.id, 1, item.size)}>+</button>
                                </div>
                            </div>

                            <span>
                                ${(Number(item.price) * Number(item.quantity)).toFixed(2)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="input__title--container">
                <h4>Delivery Information</h4>
            </div>

            <div className="input_container">
                <input name="firstName" value={addressData.firstName} onChange={onChangeHandler} placeholder="First Name" />
                <input name="lastName" value={addressData.lastName} onChange={onChangeHandler} placeholder="Last Name" />
                <input name="email" value={addressData.email} onChange={onChangeHandler} placeholder="Email" />
                <input name="address" value={addressData.address} onChange={onChangeHandler} placeholder="Address" />
                <input name="city" value={addressData.city} onChange={onChangeHandler} placeholder="City" />
                <input name="state" value={addressData.state} onChange={onChangeHandler} placeholder="State" />
                <input name="country" value={addressData.country} onChange={onChangeHandler} placeholder="Country" />
                <input name="zipCode" value={addressData.zipCode} onChange={onChangeHandler} placeholder="Zip Code" />
            </div>

            <h4>Select Payment Method</h4>

            <div className="payment__method__container">
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
            </div>

            <div className="cart-summary--checkout">
                <h3>Order Summary</h3>

                <div>Subtotal: ${subtotal.toFixed(2)}</div>
                <div>Shipping: ${shipping.toFixed(2)}</div>
                <div>Tax: ${tax.toFixed(2)}</div>

                <div>
                    <strong>Total: ${total.toFixed(2)}</strong>
                </div>

                <button onClick={handleCheckout}>
                    Place Order
                </button>
            </div>

        </section>
    );
};

export default Checkout;