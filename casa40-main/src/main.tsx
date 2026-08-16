import { createRoot } from "react-dom/client";
import * as Sentry from "@sentry/react";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import "./index.css";

// Inert until VITE_SENTRY_DSN is set as a Railway build var (Vite inlines
// VITE_* at build time, same as VITE_API_URL).
if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
  });
}

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);
