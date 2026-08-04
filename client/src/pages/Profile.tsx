import { User as UserIcon } from "lucide-react";
import { useState, type FormEvent } from "react";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";

export default function Profile() {
  const { user } = useAuth();
  const toast = useToast();
  const [name, setName] = useState((user?.user_metadata?.name as string | undefined) ?? "");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ data: { name } });
    setSubmitting(false);
    if (updateError) {
      setError(errorMessage(updateError, "Não foi possível salvar o perfil"));
      return;
    }
    toast.success("Perfil atualizado.");
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div>
        <h1 className="text-2xl font-bold text-ink">Perfil</h1>
        <p className="text-sm text-ink-muted mt-0.5">
          O nome abaixo é usado como "Locador(a)" nos recibos emitidos.
        </p>
      </div>

      <div className="card p-6">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex items-center gap-3 pb-2">
            <div className="h-11 w-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
              <UserIcon size={20} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-ink truncate">{user?.email}</p>
              <p className="text-xs text-ink-muted">Conta de acesso</p>
            </div>
          </div>

          <Field label="Nome do locador">
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Seu nome completo"
              className="input"
            />
          </Field>

          {error && (
            <p className="text-sm text-status-critical bg-status-critical/5 border border-status-critical/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end pt-2">
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
