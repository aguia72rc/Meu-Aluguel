import { Pencil, Plus, Trash2, Users } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
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
  const confirm = useConfirm();
  const toast = useToast();

  async function load() {
    setLoading(true);
    const { data } = await api.get("/tenants");
    setTenants(data.tenants);
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
    try {
      if (editing) {
        await api.put(`/tenants/${editing.id}`, payload);
        toast.success("Inquilino atualizado.");
      } else {
        await api.post("/tenants", payload);
        toast.success("Inquilino cadastrado.");
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar o inquilino"));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(tenant: Tenant) {
    const ok = await confirm({
      title: `Excluir "${tenant.nome}"?`,
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/tenants/${tenant.id}`);
      toast.success("Inquilino excluído.");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível excluir o inquilino"));
    }
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
    </div>
  );
}
