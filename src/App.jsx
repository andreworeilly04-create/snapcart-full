import React, { useState, useEffect } from 'react';
import Products from './Pages/Products.jsx';
import Product from './Pages/Product.jsx';
import About from './Pages/About.jsx';
import Contact from './Pages/Contact.jsx';
import Nav from './Components/Nav.jsx';
import Header from './Components/Header.jsx';
import Features from './Components/Features.jsx';
import Recommended from './Components/Recommended.jsx';
import Footer from './Components/Footer.jsx';
import { Routes, Route } from 'react-router-dom';
import { AllProducts } from './data.js';
import Cart from './Pages/Cart.jsx';
import Login from './Pages/Login.jsx';
import Checkout from './Pages/Checkout.jsx';
import { db, auth } from "./Firebase.js";
import { doc, getDoc } from "firebase/firestore";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { loadStripe } from "@stripe/stripe-js";
import { Elements } from "@stripe/react-stripe-js";
import Orders from './Pages/Orders.jsx';
import { onAuthStateChanged } from "firebase/auth";

const stripePromise = loadStripe(
  "pk_test_51TN5bBIrDmLuYUPnmVU0TLNrxaiaHXtwQ12mB2SdEWSFgCmU7z83k584wJsmvoXnguJbIY9SHX2xSNuTu0ZAra5q00BiRB1I0W"
);

function App() {

  // Theme
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('theme') === 'dark' ? 'dark' : 'light'
  );

  // Cart
  const [cart, setCart] = useState(() => {
    const localData = localStorage.getItem('snapcart_items');
    return localData ? JSON.parse(localData) : [];
  });

  // User (ONLY SOURCE OF LOGIN STATE)
  const [user, setUser] = useState(null);

  // UI states
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInputOpen, setIsInputOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const toggleMenu = () => setIsMenuOpen((prev) => !prev);
  const toggleSearch = () => setIsInputOpen((prev) => !prev);

  const handleSearch = (e) => {
    setSearchTerm(e.target.value.toLowerCase());
  };

  // 🔥 FIX 1: Firebase AUTH LISTENER (THIS FIXES LOGIN)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);

        // load cart from firestore
        const savedCart = await getDoc(doc(db, "carts", currentUser.uid));
        if (savedCart.exists()) {
          setCart(savedCart.data().items);
        }

      } else {
        setUser(null);
        setCart([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Theme
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Add to cart
  const addToCart = (product) => {
    setCart((prevCart) => {
      const existing = prevCart.find(
        (item) =>
          String(item.id) === String(product.id) &&
          item.size === product.size
      );

      if (existing) {
        return prevCart.map((item) =>
          String(item.id) === String(product.id) &&
            item.size === product.size
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...prevCart, { ...product, quantity: 1 }];
    });
  };

  return (
    <div className={`app ${theme} ${isMenuOpen ? 'menu--open' : ''}`}>

      <Nav
        user={user}
        setCart={setCart}
        toggleTheme={toggleTheme}
        toggleMenu={toggleMenu}
        cart={cart}
      />

      <ToastContainer />

      <Routes>

        <Route
          path="/"
          element={
            <>
              <Header />
              <Features />
              <Recommended />
            </>
          }
        />

        <Route
          path="/products"
          element={
            <Products
              isInputOpen={isInputOpen}
              toggleSearch={toggleSearch}
              handleSearch={handleSearch}
              searchTerm={searchTerm}
            />
          }
        />

        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />

        <Route
          path="/product/:productId"
          element={
            <Product
              AllProducts={AllProducts}
              addToCart={addToCart}
              cart={cart}
              isLoggedIn={!!user}
            />
          }
        />

        <Route
          path="/cart"
          element={<Cart cart={cart} setCart={setCart} />}
        />

        {/* FIXED LOGIN */}
        <Route
          path="/login"
          element={<Login setUser={setUser} showPassword={showPassword} setShowPassword={setShowPassword}  />}
        />

        <Route
          path="/checkout"
          element={
            <Elements stripe={stripePromise}>
              <Checkout cart={cart} setCart={setCart} />
            </Elements>
          }
        />

        <Route
          path="/orders"
          element={<Orders cart={cart} setCart={setCart} />}
        />

      </Routes>

      <Footer />
    </div>
  );
}

export default App;