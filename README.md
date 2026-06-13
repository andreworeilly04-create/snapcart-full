# SnapCart E-Commerce App

## Overview

SnapCart E-Commerce is a modern full-stack e-commerce platform built to deliver a fast, responsive, and user-friendly shopping experience across all devices. The project focuses on accessibility, secure payments, performance optimization, and overall customer convenience.

---

## Features

### 🌙 Dark Mode Support

SnapCart includes a fully integrated dark mode designed for users who browse at night, experience eye strain, or are sensitive to bright screens. This improves accessibility and creates a more comfortable shopping experience in low-light environments.

### 📱 Mobile Responsive Design

The platform is fully responsive and optimized for mobile devices since the majority of online shopping traffic comes from smartphones and tablets. Users can seamlessly browse, shop, and checkout on any screen size.

### 🔐 Firebase Authentication & Orders

Firebase is used for secure user authentication and order management. Users can create accounts, log in securely, and store order information reliably within the platform.

### 💳 Secure Stripe Payment Integration

SnapCart uses Stripe for secure online payments, while Express.js is used to set up backend payment routes and securely handle Stripe checkout sessions and payment processing.

### ❌ Cancel Order Feature

Users can cancel orders in case they accidentally place a purchase or simply change their mind. This feature improves flexibility and customer satisfaction.

### ⚡ Skeleton Loading Screens

Skeleton loading components were added to create a smoother user experience while data is loading. This reduces perceived wait times and keeps the interface visually engaging.

### 🔘 Interactive Button States

Buttons visually respond when users interact with them, providing better feedback and improving the overall usability and responsiveness of the application.

### 💵 Cash on Delivery Payment Option

SnapCart supports Cash on Delivery (COD) for users who do not have access to credit or debit cards and prefer to pay using cash upon receiving their order.

---

## Tech Stack

* React
* Firebase
* Express.js
* Node.js
* Stripe API
* Responsive CSS

---

## Installation & Setup

### Clone the Repository

```bash id="luan2y"
git clone https://github.com/andreworeilly04-create/snapcart-full.git
```

### Navigate Into the Project Folder

```bash id="4fnp49"
cd snapcart-full
```

### Install Dependencies

```bash id="8ffoz8"
npm install
```

### Start the Frontend

```bash id="odh3q2"
npm run dev
```

### Start the Backend Server

```bash id="m1p7xs"
npm start
```

---

## Environment Variables

Create a `.env` file in the root directory and add the following:

```env id="nz3595"
VITE_FIREBASE_API_KEY=AIzaSyBTlFKbHFh3_LO8ZfbrtFursbUlL8EzRe8
VITE_FIREBASE_AUTH_DOMAIN=snapcart-117d8.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=snapcart-117d8
VITE_FIREBASE_STORAGE_BUCKET=snapcart-117d8.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=927278879326
VITE_FIREBASE_APP_ID=1:927278879326:web:68301ef216df66fd1cdacf

STRIPE_SECRET_KEY=sk_test_51TN5bBIrDmLuYUPnUnG7XX0eLrcRjG2gU6PK2Z2drhoCTu5iv9lZCL4Wr5s5xof1rfOpFAAwHUQCwtIGhPtxAPOM00JBewP7b0
STRIPE_WEBHOOK_SECRET=whsec_Js243r7CM6xWLqKXHFpfHkRB74MeRdiw
```

---

## Goals of the Project

The main goal of SnapCart is to create an accessible, secure, and modern e-commerce experience that prioritizes user comfort, performance, and convenience across all devices.

---

## Future Improvements

* User order tracking
* Wishlist functionality
* Product reviews and ratings
* Email notifications
* AI-powered product recommendations
* Multi-language support

---

## Author

Built and developed by Andrew O'Reilly.

