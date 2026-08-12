import { Building2, Calendar, Lock, Mail, MessageCircle, Receipt } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const FEATURES = [
  { icon: Receipt, text: "Recibos de aluguel e água/esgoto gerados automaticamente" },
  { icon: Calendar, text: "Vencimentos e renovações direto no seu calendário" },
  { icon: MessageCircle, text: "Lembretes e recibos enviados por WhatsApp" },
];

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
    <div className="min-h-screen flex bg-surface-page">
      <div className="hidden lg:flex lg:w-[46%] xl:w-2/5 relative overflow-hidden bg-primary-700 text-white flex-col justify-between px-12 py-14">
        <div
          aria-hidden
          className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-white/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary-900/40 blur-3xl"
        />

        <div className="relative flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white text-primary-700 flex items-center justify-center font-bold">
            MA
          </div>
          <span className="text-lg font-semibold">Meu Aluguel</span>
        </div>

        <div className="relative space-y-8">
          <div className="space-y-3">
            <h1 className="text-3xl font-bold leading-tight">
              Gestão completa dos seus imóveis alugados
            </h1>
            <p className="text-primary-100 text-sm leading-relaxed max-w-sm">
              Contratos, pagamentos, recibos e comunicação com os inquilinos, tudo em um só lugar.
            </p>
          </div>
          <ul className="space-y-4">
            {FEATURES.map((f) => (
              <li key={f.text} className="flex items-start gap-3">
                <div className="h-8 w-8 shrink-0 rounded-lg bg-white/15 flex items-center justify-center">
                  <f.icon size={16} />
                </div>
                <span className="text-sm text-primary-50 pt-1.5">{f.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-primary-200">
          Feito para administradores e imobiliárias de pequeno porte.
        </p>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
        <div
          aria-hidden
          className="lg:hidden absolute -top-32 -right-32 h-96 w-96 rounded-full bg-primary-100 blur-3xl opacity-60"
        />
        <div
          aria-hidden
          className="lg:hidden absolute -bottom-32 -left-32 h-96 w-96 rounded-full bg-primary-50 blur-3xl opacity-80"
        />

        <div className="relative w-full max-w-sm">
          <div className="flex flex-col items-center mb-6 lg:hidden">
            <div className="h-12 w-12 rounded-2xl bg-primary-500 text-white flex items-center justify-center shadow-lg shadow-primary-500/20">
              <Building2 size={24} />
            </div>
            <h1 className="text-2xl font-bold text-ink mt-4">Meu Aluguel</h1>
            <p className="text-sm text-ink-muted mt-1">Gestão de imóveis, pagamentos e recibos</p>
          </div>

          <div className="hidden lg:block mb-8">
            <h2 className="text-2xl font-bold text-ink">Entrar</h2>
            <p className="text-sm text-ink-muted mt-1">Acesse sua conta para continuar</p>
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
    </div>
  );
}
