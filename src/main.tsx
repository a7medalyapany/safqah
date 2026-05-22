import React from "react";
import ReactDOM from "react-dom/client";
import "./app/globals.css";
import App from "./App";
import { RtlProvider } from "./app/providers/RtlProvider";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <RtlProvider>
      <App />
    </RtlProvider>
  </React.StrictMode>,
);
