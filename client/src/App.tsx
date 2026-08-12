import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import Contracts from "./pages/Contracts";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Payments from "./pages/Payments";
import Profile from "./pages/Profile";
import Properties from "./pages/Properties";
import Receipts from "./pages/Receipts";
import TenantHome from "./pages/TenantHome";
import Tenants from "./pages/Tenants";

// Quem ainda não fez login vê a landing page (apresentação + botão
// "Entrar") na raiz do site; qualquer outra rota exige login de verdade.
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) {
    if (location.pathname === "/") return <Landing />;
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

// Depois do login, inquilinos e administradores veem telas completamente
// diferentes — o RLS do banco já restringe o que cada um consegue ler, mas
// aqui a gente evita nem tentar renderizar/navegar para as rotas de
// administração quando quem está logado é um inquilino.
function RoleRouter() {
  const { isTenant } = useAuth();

  if (isTenant) {
    return (
      <Routes>
        <Route path="/" element={<TenantHome />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="imoveis" element={<Properties />} />
        <Route path="inquilinos" element={<Tenants />} />
        <Route path="contratos" element={<Contracts />} />
        <Route path="pagamentos" element={<Payments />} />
        <Route path="recibos" element={<Receipts />} />
        <Route path="perfil" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/*"
        element={
          <RequireAuth>
            <RoleRouter />
          </RequireAuth>
        }
      />
    </Routes>
  );
}
