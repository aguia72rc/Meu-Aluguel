import { Calendar, Check, Copy, RefreshCw, User as UserIcon } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import Field from "../components/Field";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

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

      <CalendarFeedCard />
    </div>
  );
}

function CalendarFeedCard() {
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const toast = useToast();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("calendar_feed_tokens")
      .select("token")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) toast.error(errorMessage(error, "Não foi possível carregar o link do calendário"));
    setToken(data?.token ?? null);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGenerate(regenerate: boolean) {
    if (regenerate) {
      const ok = await confirm({
        title: "Gerar um novo link?",
        description: "O link antigo para de funcionar. Você vai precisar assinar o calendário de novo em todos os aparelhos.",
        confirmLabel: "Gerar novo link",
      });
      if (!ok) return;
    }
    setGenerating(true);
    try {
      if (regenerate) {
        await supabase.from("calendar_feed_tokens").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      }
      const { data, error } = await supabase
        .from("calendar_feed_tokens")
        .insert({})
        .select("token")
        .single();
      if (error) throw error;
      setToken(data.token);
      toast.success("Link do calendário gerado.");
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível gerar o link"));
    } finally {
      setGenerating(false);
    }
  }

  const httpsUrl = token ? `${SUPABASE_URL}/functions/v1/calendar-feed?token=${token}` : "";
  const webcalUrl = httpsUrl.replace(/^https?:\/\//, "webcal://");

  async function copy(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey((k) => (k === key ? null : k)), 2000);
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center shrink-0">
          <Calendar size={20} />
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Calendário (iPhone / Google Calendar)</p>
          <p className="text-xs text-ink-muted">
            Vencimentos, atrasos e renovações de contrato direto no seu calendário
          </p>
        </div>
      </div>

      {loading ? (
        <div className="h-10 bg-surface-page rounded-lg animate-pulse" />
      ) : !token ? (
        <div className="space-y-3">
          <p className="text-sm text-ink-secondary">
            Gere um link único de assinatura — ele atualiza sozinho conforme você lança
            pagamentos e contratos, sem precisar exportar nada de novo depois.
          </p>
          <button onClick={() => handleGenerate(false)} disabled={generating} className="btn-primary">
            {generating ? "Gerando..." : "Gerar link do calendário"}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1.5">
              iPhone (Calendário da Apple)
            </p>
            <div className="flex gap-2">
              <a href={webcalUrl} className="btn-primary flex-1 justify-center">
                Assinar no iPhone
              </a>
              <button
                onClick={() => copy("webcal", webcalUrl)}
                className="btn-secondary px-3"
                title="Copiar link"
                aria-label="Copiar link webcal"
              >
                {copiedKey === "webcal" ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-1.5">
              Toque em "Assinar no iPhone" (abre o Safari) ou copie o link e adicione em
              Ajustes → Calendário → Contas → Adicionar Conta → Outro → Assinar Calendário.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-1.5">
              Google Calendar / Outlook
            </p>
            <div className="flex gap-2">
              <input readOnly value={httpsUrl} className="input flex-1 text-xs" onFocus={(e) => e.target.select()} />
              <button
                onClick={() => copy("https", httpsUrl)}
                className="btn-secondary px-3"
                title="Copiar link"
                aria-label="Copiar link https"
              >
                {copiedKey === "https" ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>
            <p className="text-xs text-ink-muted mt-1.5">
              No Google Calendar: "Outros calendários" → "+" → "A partir do URL" → cole o link
              acima.
            </p>
          </div>

          <button
            onClick={() => handleGenerate(true)}
            disabled={generating}
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-status-critical transition"
          >
            <RefreshCw size={14} />
            Gerar novo link (revoga o atual)
          </button>
        </div>
      )}
    </div>
  );
}
