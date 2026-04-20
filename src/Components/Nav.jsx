import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { auth } from '../Firebase';
import '../App.css';
import './Nav.css';
import snapcart from '../assets/SnapCart.png';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faCartShopping,
  faMoon,
  faUser,
  faSun,
  faBars,
  faTimes
} from '@fortawesome/free-solid-svg-icons';

import { signOut } from 'firebase/auth';
import { toast } from 'react-toastify';

const Nav = ({ toggleTheme, toggleMenu, cart = [], setCart, user }) => {

  const navigate = useNavigate();

  // ✅ FIXED LOGOUT ONLY (no UI changes)
  const handleLogout = async () => {
    try {
      await signOut(auth);

      setCart([]);
      localStorage.removeItem("snapcart_items");
      localStorage.removeItem("user");

      toast.success("Signed out!");

      navigate("/login");

    } catch (error) {
      console.error(error);
      toast.error("Error logging out");
    }
  };

  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <>
      <section id="nav">
        <div className="nav__container">

          {/* Logo */}
          <figure className="logo">
            <Link to="/">
              <img className="logo__img" src={snapcart} alt="SnapCart Logo" />
            </Link>
          </figure>

          {/* Desktop Icons */}
          <ul className="profile__links">

            <li onClick={toggleTheme} className="profile__link--moon">
              <FontAwesomeIcon icon={faMoon} />
            </li>

            {/* USER MENU (UNCHANGED CLASSNAMES) */}
            <Link className="user_link" to={user ? "/" : "/login"}>

              <li className="profile__link">
                <FontAwesomeIcon icon={faUser} />
              </li>

              {user && (
                <div className="login_dashboard--container">

                  <Link to="/orders">
                    <p className="orders">Orders</p>
                  </Link>

                  <p onClick={handleLogout} className="logout">
                    Logout
                  </p>

                </div>
              )}

            </Link>

            {/* CART */}
            <Link className="cart_link" to="/cart">

              <li className="profile__link">
                <FontAwesomeIcon icon={faCartShopping} />
              </li>

              {totalItems > 0 && (
                <div className="cart_number--container">
                  <p className="cart_number">{totalItems}</p>
                </div>
              )}

            </Link>

          </ul>

          {/* Dark Icons */}
          <ul className="dark--profile__links">

            <li onClick={toggleTheme} className="profile__link--sun">
              <FontAwesomeIcon icon={faSun} />
            </li>

            <Link className="user_link" to={user ? "/" : "/login"}>

              <li className="profile__link">
                <FontAwesomeIcon icon={faUser} />
              </li>

              {user && (
                <div className="login_dashboard--container">

                  <Link to="/orders">
                    <p className="orders">Orders</p>
                  </Link>

                  <p onClick={handleLogout} className="logout">
                    Logout
                  </p>

                </div>
              )}

            </Link>

            <Link className="cart_link" to="/cart">

              <li className="dark--profile__link">
                <FontAwesomeIcon icon={faCartShopping} />
              </li>

              {totalItems > 0 && (
                <div className="cart_number--container">
                  <p className="cart_number">{totalItems}</p>
                </div>
              )}

            </Link>

          </ul>

          {/* NAV LINKS (UNCHANGED) */}
          <ul className="nav__links">
            <NavLink to="/" className={({ isActive }) => (isActive ? "nav__link active" : "nav__link")}><li>Home</li></NavLink>
            <NavLink to="/products" className={({ isActive }) => (isActive ? "nav__link active" : "nav__link")}><li>Products</li></NavLink>
            <NavLink to="/about" className={({ isActive }) => (isActive ? "nav__link active" : "nav__link")}><li>About</li></NavLink>
            <NavLink to="/contact" className={({ isActive }) => (isActive ? "nav__link active" : "nav__link")}><li>Contact</li></NavLink>
          </ul>

          {/* MOBILE MENU BUTTON */}
          <div className="menu__btn">
            <FontAwesomeIcon onClick={toggleMenu} icon={faBars} />
          </div>

          {/* MOBILE MENU (UNCHANGED) */}
          <ul className="mobile__menu">

            <NavLink onClick={toggleMenu} to="/" className="mobile__menu--link"><li>Home</li></NavLink>
            <NavLink onClick={toggleMenu} to="/products" className="mobile__menu--link"><li>Products</li></NavLink>
            <NavLink onClick={toggleMenu} to="/about" className="mobile__menu--link"><li>About</li></NavLink>
            <NavLink onClick={toggleMenu} to="/contact" className="mobile__menu--link"><li>Contact</li></NavLink>

            <li onClick={toggleMenu} className="times__icon">
              <FontAwesomeIcon icon={faTimes} />
            </li>

          </ul>

        </div>
      </section>
    </>
  );
};

export default Nav;