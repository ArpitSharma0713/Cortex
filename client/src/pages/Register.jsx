import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import api from "../api/axiosInstance";

function Register({ setAuth }) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleChange(event) {
    setForm((currentForm) => ({
      ...currentForm,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await api.post("/auth/register", {
        email: form.email,
        password: form.password,
        fullName: form.fullName || undefined,
      });
      setAuth({
        accessToken: response.data.accessToken,
        user: response.data.user,
      });
      navigate("/dashboard");
    } catch (requestError) {
      setError(requestError.response?.data?.error || "Registration failed");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-panel">
        <h1>Register</h1>
        <form onSubmit={handleSubmit}>
          <label>
            Full name
            <input
              autoComplete="name"
              name="fullName"
              onChange={handleChange}
              type="text"
              value={form.fullName}
            />
          </label>
          <label>
            Email
            <input
              autoComplete="email"
              name="email"
              onChange={handleChange}
              required
              type="email"
              value={form.email}
            />
          </label>
          <label>
            Password
            <input
              autoComplete="new-password"
              minLength={8}
              name="password"
              onChange={handleChange}
              required
              type="password"
              value={form.password}
            />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button disabled={isSubmitting} type="submit">
            {isSubmitting ? "Creating account..." : "Register"}
          </button>
        </form>
        <a className="secondary-button" href={`${import.meta.env.VITE_API_URL}/auth/google`}>
          Continue with Google
        </a>
        <p>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </section>
    </main>
  );
}

export default Register;
