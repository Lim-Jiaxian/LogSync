import React, { useEffect, useState } from "react";
import { applyUpdate, dismissUpdate, install, isIOS, isStandalone, subscribe } from "./pwa.js";

export function usePwa() {
  const [s, setS] = useState({ needRefresh: false, canInstall: false });
  useEffect(() => subscribe(setS), []);
  return s;
}

// Full-width bar at the top of the page when a new version has been downloaded.
export function UpdateBanner() {
  const { needRefresh } = usePwa();
  if (!needRefresh) return null;
  return (
    <div className="notice update" role="status">
      <span>A new version of LogSync is ready.</span>
      <span className="row" style={{ gap: 8 }}>
        <button onClick={dismissUpdate}>Later</button>
        <button className="primary" onClick={applyUpdate}>
          Refresh now
        </button>
      </span>
    </div>
  );
}

// Shown only when the browser says the app can be installed and it isn't already.
export function InstallButton({ className = "" }) {
  const { canInstall } = usePwa();
  if (!canInstall || isStandalone()) return null;
  return (
    <button className={className} onClick={install}>
      <DownloadIcon /> Install app
    </button>
  );
}

const HINT_KEY = "logsync:ios-hint-dismissed";
// iPhone/iPad Safari has no install prompt, so explain the two taps it takes.
export function IosInstallHint() {
  const [hidden, setHidden] = useState(() => {
    try {
      return isStandalone() || !isIOS() || localStorage.getItem(HINT_KEY) === "1";
    } catch {
      return true;
    }
  });
  if (hidden) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(HINT_KEY, "1");
    } catch {}
    setHidden(true);
  };
  return (
    <div className="hint" role="note">
      <ShareIcon />
      <span>
        <b>Install LogSync on this iPhone:</b> tap <b>Share</b> in Safari, then <b>Add to Home Screen</b>.
      </span>
      <button className="x" aria-label="Dismiss install tip" onClick={dismiss}>
        ×
      </button>
    </div>
  );
}

const ShareIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3v12M8 7l4-4 4 4M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1" />
  </svg>
);
const DownloadIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: "-3px" }}>
    <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
  </svg>
);
