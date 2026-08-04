import { Building2, Lock, Mail } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await login(email, password);
      navigate("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-surface-page px-4 relative overflow-hidden">
      <div
        aria-hidden
        className="absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary-100 blur-3xl opacity-60"
      />
      <div
        aria-hidden
        className="absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary-50 blur-3xl opacity-80"
      />

      <div className="relative w-full max-w-sm">
        <div className="flex flex-col items-center mb-6">
          <div className="h-12 w-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
            <Building2 size={24} />
          </div>
          <h1 className="text-2xl font-bold text-ink mt-4">Meu Aluguel</h1>
          <p className="text-sm text-ink-muted mt-1">Gestão de imóveis, pagamentos e recibos</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-ink-secondary mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  id="login-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input pl-9"
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="login-password"
                className="block text-sm font-medium text-ink-secondary mb-1.5"
              >
                Senha
              </label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
                <input
                  id="login-password"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input pl-9"
                />
              </div>
            </div>
            {error && (
              <p className="text-sm text-status-critical bg-status-critical/5 border border-status-critical/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
              {submitting ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
