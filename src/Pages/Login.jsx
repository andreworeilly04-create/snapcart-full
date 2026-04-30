import React, { useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { useNavigate } from "react-router-dom";
import { registerUser, loginUser } from "../Firebase";
import "./Login.css";

const Login = ({ setUser, showPassword, setShowPassword }) => {
  const navigate = useNavigate();
  const [showRegister, setShowRegister] = useState(false);

  // LOGIN STATE
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // REGISTER STATE
  const [regEmail, setRegEmail] = useState("");
  const [regPassword, setRegPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");

  // =========================
  // 🔐 LOGIN
  // =========================
  const handleLoginSubmit = async (e) => {
    e.preventDefault();

    try {
      const result = await loginUser(loginEmail, loginPassword);

      if (result.success) {
        toast.success("Logged in successfully!");

        setUser(result.user);
        localStorage.setItem("user", JSON.stringify(result.user));

        navigate("/");
      } else {
        toast.error(result.error || "Login failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong during login");
    }
  };

  // =========================
  // 🧾 REGISTER
  // =========================
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();

    if (regPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    try {
      const result = await registerUser(
        regEmail,
        regPassword,
        firstName,
        lastName
      );

      if (result.success) {
        toast.success("Account created successfully!");

        setUser(result.user);
        localStorage.setItem("user", JSON.stringify(result.user));

        navigate("/");
      } else {
        toast.error(result.error || "Registration failed");
      }
    } catch (error) {
      console.error(error);
      toast.error("Something went wrong during registration");
    }
  };

  return (
    <section id="login_or_register">

      <div className="login__container">
        <h3 className="login__title">Login or Create Account</h3>
      </div>

      {/* ========================= */}
      {/* 🔐 LOGIN FORM */}
      {/* ========================= */}
      <form onSubmit={handleLoginSubmit} className="login__field">
        <h3 className="login__title">Login</h3>

        <input
        className="email"
          type="email"
          placeholder="Email"
          value={loginEmail}
          onChange={(e) => setLoginEmail(e.target.value)}
          required
        />

        <input
        className="password"
          type={showPassword ? "text" : "password"}
          placeholder="Password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          required
        />

         <button type="button" className="toggle-btn" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? "Hide Password" : "Show Password"}
        </button>

        <button className="login__btn">Login</button>
      </form>

      {/* ========================= */}
      {/* SWITCH */}
      {/* ========================= */}
      <div className="forgot_or_register--container">
        <p className="forgot_password">Forgot Password</p>

        <p
          onClick={() => setShowRegister(true)}
          className="register_account"
        >
          Create account
        </p>
      </div>

      {/* ========================= */}
      {/* 🧾 REGISTER FORM */}
      {/* ========================= */}
      <form
        onSubmit={handleRegisterSubmit}
        className={`register__field ${showRegister ? "active" : ""}`}
      >
        <h3 className="register__title">Create Account</h3>

        <input
          type="text"
          className="first_name"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />

        <input
          type="text"
          className="last_name"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />

        <input
          type="email"
          className="email"
          placeholder="Email"
          value={regEmail}
          onChange={(e) => setRegEmail(e.target.value)}
          required
        />

        
        <input
          type={showPassword ? "text" : "password"}
          className="password"
          placeholder="Password"
          value={regPassword}
          onChange={(e) => setRegPassword(e.target.value)}
          required
        />
          
        <input
          type={showPassword ? "text" : "password"}
          className="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />

          <button type="button" className="toggle-btn" onClick={() => setShowPassword(!showPassword)}>
          {showPassword ? "Hide Password" : "Show Password"}
        </button>

        <button className="register__btn">Register</button>

        <p
          onClick={() => setShowRegister(false)}
          className="already_created"
        >
          <b>Already have an account?</b> Login
        </p>
      </form>

      
    </section>
  );
};

export default Login;