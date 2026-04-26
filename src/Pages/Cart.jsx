import React from "react";
import "./Cart.css";
import { Link } from "react-router-dom";
import { toast } from "react-toastify"

// =========================
// 💾 SAVE CART
// =========================
const saveCart = (cart) => {
  localStorage.setItem("snapcart_items", JSON.stringify(cart));
};

// =========================
// 🛒 CART COMPONENT
// =========================
const Cart = ({ cart, setCart }) => {

  // =========================
  // 🔥 SAFE CALCULATION (FIXED ROOT BUG)
  // =========================
  const subtotal = cart.reduce((acc, item) => {
    const price = Number(item.price);
    const qty = Number(item.quantity);

    // prevent NaN pollution (THIS WAS BREAKING STRIPE)
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return acc;

    return acc + (price * qty);
  }, 0);

  const shipping = cart.length > 0 ? 5.99 : 0;
  const tax = subtotal * 0.1;
  const total = subtotal + shipping + tax;

  // =========================
  // ❌ REMOVE ITEM
  // =========================
  const removeFromCart = (item) => {
    const updatedCart = cart.filter(
      (i) => !(i.id === item.id && i.size === item.size)
    );

    setCart(updatedCart);
    saveCart(updatedCart);
  };

  
  const updatedQty = (event, item) => {
    const val = event.target.value

    if (val === "") {
    const updatedCart = cart.map((i) => i.id === item.id && i.size === item.size ? { ...i, quantity: val } : i )
    setCart(updatedCart);
    return;
  }

  const newQty = Math.max(1, Number(val));

  if (newQty >= 0){
    const updatedCart = cart.map((i) => i.id === item.id && i.size === item.size ? {...i, quantity:newQty } : i );
    setCart(updatedCart);
    saveCart(updatedCart);
  }
  };

  return (
    <section id="cart">

      <h2 className="your_cart">Your Cart</h2>

      {cart.length === 0 ? (
        <>
          <h3 className="no_items">Your Cart is Empty</h3>

          <div className="btn__container">
            <Link to="/products">
              <button className="browse__btn--cart">
                Browse Products
              </button>
            </Link>
          </div>
        </>
      ) : (
        <div className="cart__container">

          {/* ITEMS */}
          <div className="card-details">

            {cart.map((item, index) => (
              <div key={index} className="cart__item-card">

                <img
                  className="cart-item-image"
                  src={item.image}
                  alt={item.name}
                />

                <div>

                  <h4 className="item_name">
                    {item.name}
                  </h4>

                  {item.size && (
                    <p className="item_size">
                      Size: {item.size}
                    </p>
                  )}

                  {/* QUANTITY CONTROLS */}
                  <div className="quantity-controls">

    

                    <input type="number" className="qty-number"
                     value={item.quantity} onChange={(e)=> updatedQty(e, item)} 
                     />
                   

                  </div>

                  <p className="cart_price">
                    {/* FIXED: safe number conversion */}
                    ${Number(item.price || 0).toFixed(2)}
                  </p>

                </div>

                <button
                  className="remove-btn"
                  onClick={() => removeFromCart(item)}
                >
                  Remove
                </button>

              </div>
            ))}

          </div>

          {/* ORDER SUMMARY */}
          <div className="cart-summary">

            <h3 className="order_summary">
              Order Summary
            </h3>

            <div className="summary-line">
              <span> Subtotal:</span>
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

            <div className="summary-line">
              <span>Total:</span>
              <span>${total.toFixed(2)}</span>
            </div>

            <Link to="/checkout">
              <button className="checkout_btn">
                Proceed to Checkout
              </button>
            </Link>

          </div>

        </div>
      )}

    </section>
  );
};

export default Cart;