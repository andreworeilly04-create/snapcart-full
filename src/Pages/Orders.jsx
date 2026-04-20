import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../Firebase';
import { toast } from 'react-toastify';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, getDocs, orderBy, where, addDoc } from 'firebase/firestore';
import './Orders.css'

const Orders = ({ setCart, cart = [] }) => {

    const [orders, setOrders] = useState([]);
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                const fetchOrders = async () => {
                    try {
                        const q = query(
                            collection(db, "orders"),
                            where("userId", "==", user.uid),
                            orderBy("createdAt", "desc") 
                        );
                        const querySnapshot = await getDocs(q);

                        const ordersList = querySnapshot.docs.map(doc => ({
                            id: doc.id,
                            ...doc.data()
                        }));

                        setOrders(ordersList);
                    } catch (error) {
                        toast.error("Error fetching orders: " + error.message);
                    }
                };

                fetchOrders();
            } else {
                toast.error("Please log in to see orders");
            }
        });
              
        return () => unsubscribe(); 
    }, []);



   return (
  <>
    <section id="orders">
      <div className="orders__title--container">
        <h3 className="orders__title">Your Orders</h3>
        {orders.length === 0 ? (
            <div className="empty_orders--container">
                <h3 className="empty__orders">You don't have any orders yet</h3>
               <Link to="/products"><button className="browse__btn--orders">Browse Products</button></Link>
                </div>
        ) : (
            <div className="orders_list">
             {orders && orders.map((order) => (
          <div key={order.id} className="order_card">
            <p>Order Date: {new Date(order.createdAt?.seconds * 1000).toLocaleDateString()}</p>
            {order.items && order.items.map((item, index) => (
                <div key={index} className="order_item--detail">
                    <img src={item.image} alt={item.name} className="order_item--img" />
                    <div><p>{item.name}</p> <p>Qty: {item.quantity} x ${item.price}</p> <p>Status: {order.status}</p></div>
                    </div>
            ))}
            <p className="order_total">Total: ${Number(order.amount).toFixed(2)}</p>
      </div>
         ))}
         </div>
        )}
        </div>
    </section>
  </>
);
}


        

export default Orders;