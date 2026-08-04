import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./context/AuthContext";
import { ConfirmProvider } from "./context/ConfirmContext";
import { ToastProvider } from "./context/ToastContext";

// HashRouter (URLs como /#/pagamentos) em vez de BrowserRouter: o GitHub Pages
// não sabe reescrever rotas para index.html, então o roteamento client-side
// via hash evita 404 em recarregamentos/links diretos.
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <HashRouter>
      <AuthProvider>
        <ToastProvider>
          <ConfirmProvider>
            <App />
          </ConfirmProvider>
        </ToastProvider>
      </AuthProvider>
    </HashRouter>
  </StrictMode>
);
