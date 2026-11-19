
import React, { useEffect, useState } from "react";
import { getToken, setToken } from "../../js/api.js";
import { isStandalone } from "../pwa.js";
import { InstallButton, IosInstallHint, UpdateBanner } from "../PwaUI.jsx";

export default function Login() {

  const [showPassword, setShowPassword] = useState(false);
  // In the installed app, staying signed in is the expected behaviour (closing it clears sessionStorage).
  const [remember, setRemember] = useState(isStandalone);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Already signed in (e.g. reopening the installed app with "Remember me"): go straight in.
  // An expired token is cleared by the app's first 401, which sends the user back here.
  useEffect(() => {
    if (getToken()) window.location.replace("/home");
  }, []);

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    let response;
    try {
      response = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password, remember }),
      });
    } catch (error) {
      console.error("Login error:", error);
      setError("Cannot connect to the server. Please check your connection and try again.");
      setLoading(false);
      return;
    }

    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.token) {
      setError(data.message || "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }

    // js/api.js reads the token from storage. "Remember me" keeps it after the app is closed.
    setToken(data.token, remember);
    window.location.replace("/home");
  }

  return (
    <div className="page-top">
    <UpdateBanner />
    <main style={styles.page}>
      <section style={styles.card}>

        {/* Logo */}
        <div style={styles.logo}>
          <img src="/favicon.svg" alt="" width="40" height="40" />
          <h2 style={{ margin: 0 }}>LogSync</h2>
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
              required
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

        {/* Install the app (shown only where the browser supports it) */}
        <div style={styles.install}>
          <InstallButton className="install-btn" />
          <IosInstallHint />
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          <p style={{ margin: 0 }}>LogSync - Equipment Management System</p>
        </div>

      </section>
    </main>
    </div>
  );
}

// CSS Styles (uses the same variables as styles.css, so dark mode works too)
const styles = {
  page: {
    minHeight: "calc(100dvh - env(safe-area-inset-top, 0px))",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "20px max(16px, env(safe-area-inset-right, 0px)) 20px max(16px, env(safe-area-inset-left, 0px))",
    background: "var(--bg)",
    color: "var(--ink)",
    fontFamily: "Barlow, system-ui, sans-serif",
    boxSizing: "border-box",
  },

  card: {
    width: "100%",
    maxWidth: "420px",
    padding: "clamp(24px, 7vw, 40px)",
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

  install: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "18px",
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