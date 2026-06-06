import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import App from "./App";
import { EnvProvider } from "./env";
import { LocaleProvider } from "./i18n";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <HashRouter>
      <LocaleProvider>
        <EnvProvider>
          <App />
        </EnvProvider>
      </LocaleProvider>
    </HashRouter>
  </React.StrictMode>,
);
