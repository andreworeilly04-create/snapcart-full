import React, { useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom';
import { faStar as faStarRegular } from '@fortawesome/free-regular-svg-icons'
import './Product.css'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faStarHalfAlt, faStar, faArrowLeft } from '@fortawesome/free-solid-svg-icons';
import { ToastContainer, toast } from 'react-toastify';

const Product = ({ AllProducts, addToCart, cart, isLoggedIn }) => {

     const { productId } = useParams();

     const navigate = useNavigate();

     const product = AllProducts.find((p) => String(p.id) === String(productId));

     const [selectedSize, setSelectedSize] = useState("");

     const isInCart = cart.some((item) => {if (product.category === 'CLOTHING') {
        return item.id === product.id && item.size === selectedSize;
     } else {
        return item.id === product.id
     }
    });

      
    const handleAddToCart = () => {

        if (isInCart) {
            navigate('/cart');
            return;
        }
    

        if (product.category === 'CLOTHING' && !selectedSize) {
            toast.error("Please select a size first!");
            return;
        }

        const itemToAdd = {
            ...product,
            size: product.category === 'CLOTHING' ? selectedSize : null,
        };
        addToCart(itemToAdd);
    };


    if (!product) return <div>Product not found!</div>;





    return (
        <section id="product">
            <div className="back__container">
                <Link to="/products"><button className="back_btn"><FontAwesomeIcon icon={faArrowLeft} /></button></Link><p className="back">Back</p>
            </div>
            <div className="product__container">
                <img className="product_image" src={product.image} alt={product.name} />
                <h1 className="product__name">{product.name}</h1>
                <h2 className="product__price">${product.price.toFixed(2)}</h2>
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
                <div className="product__description--container">
                    <p className="product__description">{product.description}</p>
                </div>
                {product.category === 'CLOTHING' && (
                    <div className="size-selector">
                        <p className="select_size">Select Size</p>
                        <div className="size-buttons">
                            {['S', 'M', 'L', 'XL', 'XXL'].map((size) => (
                                <button key={size} type="button" className={`size-btn ${selectedSize === size ? 'active' : ''}`}
                                    onClick={() => setSelectedSize(size)}>{size}</button>
                            ))}
                        </div>
                    </div>
                )}




                <button disabled={!isLoggedIn} className="btn" onClick={handleAddToCart}>{!isLoggedIn ? "Log in to Add" : (isInCart ? "View Cart" : "Add To Cart")} </button>
            </div>


            <div className="related__products--container">
                <h3 className="related__products--title">Related Products</h3>
                <div className="products">

                    {AllProducts.filter((item) => item.category === product.category && item.id !== product.id).slice(0, 4).map((product) => (
                        <div className="product__card" key={product.id}>
                            <figure className="product__item">
                                <Link to={`/product/${product.id}`}><img className="product" src={product.image} alt={product.name} /> </Link>
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


    )
}


export default Product