import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { useApp } from "./state/store";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Dev-only test hook (used by the in-browser verification harness).
if (import.meta.env.DEV) {
  (window as unknown as { __duct: unknown }).__duct = { useApp };
}
