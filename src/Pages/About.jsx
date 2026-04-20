import React from 'react'
import './About.css'
import aboutImg from '../assets/About_img.jpg'

const About = () => {
  return (
    <>
       <section id="about">
        <div className="about__container">
          <h3 className="about__title">About Us</h3>
          </div>
          <div className="about__description--container">
          <figure className="about__img--container">
            <img className="about__img" src={aboutImg} alt="About" />
          </figure>
          <div className="about__text">
          <p className="about__paragraph">Snapcart is a user-friendly e-commerce website designed for fast and convenient online shopping. It features a clean interface with easy navigation through sections like Home, Products, About, and Contact. Users can browse items, add them to a cart, and complete purchases smoothly. Snapcart focuses on simplicity, accessibilty, and a seamless shopping experience across devices.</p>
          <h3 className="why_choose_us">Why Choose Snap<span>Cart</span></h3>
          <div className="features">
            <div className="feature-box">
              <h3>24/7 Customer Support</h3>
              <p>Our Support team is available around the clock to help you with aby questions or issues.</p>
            </div>
             <div className="feature-box">
              <h3>Fast Delivery</h3>
              <p>Quick and reliable shipping.</p>
            </div>
             <div className="feature-box">
              <h3>Secure Payments</h3>
              <p>Your transactions are safe with us.</p>
            </div>
          </div>
          </div>
        </div>
       </section>
    </>
  )
}

export default About