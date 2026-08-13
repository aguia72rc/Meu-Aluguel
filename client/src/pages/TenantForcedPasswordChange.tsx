import { KeyRound, LogOut } from "lucide-react";
import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";

export default function TenantForcedPasswordChange() {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({
      password,
      data: { must_change_password: false },
    });
    setSubmitting(false);
    if (updateError) {
      setError(errorMessage(updateError, "Não foi possível trocar a senha"));
      return;
    }
    toast.success("Senha definida. Bem-vindo(a)!");
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
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
            <KeyRound size={24} />
          </div>
          <h1 className="text-2xl font-bold text-ink mt-4">Defina sua senha</h1>
          <p className="text-sm text-ink-muted mt-1 text-center">
            Por segurança, escolha uma senha só sua antes de continuar.
          </p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">Nova senha</label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-secondary mb-1.5">
                Confirmar senha
              </label>
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input"
              />
            </div>
            {error && (
              <p className="text-sm text-status-critical bg-status-critical/5 border border-status-critical/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <button type="submit" disabled={submitting} className="btn-primary w-full py-2.5">
              {submitting ? "Salvando..." : "Salvar e continuar"}
            </button>
          </form>
        </div>

        <button
          onClick={handleLogout}
          className="mt-4 mx-auto flex items-center gap-1.5 text-sm text-ink-muted hover:text-status-critical transition"
        >
          <LogOut size={14} />
          Sair
        </button>
      </div>
    </div>
  );
}
