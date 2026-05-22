import React from "react";
import ReactDOM from "react-dom/client";
import "./app/globals.css";
import App from "./App";
import { AppProviders } from "./app/providers/AppProviders";
import { RtlProvider } from "./app/providers/RtlProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RtlProvider>
      <AppProviders>
        <App />
      </AppProviders>
    </RtlProvider>
  </React.StrictMode>,
);
