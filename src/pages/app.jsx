
import React from "react";
import Login from "./pages/login";
import Home from "./pages/home";

function App() {
  const currentPage = window.location.pathname;

  // Check whether the user has logged in
  const userData =
    localStorage.getItem("logsyncUser") ||
    sessionStorage.getItem("logsyncUser");

  const isLoggedIn = !!userData;

  // Force users who are not logged in to the login page
  if (!isLoggedIn && currentPage !== "/login") {
    window.location.replace("/login");
    return null;
  }

  // If logged in, visiting the login page redirects home
  if (isLoggedIn && currentPage === "/login") {
    window.location.replace("/home");
    return null;
  }

  // Display login page
  if (currentPage === "/login") {
    return <Login />;
  }

  // Display home page
  return <Home />;
}

export default App;
