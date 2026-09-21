import React from "react";
import { Navigate, useLocation } from "react-router-dom";

export default function AuthRoute({ children }) {
  const location = useLocation();
  const isLoggedIn = localStorage.getItem("isLoggedIn") === "true";
  if (!isLoggedIn) {
    // "/Customer_Login" was a route this app no longer has, so this landed on
    // the catch-all and only reached login by accident -- and would have
    // stopped doing so the moment the catch-all changed.
    return <Navigate to="/my-app" replace state={{ from: location }} />;
  }
  return children;
}
