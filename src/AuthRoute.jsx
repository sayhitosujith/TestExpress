import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function AuthRoute({ children }) {
  const location = useLocation();
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!isLoggedIn) {
    return <Navigate to="/Customer_Login" replace state={{ from: location }} />;
  }
  return children;
}
