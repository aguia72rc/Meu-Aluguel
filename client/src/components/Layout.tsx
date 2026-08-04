import {
  Building2,
  FileText,
  LayoutGrid,
  LogOut,
  Receipt,
  Users,
  Wallet,
} from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { to: "/", label: "Painel", icon: LayoutGrid, end: true },
  { to: "/imoveis", label: "Imóveis", icon: Building2 },
  { to: "/inquilinos", label: "Inquilinos", icon: Users },
  { to: "/contratos", label: "Contratos", icon: FileText },
  { to: "/pagamentos", label: "Pagamentos", icon: Wallet },
  { to: "/recibos", label: "Recibos", icon: Receipt },
];

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-surface-page flex">
      <aside className="hidden md:flex w-64 shrink-0 flex-col bg-white border-r border-surface-border">
        <div className="h-16 flex items-center gap-2 px-6 border-b border-surface-border">
          <div className="h-8 w-8 rounded-lg bg-primary-500 text-white flex items-center justify-center font-bold text-sm">
            MA
          </div>
          <span className="font-semibold text-ink">Meu Aluguel</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition ${
                  isActive
                    ? "bg-primary-50 text-primary-700"
                    : "text-ink-secondary hover:bg-surface-page hover:text-ink"
                }`
              }
            >
              <item.icon size={18} strokeWidth={2} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-surface-border">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold">
              {initials(user?.name || user?.email || "?")}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink truncate">{user?.name}</p>
              <p className="text-xs text-ink-muted truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              className="shrink-0 text-ink-muted hover:text-status-critical transition p-1.5 rounded-lg hover:bg-status-critical/10"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden h-14 flex items-center justify-between px-4 bg-white border-b border-surface-border">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary-500 text-white flex items-center justify-center font-bold text-xs">
              MA
            </div>
            <span className="font-semibold text-ink text-sm">Meu Aluguel</span>
          </div>
          <button onClick={handleLogout} className="text-ink-muted p-1.5" aria-label="Sair">
            <LogOut size={18} />
          </button>
        </header>

        <nav className="md:hidden flex overflow-x-auto bg-white border-b border-surface-border px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 transition ${
                  isActive
                    ? "border-primary-500 text-primary-700"
                    : "border-transparent text-ink-secondary"
                }`
              }
            >
              <item.icon size={15} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main className="flex-1 px-4 sm:px-6 lg:px-8 py-6 sm:py-8 max-w-6xl w-full mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
