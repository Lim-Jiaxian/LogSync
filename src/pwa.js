// Progressive Web App plumbing: service worker registration, update prompts and install prompts.
// Imported first thing in main.jsx so the browser's one-shot install event isn't missed.
import { registerSW } from "virtual:pwa-register";

const state = { needRefresh: false, canInstall: false };
const listeners = new Set();
const set = (patch) => {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn({ ...state }));
};
export const subscribe = (fn) => {
  listeners.add(fn);
  fn({ ...state });
  return () => listeners.delete(fn);
};

/* ---------- install (Chrome, Edge, Samsung Internet; iOS has no prompt, see IosInstallHint) ---------- */
let deferredPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // show our own button instead of the browser's mini-infobar
  deferredPrompt = e;
  set({ canInstall: true });
});
window.addEventListener("appinstalled", () => {
  deferredPrompt = null;
  set({ canInstall: false });
});
export const install = async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice.catch(() => {});
  deferredPrompt = null;
  set({ canInstall: false });
};

/* ---------- updates ---------- */
// A new deploy installs in the background; we ask before switching, so nobody loses a half-done form.
let registration = null;
const updateSW = registerSW({
  onNeedRefresh: () => set({ needRefresh: true }),
  onRegisteredSW: (url, reg) => {
    registration = reg || null;
  },
});
const checkForUpdate = () => {
  if (registration && navigator.onLine) registration.update().catch(() => {});
};
// Installed apps can stay open for a whole shift: check when brought back to the front, and hourly.
document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && checkForUpdate());
setInterval(checkForUpdate, 60 * 60 * 1000);

export const applyUpdate = () => updateSW(true);
export const dismissUpdate = () => set({ needRefresh: false });

/* ---------- environment ---------- */
export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
export const isIOS = () =>
  /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
