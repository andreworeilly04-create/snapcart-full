import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { signOut } from "firebase/auth";

// 🔥 YOUR FIREBASE CONFIG (replace if needed)
const firebaseConfig = {
  apiKey: "AIzaSyBTlFKbHFh3_LO8ZfbrtFursbUlL8EzRe8",
  authDomain: "snapcart-117d8.firebaseapp.com",
  projectId: "snapcart-117d8",
  storageBucket: "snapcart-117d8.firebasestorage.app",
  messagingSenderId: "927278879326",
  appId: "1:927278879326:web:68301ef216df66fd1cdacf",
  measurementId: "G-HPE1M0YKLX",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Auth + Firestore
export const auth = getAuth(app);
export const db = getFirestore(app);

//
// ✅ LOGIN FUNCTION (FIXED)
//
export const loginUser = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);

    return {
      success: true,
      user: userCredential.user,
    };

  } catch (error) {
    console.error("LOGIN ERROR:", error.code, error.message);

    return {
      success: false,
      error: error.message,
    };
  }
};


export const logoutUser = async () => {
  try {
    await signOut(auth);
    return { success: true };
    
  } catch (error) {
    console.error("LOGOUT ERROR:", error.message);
    return { success: false, error: error.message };
  }
};

//
// ✅ REGISTER FUNCTION (FIXED)
//
export const registerUser = async (email, password, firstName, lastName) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);

    const user = userCredential.user;

    // Save extra user info in Firestore
    await setDoc(doc(db, "users", user.uid), {
      uid: user.uid,
      email,
      firstName,
      lastName,
      createdAt: new Date()
    });

    return {
      success: true,
      user,
    };

  } catch (error) {
    console.error("REGISTER ERROR:", error.code, error.message);

    return {
      success: false,
      error: error.message,
    };
  }
};