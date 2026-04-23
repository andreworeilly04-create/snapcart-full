import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../Firebase';
import { toast } from 'react-toastify';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, where, onSnapshot } from 'firebase/firestore';
import './Orders.css';

const Orders = () => {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let unsubscribeSnapshot = null;

        const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
            if (user) {
                const q = query(
                    collection(db, "orders"),
                    where("userId", "==", user.uid),
                    orderBy("createdAt", "desc")
                );

                // 🔥 REAL-TIME LISTENER
                unsubscribeSnapshot = onSnapshot(q,
                    (snapshot) => {
                        const ordersList = snapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));

                        setOrders(ordersList);
                        setLoading(false);
                    },
                    (error) => {
                        console.error(error);
                        toast.error("Error fetching orders");
                        setLoading(false);
                    }
                );

            } else {
                setOrders([]);
                setLoading(false);
                toast.error("Please log in to see orders");
            }
        });

        return () => {
            if (unsubscribeSnapshot) unsubscribeSnapshot();
            unsubscribeAuth();
        };
    }, []);

    return (
        <section id="orders">
            <div className="orders__title--container">
                <h3 className="orders__title">Your Orders</h3>

                {loading ? (
                    <h3 className="loading">Loading orders...</h3>
                ) : orders.length === 0 ? (
                    <div className="empty_orders--container">
                        <h3 className="empty__orders">You don't have any orders yet</h3>
                        <Link to="/products">
                            <button className="browse__btn--orders">Browse Products</button>
                        </Link>
                    </div>
                ) : (
                    <div className="orders_list">
                        {orders.map((order) => (
                            <div key={order.id} className="order_card">

                                {/* ✅ STATUS (once per order) */}
                                <p className="order_status">
                                    Status: <strong>{order.status}</strong>
                                </p>

                                {/* ✅ SAFE DATE */}
                                <p>
                                    Order Date:{" "}
                                    {order.createdAt
                                        ? new Date(order.createdAt.seconds * 1000).toLocaleDateString()
                                        : "Processing..."}
                                </p>

                                {/* ✅ ITEMS */}
                                {order.items?.map((item, index) => (
                                    <div key={index} className="order_item--detail">
                                        <img
                                            src={item.image}
                                            alt={item.name}
                                            className="order_item--img"
                                        />
                                        <div>
                                            <p>{item.name}</p>
                                            <p>
                                                Qty: {item.quantity} × ${Number(item.price).toFixed(2)}
                                            </p>
                                        </div>
                                    </div>
                                ))}

                                {/* ✅ TOTAL */}
                                <p className="order_total">
                                    Total: ${Number(order.amount || 0).toFixed(2)}
                                </p>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </section>
    );
};

export default Orders;