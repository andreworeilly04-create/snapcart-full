import React, { useState } from 'react'
import { faStar, faStarHalfAlt, faSearch, faTimes } from '@fortawesome/free-solid-svg-icons'
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons'
import { AllProducts } from '../data'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Link } from 'react-router-dom';

import './Products.css'

const Products = ({ toggleSearch, isInputOpen, handleSearch, searchTerm, }) => {

  const [filter, setFilter] = useState("");

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };



  const sortedProducts =
    [...AllProducts].sort((a, b) => {
      if (filter === 'LOW_TO_HIGH') {
        return (a.price || a.oldPrice) - (b.price || b.oldPrice)
      }
      if (filter === 'HIGH_TO_LOW') {
        return (b.price || b.oldPrice) - (a.price || a.oldPrice)
      }

      if (filter === 'RATING') {
        return b.rating - a.rating
      } return 0;
    });

  const filteredProducts = sortedProducts.filter((product) => {
    if (!searchTerm) return true;
    return product.name.toLowerCase().includes(searchTerm);

  });

  const [category, setCategory] = useState("DEFAULT");

  const handleCategoryChange = (e) => {
  setCategory(e.target.value);
  };

  const categorizedProducts = sortedProducts.filter((product) => {
    return category === 'DEFAULT' || product.category === category;

  })
  .filter((product)=> {
    if (!searchTerm) return true;
    return product.name.toLowerCase().includes(searchTerm.toLowerCase());
  });

return (
  <section id="products">
    <div className="all__products--container">
      <h2 className="products__title">
        All Products
      </h2>
      <select onChange={handleFilterChange} id="filter" defaultValue="DEFAULT">
        <option value="DEFAULT" disabled>Sort by</option>
        <option value="LOW_TO_HIGH" >Sort by Low to High</option>
        <option value="HIGH_TO_LOW">Sort by High to Low</option>
        <option value="RATING">Sort by Rating</option>
      </select>
      <select onChange={handleCategoryChange} id="category" defaultValue="DEFAULT">
        <option value="DEFAULT" disabled>Categories</option>
        <option value="ELECTRONICS">Electronics</option>
        <option value="CLOTHING">Clothing</option>
        <option value="SPORTS">Sports</option>
        <option value="GAMES">Games</option>
        <option value="E_VEHICLES">E Vehicles</option>
        <option value="ACCESSORIES">Accessories</option>
      </select>
      <div className="input__container">
        <input onChange={handleSearch} className={`input ${isInputOpen ? "open" : ""}`} type="text" placeholder="Search for products..." />

        {isInputOpen ? (<FontAwesomeIcon onClick={toggleSearch} className="times" icon={faTimes} />) : (
          <FontAwesomeIcon onClick={toggleSearch} className="faSearch" icon={faSearch} />)}
      </div>
    </div>
    <div class="product__container">
      <div className="products">
        {categorizedProducts.map((product) => (
          <div className="product__card" key={product.id}>
            <figure className="product__item">
             <Link to={`/product/${product.id}`}><img className="product" src={product.image} alt={product.name} /></Link>
            </figure>
            <h3 className="product__name">
              {product.name}
            </h3>
            <del className="old_product__price">${product.oldPrice.toFixed(2)}</del>
            <p className="product__price">${product.price.toFixed(2)}</p>
            <div className="product__rating">
              {new Array(5).fill(0).map((_, index) => {
                const starValue = index + 1;
                if (starValue <= product.rating) {
                  return <FontAwesomeIcon key={index} icon={faStar} />;
                } else if (starValue - 0.5 <= product.rating) {
                  return <FontAwesomeIcon key={index} icon={faStarHalfAlt} />
                } else {
                  return <FontAwesomeIcon key={index} icon={faStarRegular} />;
                }
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);
};
export default Products;