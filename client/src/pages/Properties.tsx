import { Building2, Droplets, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import type { Property } from "../types";
import { formatCurrency } from "../utils/format";

const emptyForm = {
  nome: "",
  endereco: "",
  cidade: "",
  valor_aluguel: "",
  valor_agua_esgoto: "",
  observacoes: "",
  ativo: true,
};

export default function Properties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Property | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("properties").select("*").order("nome");
    if (error) toast.error(errorMessage(error, "Não foi possível carregar os imóveis"));
    setProperties(data ?? []);
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

  function openEdit(property: Property) {
    setEditing(property);
    setForm({
      nome: property.nome,
      endereco: property.endereco,
      cidade: property.cidade ?? "",
      valor_aluguel: String(property.valor_aluguel),
      valor_agua_esgoto: String(property.valor_agua_esgoto),
      observacoes: property.observacoes ?? "",
      ativo: !!property.ativo,
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
      endereco: form.endereco,
      cidade: form.cidade || null,
      valor_aluguel: Number(form.valor_aluguel),
      valor_agua_esgoto: Number(form.valor_agua_esgoto || 0),
      observacoes: form.observacoes || null,
      ativo: form.ativo,
    };
    const { error: dbError } = editing
      ? await supabase.from("properties").update(payload).eq("id", editing.id)
      : await supabase.from("properties").insert(payload);
    if (dbError) {
      setError(errorMessage(dbError, "Não foi possível salvar o imóvel"));
      setSubmitting(false);
      return;
    }
    toast.success(editing ? "Imóvel atualizado." : "Imóvel cadastrado.");
    setModalOpen(false);
    setSubmitting(false);
    await load();
  }

  async function handleDelete(property: Property) {
    const ok = await confirm({
      title: `Excluir "${property.nome}"?`,
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("properties").delete().eq("id", property.id);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Não é possível excluir um imóvel com contratos vinculados. Desative-o em vez disso."
          : errorMessage(error, "Não foi possível excluir o imóvel")
      );
      return;
    }
    toast.success("Imóvel excluído.");
    await load();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Imóveis</h1>
          <p className="text-sm text-ink-muted mt-0.5">Cadastro de propriedades e valores</p>
        </div>
        <button onClick={openCreate} className="btn-primary">
          <Plus size={16} /> Novo imóvel
        </button>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-surface-page rounded-lg animate-pulse" />
            ))}
          </div>
        ) : properties.length === 0 ? (
          <EmptyState
            icon={Building2}
            title="Nenhum imóvel cadastrado"
            description="Cadastre seu primeiro imóvel para começar a controlar aluguel e contratos."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted border-b border-surface-border">
                  <th className="px-5 py-2.5 font-medium">Nome</th>
                  <th className="px-5 py-2.5 font-medium">Endereço</th>
                  <th className="px-5 py-2.5 font-medium">Aluguel</th>
                  <th className="px-5 py-2.5 font-medium">Água/Esgoto</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {properties.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-surface-border/60 last:border-0 hover:bg-surface-page/60 transition"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                          <Building2 size={16} />
                        </div>
                        <span className="font-medium text-ink">{p.nome}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-secondary">
                      {p.endereco}
                      {p.cidade ? `, ${p.cidade}` : ""}
                    </td>
                    <td className="px-5 py-3 text-ink-secondary tabular-nums">
                      {formatCurrency(p.valor_aluguel)}
                    </td>
                    <td className="px-5 py-3 text-ink-secondary tabular-nums">
                      <span className="inline-flex items-center gap-1">
                        <Droplets size={13} className="text-primary-400" />
                        {formatCurrency(p.valor_agua_esgoto)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <span
                        className={`badge ${
                          p.ativo ? "bg-status-good/10 text-status-good" : "bg-ink-muted/10 text-ink-muted"
                        }`}
                      >
                        {p.ativo ? "Ativo" : "Inativo"}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                          aria-label={`Editar ${p.nome}`}
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(p)}
                          className="p-1.5 text-ink-muted hover:text-status-critical hover:bg-status-critical/10 rounded-lg transition"
                          aria-label={`Excluir ${p.nome}`}
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
        <Modal title={editing ? "Editar imóvel" : "Novo imóvel"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Nome do imóvel">
              <input
                required
                value={form.nome}
                onChange={(e) => setForm({ ...form, nome: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Endereço">
              <input
                required
                value={form.endereco}
                onChange={(e) => setForm({ ...form, endereco: e.target.value })}
                className="input"
              />
            </Field>
            <Field label="Cidade">
              <input
                value={form.cidade}
                onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                className="input"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Valor do aluguel (R$)">
                <input
                  required
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_aluguel}
                  onChange={(e) => setForm({ ...form, valor_aluguel: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Taxa água e esgoto (R$)">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.valor_agua_esgoto}
                  onChange={(e) => setForm({ ...form, valor_agua_esgoto: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <Field label="Observações">
              <textarea
                value={form.observacoes}
                onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                className="input"
                rows={2}
              />
            </Field>
            <label className="flex items-center gap-2 text-sm text-ink-secondary">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                className="rounded border-surface-border text-primary-500 focus:ring-primary-400"
              />
              Imóvel ativo
            </label>
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
