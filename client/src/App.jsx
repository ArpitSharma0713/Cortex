import React, { useState } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Register from "./pages/Register";
import "./styles.css";

function App() {
  const [auth, setAuth] = useState({
    accessToken: "",
    user: null,
  });

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<Home />} path="/" />
        <Route element={<Register setAuth={setAuth} />} path="/register" />
        <Route element={<Login setAuth={setAuth} />} path="/login" />
        <Route
          element={<Dashboard auth={auth} setAuth={setAuth} />}
          path="/dashboard"
        />
        <Route element={<Navigate replace to="/" />} path="*" />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
