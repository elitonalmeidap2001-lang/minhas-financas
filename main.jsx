import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./styles.css";

// The original prototype used a host-provided storage API. This adapter makes
// the same app persist independently in any modern browser.
window.storage ??= {
  async get(key) { return { value: window.localStorage.getItem(key) }; },
  async set(key, value) { window.localStorage.setItem(key, value); },
};

createRoot(document.getElementById("root")).render(
  <React.StrictMode><App /></React.StrictMode>
);
