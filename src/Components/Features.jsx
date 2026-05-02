import React from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons'
import { faStar, faStarHalfAlt } from '@fortawesome/free-solid-svg-icons'
import { AllProducts } from '../data';
import './Features.css'
import { Link } from 'react-router-dom';



const Features = () => {
    return (
        <>
            <section id="features">
                <div className="feature__container">
                    <h2 className="feature__title">
                        View our featured products
                    </h2>
                </div>
                <div className="product__container">
                    <div className="products">
                        {AllProducts.slice(0, 4).map((product) => (
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
        </>

    )
}
export default Features