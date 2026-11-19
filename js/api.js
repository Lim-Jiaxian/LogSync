// Same-origin API: the Express server serves the built app in production,
// and Vite proxies /api to it in development (see vite.config.js).
const KEY = "token";
const SNAPSHOT = "logsync:snapshot";
const stores = () => [sessionStorage, localStorage];

export const getToken = () => {
  try {
    return sessionStorage.getItem(KEY) || localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

// "Remember me" keeps the token in localStorage, so it survives closing the tab or the installed app.
export const setToken = (token, remember) => {
  clearSession();
  (remember ? localStorage : sessionStorage).setItem(KEY, token);
};

// Wherever the token lives, so a session-only login doesn't leave data behind in localStorage.
const sessionStore = () => {
  try {
    return localStorage.getItem(KEY) ? localStorage : sessionStorage;
  } catch {
    return null;
  }
};

const clearSession = () => {
  for (const s of stores()) {
    try {
      s.removeItem(KEY);
      s.removeItem(SNAPSHOT);
      s.removeItem("logsyncUser"); // left behind by older versions of the login page
    } catch {}
  }
};

// Last data the user loaded, so the installed app can still show the station's state offline.
// It belongs to the signed-in user and is removed at logout or the next login.
export const saveSnapshot = (data) => {
  try {
    sessionStore()?.setItem(SNAPSHOT, JSON.stringify({ savedAt: Date.now(), data }));
  } catch {} // storage full or blocked: offline view just won't be available
};
export const loadSnapshot = () => {
  try {
    const s = JSON.parse(sessionStore()?.getItem(SNAPSHOT) || "null");
    return s?.data?.me ? s : null;
  } catch {
    return null;
  }
};

export const logout = () => {
  const token = getToken();
  if (token)
    fetch("/api/logout", { method: "POST", headers: { Authorization: "Bearer " + token }, keepalive: true }).catch(
      () => {},
    );
  clearSession();
  window.location.href = "/";
};

// body may be a plain object (sent as JSON) or FormData (sent as multipart, for file uploads).
// Network failures throw an Error with .offline = true, so callers can fall back to saved data.
export async function api(path, method = "GET", body) {
  const isForm = body instanceof FormData;
  const headers = { Authorization: "Bearer " + getToken() };
  if (body && !isForm) headers["Content-Type"] = "application/json";

  let res;
  try {
    res = await fetch(path, { method, headers, body: isForm ? body : body ? JSON.stringify(body) : undefined });
  } catch {
    throw Object.assign(new Error("You’re offline, so nothing was saved. Try again when you’re connected."), {
      offline: true,
    });
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401) {
    logout();
    throw new Error(data.message || "Please log in again.");
  }
  if (!res.ok) throw new Error(data.message || "Something went wrong.");
  return data;
}
