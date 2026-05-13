import React from 'react'
import './Header.css'

const Header = () => {
  return (
    <>
    <section id="header">
        <div className="header__container">
            <h1 className="header__title">
                Find Amazing Products with the Best Deals
            </h1>
            <a href="#features"><button className="browse__btn">
                Browse Products
            </button></a>
        </div>
    </section>
    </>
  )
}

export default Header