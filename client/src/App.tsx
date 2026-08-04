import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import { useAuth } from "./context/AuthContext";
import Contracts from "./pages/Contracts";
import Dashboard from "./pages/Dashboard";
import Login from "./pages/Login";
import Payments from "./pages/Payments";
import Properties from "./pages/Properties";
import Receipts from "./pages/Receipts";
import Tenants from "./pages/Tenants";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="imoveis" element={<Properties />} />
        <Route path="inquilinos" element={<Tenants />} />
        <Route path="contratos" element={<Contracts />} />
        <Route path="pagamentos" element={<Payments />} />
        <Route path="recibos" element={<Receipts />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
