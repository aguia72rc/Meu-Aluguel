import { Check, Copy, Link2, MessageCircle, Pencil, Plus, RefreshCw, Trash2, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import { getOrCreatePortalLink, regeneratePortalLink } from "../lib/tenantPortal";
import { buildWhatsAppLink, tenantPortalMessage } from "../lib/whatsapp";
import type { Tenant } from "../types";

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
  const [portalTenant, setPortalTenant] = useState<Tenant | null>(null);
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
                          onClick={() => setPortalTenant(t)}
                          className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                          aria-label={`Portal de ${t.nome}`}
                          title="Portal do inquilino"
                        >
                          <Link2 size={15} />
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

      {portalTenant && (
        <PortalLinkModal tenant={portalTenant} onClose={() => setPortalTenant(null)} />
      )}
    </div>
  );
}

function PortalLinkModal({ tenant, onClose }: { tenant: Tenant; onClose: () => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const toast = useToast();
  const confirm = useConfirm();

  async function load() {
    setLoading(true);
    try {
      setUrl(await getOrCreatePortalLink(tenant.id));
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível gerar o link do portal"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleRegenerate() {
    const ok = await confirm({
      title: "Gerar um novo link?",
      description: "O link atual para de funcionar imediatamente.",
      confirmLabel: "Gerar novo link",
    });
    if (!ok) return;
    setRegenerating(true);
    try {
      setUrl(await regeneratePortalLink(tenant.id));
      toast.success("Novo link gerado.");
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível gerar o link"));
    } finally {
      setRegenerating(false);
    }
  }

  async function handleCopy() {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const whatsappLink = url
    ? buildWhatsAppLink(tenant.telefone, tenantPortalMessage({ tenantNome: tenant.nome, portalUrl: url }))
    : null;

  return (
    <Modal title={`Portal de ${tenant.nome}`} onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-ink-secondary">
          Link pessoal e sem senha para {tenant.nome} acompanhar pagamentos, baixar recibos e ver o
          prazo até o fim do contrato — a qualquer momento, sem precisar falar com você.
        </p>
        {loading ? (
          <div className="h-10 bg-surface-page rounded-lg animate-pulse" />
        ) : url ? (
          <>
            <div className="flex gap-2">
              <input
                readOnly
                value={url}
                className="input flex-1 text-xs"
                onFocus={(e) => e.target.select()}
              />
              <button
                onClick={handleCopy}
                className="btn-secondary px-3"
                title="Copiar link"
                aria-label="Copiar link do portal"
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
              </button>
            </div>

            {whatsappLink ? (
              <a href={whatsappLink} target="_blank" rel="noreferrer" className="btn-primary w-full justify-center">
                <MessageCircle size={16} />
                Enviar por WhatsApp
              </a>
            ) : (
              <p className="text-xs text-ink-muted">
                Cadastre o telefone deste inquilino para poder enviar o link por WhatsApp.
              </p>
            )}

            <button
              onClick={handleRegenerate}
              disabled={regenerating}
              className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-status-critical transition"
            >
              <RefreshCw size={14} />
              {regenerating ? "Gerando..." : "Gerar novo link (revoga o atual)"}
            </button>
          </>
        ) : null}
      </div>
    </Modal>
  );
}
