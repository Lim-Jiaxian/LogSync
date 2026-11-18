
import React, { useState } from "react";

export default function Login() {

  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("http://localhost:3000/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
  setError("Invalid username and/or password.");
  return;
}
      // Save logged-in user details
      const userData = JSON.stringify(data.user);

      // Clear previous login data
      localStorage.removeItem("logsyncUser");
      sessionStorage.removeItem("logsyncUser");

      if (remember) {
        localStorage.setItem("logsyncUser", userData);
      } else {
        sessionStorage.setItem("logsyncUser", userData);
      }

      alert(`Welcome, ${data.user.username}!`);

      console.log("Logged-in user:", data.user);

      // Redirect to the app route, which renders js/App.js.
      window.location.href = "/home";

    } catch (error) {
      console.error("Login error:", error);
      setError(
        "Cannot connect to the server. Please check if the backend is running."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={styles.page}>
      <section style={styles.card}>

        {/* Logo */}
        <div style={styles.logo}>
          <div style={styles.logoIcon}>L</div>
          <h2>LogSync</h2>
        </div>

        {/* Heading */}
        <div style={styles.heading}>
          <h1 style={styles.title}>Welcome Back</h1>
          <p style={styles.description}>
            Sign in to access your LogSync account.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} style={styles.form}>

          {/* Username */}
          <label style={styles.label} htmlFor="username">
            Username
          </label>

          <input
            style={styles.input}
            id="username"
            name="username"
            type="text"
            placeholder="Enter your username"
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            required
          />

          {/* Password */}
          <label style={styles.label} htmlFor="password">
            Password
          </label>

          <div style={styles.passwordWrapper}>
            <input
              style={styles.passwordInput}
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />

            <button
              type="button"
              style={styles.showButton}
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>

          {/* Remember Me & Forgot Password */}
          <div style={styles.options}>
            <label style={styles.remember}>
              <input
                type="checkbox"
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
              />
              Remember me
            </label>

            <span style={{ ...styles.link, opacity: 0.5 }}>
              Forgot password?
            </span>
          </div>

          {/* Error Message */}
          {error && (
            <div style={styles.error} role="alert">
              {error}
            </div>
          )}

          {/* Login Button */}
          <button
            type="submit"
            style={{
              ...styles.loginButton,
              opacity: loading ? 0.7 : 1,
            }}
            disabled={loading}
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>

        </form>

        {/* Footer */}
        <div style={styles.footer}>
          <p>LogSync - Equipment Management System</p>
        </div>

      </section>
    </main>
  );
}

// CSS Styles (uses the same variables as styles.css, so dark mode works too)
const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px",
    background: "var(--bg)",
    color: "var(--ink)",
    fontFamily: "Barlow, system-ui, sans-serif",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "40px",
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderTop: "4px solid var(--red)",
    borderRadius: "4px",
    boxSizing: "border-box",
  },

  logo: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    marginBottom: "30px",
    color: "var(--ink)",
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    fontSize: "22px",
    fontWeight: 700,
  },

  logoIcon: {
    width: "38px",
    height: "38px",
    background: "var(--red)",
    color: "#ffffff",
    borderRadius: "4px",
    display: "grid",
    placeItems: "center",
    fontSize: "23px",
    fontWeight: "bold",
  },

  heading: {
    textAlign: "center",
    marginBottom: "30px",
  },

  title: {
    margin: "0 0 8px",
    color: "var(--ink)",
    fontFamily: "'Barlow Condensed', 'Arial Narrow', sans-serif",
    fontSize: "30px",
    fontWeight: 700,
  },

  description: {
    margin: 0,
    color: "var(--mute)",
    fontSize: "14px",
    lineHeight: 1.5,
  },

  form: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  label: {
    fontSize: "13px",
    fontWeight: "600",
    color: "var(--ink)",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid var(--line)",
    background: "var(--surface)",
    color: "var(--ink)",
    borderRadius: "4px",
    fontSize: "15px",
    fontFamily: "inherit",
    boxSizing: "border-box",
    marginBottom: "8px",
    // no outline:none, so the yellow keyboard focus ring still shows
  },

  passwordWrapper: {
    display: "flex",
    border: "1px solid var(--line)",
    background: "var(--surface)",
    borderRadius: "4px",
    marginBottom: "8px",
  },

  passwordInput: {
    flex: 1,
    minWidth: 0,
    padding: "10px 12px",
    border: "none",
    fontSize: "15px",
    fontFamily: "inherit",
    color: "var(--ink)",
    background: "transparent",
  },

  showButton: {
    border: "none",
    background: "transparent",
    color: "var(--red)",
    padding: "0 12px",
    cursor: "pointer",
    fontWeight: "600",
  },

  options: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
    margin: "5px 0 12px",
    flexWrap: "wrap",
    gap: "10px",
  },

  remember: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    color: "var(--mute)",
  },

  link: {
    color: "var(--red)",
    textDecoration: "none",
  },

  error: {
    padding: "10px 12px",
    background: "var(--bg)",
    borderLeft: "4px solid var(--bad)",
    color: "var(--bad)",
    fontSize: "13px",
  },

  loginButton: {
    width: "100%",
    padding: "12px",
    background: "var(--red)",
    color: "#ffffff",
    border: "1px solid var(--red)",
    borderRadius: "4px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "5px",
  },

  footer: {
    textAlign: "center",
    fontSize: "12px",
    color: "var(--mute)",
    marginTop: "30px",
    borderTop: "1px solid var(--line)",
    paddingTop: "18px",
  },
};