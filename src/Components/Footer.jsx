import React from 'react'
import { Link } from 'react-router-dom'
import snapcart from '../assets/SnapCart.svg'
import applestore from '../assets/AppleStore.png'
import googleplay from '../assets/GooglePlay.png'
import './Footer.css'

const Footer = () => {
  return (
    <>
    <section id="footer">
        <div className="footer__container">
            <figure className="footer__logo">
               <Link to="/"><img className="footer__logo--img" src={snapcart} alt="Footer Logo" /></Link> 
            </figure>
        </div>
        <ul className="footer__links">
            <Link to="/"><li className="footer__link">
                Home
            </li></Link>
            <Link to="/products"><li className="footer__link">
                Products
            </li></Link>
            <Link to="/about"><li className="footer__link">
                About
            </li></Link>
            <Link to="/contact"><li className="footer__link">
                Contact
            </li></Link>
        </ul>
        <div className="app__store--container">
        <figure className="app__store">
            <img className="google__play" src={googleplay} alt="Google Play" />
        </figure>
        <figure className="app__store">
            <img className="apple__store" src={applestore} alt="Apple Store" />
        </figure>
        </div>
        <p className="footer__copyright">
           &copy; Copyright 2026 SnapCart All Rights Reserved
        </p>
    </section>
    </>
  )
}

export default Footer