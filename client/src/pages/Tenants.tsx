import { Check, Copy, KeyRound, MessageCircle, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import { generatePassword, hasTenantLogin, saveTenantLogin } from "../lib/tenantAccounts";
import { buildWhatsAppLink, tenantLoginMessage } from "../lib/whatsapp";
import type { Tenant } from "../types";

function loginUrl(): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/login`;
}

const emptyForm = { nome: "", cpf: "", email: "", telefone: "", observacoes: "" };

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginTenant, setLoginTenant] = useState<Tenant | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("tenants").select("*").order("nome");
    if (error) toast.error(errorMessage(error, "Não foi possível carregar os inquilinos"));
    setTenants(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setError("");
    setModalOpen(true);
  }

  function openEdit(tenant: Tenant) {
    setEditing(tenant);
    setForm({
      nome: tenant.nome,
      cpf: tenant.cpf ?? "",
      email: tenant.email ?? "",
      telefone: tenant.telefone ?? "",
      observacoes: tenant.observacoes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const payload = {
      nome: form.nome,
      cpf: form.cpf || null,
      email: form.email || null,
      telefone: form.telefone || null,
      observacoes: form.observacoes || null,
    };
    const { error: dbError } = editing
      ? await supabase.from("tenants").update(payload).eq("id", editing.id)
      : await supabase.from("tenants").insert(payload);
    if (dbError) {
      setError(errorMessage(dbError, "Não foi possível salvar o inquilino"));
      setSubmitting(false);
      return;
    }
    toast.success(editing ? "Inquilino atualizado." : "Inquilino cadastrado.");
    setModalOpen(false);
    setSubmitting(false);
    await load();
  }

  async function handleDelete(tenant: Tenant) {
    const ok = await confirm({
      title: `Excluir "${tenant.nome}"?`,
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("tenants").delete().eq("id", tenant.id);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Não é possível excluir um inquilino com contratos vinculados."
          : errorMessage(error, "Não foi possível excluir o inquilino")
      );
      return;
    }
    toast.success("Inquilino excluído.");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Inquilinos</h1>
          <p className="text-sm text-ink-muted mt-0.5">Cadastro de locatários</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Novo inquilino
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-surface-page rounded-lg animate-pulse" />
            ))}
          </div>
        ) : tenants.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Nenhum inquilino cadastrado"
            description="Cadastre um inquilino para vinculá-lo a um contrato."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted border-b border-surface-border">
                  <th className="px-5 py-2.5 font-medium">Nome</th>
                  <th className="px-5 py-2.5 font-medium">CPF</th>
                  <th className="px-5 py-2.5 font-medium">Email</th>
                  <th className="px-5 py-2.5 font-medium">Telefone</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {tenants.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-surface-border/60 last:border-0 hover:bg-surface-page/60 transition"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-xs font-semibold shrink-0">
                          {initials(t.nome)}
                        </div>
                        <span className="font-medium text-ink">{t.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-secondary">{t.cpf || "-"}</td>
                    <td className="px-5 py-3 text-ink-secondary">{t.email || "-"}</td>
                    <td className="px-5 py-3 text-ink-secondary">{t.telefone || "-"}</td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => setLoginTenant(t)}
                          className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                          aria-label={`Login de ${t.nome}`}
                          title="Login do inquilino"
                        >
                          <KeyRound size={15} />
                        </button>
                        <button
                          onClick={() => openEdit(t)}
                          className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                          aria-label={`Editar ${t.nome}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(t)}
                          className="p-1.5 text-ink-muted hover:text-status-critical hover:bg-status-critical/10 rounded-lg transition"
                          aria-label={`Excluir ${t.nome}`}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? "Editar inquilino" : "Novo inquilino"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nome">
              <input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="CPF">
              <input
                value={form.cpf}
                onChange={(e) => setForm({ ...form, cpf: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Email">
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Telefone">
              <input
                value={form.telefone}
                onChange={(e) => setForm({ ...form, telefone: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Observações">
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="input"
                rows={2}
              />
            </Field>
            {error && (
              <p className="text-sm text-status-critical bg-status-critical/5 border border-status-critical/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary">
                Cancelar
              </button>
              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {loginTenant && (
        <TenantLoginModal tenant={loginTenant} onClose={() => setLoginTenant(null)} />
      )}
    </div>
  );
}

function TenantLoginModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [checkingExisting, setCheckingExisting] = useState(true);
  const [alreadyHasLogin, setAlreadyHasLogin] = useState(false);
  const [email, setEmail] = useState(tenant.email ?? "");
  const [password, setPassword] = useState(generatePassword());
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  useEffect(() => {
    hasTenantLogin(tenant.id)
      .then(setAlreadyHasLogin)
      .catch((err) => toast.error(errorMessage(err, "Não foi possível verificar o login")))
      .finally(() => setCheckingExisting(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await saveTenantLogin({ tenantId: tenant.id, email, password });
      setSaved(true);
      toast.success(alreadyHasLogin ? "Senha redefinida." : "Login criado.");
    } catch (err) {
      setError(errorMessage(err, "Não foi possível salvar o login"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(`E-mail: ${email}\nSenha: ${password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappLink = buildWhatsAppLink(
    tenant.telefone,
    tenantLoginMessage({ tenantNome: tenant.nome, email, password, loginUrl: loginUrl() })
  );

  return (
    <Modal title={`Login de ${tenant.nome}`} onClose={onClose}>
      {checkingExisting ? (
        <div className="h-10 bg-surface-page rounded-lg animate-pulse" />
      ) : saved ? (
        <div className="space-y-4">
          <p className="text-sm text-ink-secondary">
            Pronto. Envie os dados abaixo para {tenant.nome} acessar o próprio prazo de contrato e
            baixar os recibos — só falta enviar.
          </p>
          <div className="bg-surface-page rounded-xl p-3.5 text-sm space-y-1.5">
            <div className="flex justify-between gap-3">
              <span className="text-ink-muted">E-mail</span>
              <span className="font-medium text-ink truncate">{email}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-ink-muted">Senha</span>
              <span className="font-medium text-ink tabular-nums">{password}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={handleCopy} className="btn-secondary flex-1 justify-center">
              {copied ? <Check size={16} /> : <Copy size={16} />}
              {copied ? "Copiado" : "Copiar dados"}
            </button>
            {whatsappLink && (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="btn-primary flex-1 justify-center"
              >
                <MessageCircle size={16} />
                WhatsApp
              </a>
            )}
          </div>
          {!whatsappLink && (
            <p className="text-xs text-ink-muted">
              Cadastre o telefone deste inquilino para poder enviar por WhatsApp.
            </p>
          )}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-ink-secondary">
            {alreadyHasLogin
              ? `${tenant.nome} já tem login. Você pode redefinir a senha (o e-mail também pode ser atualizado).`
              : `Crie o login que ${tenant.nome} vai usar para acompanhar o próprio contrato e recibos.`}
          </p>
          <Field label="E-mail de acesso">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Senha">
            <div className="flex gap-2">
              <input
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input flex-1"
              />
              <button
                type="button"
                onClick={() => setPassword(generatePassword())}
                className="btn-secondary px-3"
                title="Gerar nova senha"
                aria-label="Gerar nova senha"
              >
                <RefreshCw size={16} />
              </button>
            </div>
          </Field>
          {error && (
            <p className="text-sm text-status-critical bg-status-critical/5 border border-status-critical/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={submitting} className="btn-primary">
              {submitting ? "Salvando..." : alreadyHasLogin ? "Redefinir senha" : "Criar login"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
