import React from "react";
import ReactDOM from "react-dom/client";
import TheRail from "./TheRail.jsx";

// Polyfill for window.storage — the artifact persistence API from Claude.
// Outside Claude, we back it with localStorage so items still save
// in the browser between visits.
if (!window.storage) {
  window.storage = {
    async get(key) {
      const raw = localStorage.getItem(key);
      if (raw === null) return null;
      return { key, value: raw, shared: false };
    },
    async set(key, value) {
      localStorage.setItem(key, value);
      return { key, value, shared: false };
    },
    async delete(key) {
      localStorage.removeItem(key);
      return { key, deleted: true, shared: false };
    },
    async list(prefix) {
      const keys = Object.keys(localStorage).filter((k) => !prefix || k.startsWith(prefix));
      return { keys, prefix, shared: false };
    },
  };
}

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <TheRail />
  </React.StrictMode>
);
