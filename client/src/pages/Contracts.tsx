import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import type { Contract, Property, Tenant } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

interface ContractRow {
  id: string;
  property_id: string;
  tenant_id: string;
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number;
  dia_vencimento_agua_esgoto: number;
  valor_aluguel: number;
  valor_agua_esgoto: number;
  status: "ativo" | "encerrado";
  observacoes: string | null;
  properties: { nome: string; endereco: string } | null;
  tenants: { nome: string } | null;
}

function flattenContract(row: ContractRow): Contract {
  return {
    ...row,
    property_nome: row.properties?.nome ?? "",
    property_endereco: row.properties?.endereco ?? "",
    tenant_nome: row.tenants?.nome ?? "",
  };
}

const emptyForm = {
  property_id: "",
  tenant_id: "",
  data_inicio: "",
  data_fim: "",
  dia_vencimento: "5",
  dia_vencimento_agua_esgoto: "5",
  valor_aluguel: "",
  valor_agua_esgoto: "",
  status: "ativo" as "ativo" | "encerrado",
  observacoes: "",
};

export default function Contracts() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Contract | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const confirm = useConfirm();
  const toast = useToast();

  async function load() {
    setLoading(true);
    const [contractsRes, propertiesRes, tenantsRes] = await Promise.all([
      supabase
        .from("contracts")
        .select("*, properties(nome, endereco), tenants(nome)")
        .order("status")
        .order("data_inicio", { ascending: false }),
      supabase.from("properties").select("*").order("nome"),
      supabase.from("tenants").select("*").order("nome"),
    ]);
    if (contractsRes.error) toast.error(errorMessage(contractsRes.error, "Não foi possível carregar os contratos"));
    setContracts(((contractsRes.data as unknown as ContractRow[]) ?? []).map(flattenContract));
    setProperties(propertiesRes.data ?? []);
    setTenants(tenantsRes.data ?? []);
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

  function openEdit(contract: Contract) {
    setEditing(contract);
    setForm({
      property_id: String(contract.property_id),
      tenant_id: String(contract.tenant_id),
      data_inicio: contract.data_inicio.slice(0, 10),
      data_fim: contract.data_fim ? contract.data_fim.slice(0, 10) : "",
      dia_vencimento: String(contract.dia_vencimento),
      dia_vencimento_agua_esgoto: String(contract.dia_vencimento_agua_esgoto),
      valor_aluguel: String(contract.valor_aluguel),
      valor_agua_esgoto: String(contract.valor_agua_esgoto),
      status: contract.status,
      observacoes: contract.observacoes ?? "",
    });
    setError("");
    setModalOpen(true);
  }

  function handlePropertyChange(propertyId: string) {
    const property = properties.find((p) => String(p.id) === propertyId);
    setForm({
      ...form,
      property_id: propertyId,
      valor_aluguel: editing ? form.valor_aluguel : String(property?.valor_aluguel ?? ""),
      valor_agua_esgoto: editing ? form.valor_agua_esgoto : String(property?.valor_agua_esgoto ?? ""),
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    const payload = {
      property_id: form.property_id,
      tenant_id: form.tenant_id,
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      dia_vencimento: Number(form.dia_vencimento),
      dia_vencimento_agua_esgoto: Number(form.dia_vencimento_agua_esgoto),
      valor_aluguel: Number(form.valor_aluguel),
      valor_agua_esgoto: Number(form.valor_agua_esgoto || 0),
      status: form.status,
      observacoes: form.observacoes || null,
    };
    const { error: dbError } = editing
      ? await supabase.from("contracts").update(payload).eq("id", editing.id)
      : await supabase.from("contracts").insert(payload);
    if (dbError) {
      setError(errorMessage(dbError, "Não foi possível salvar o contrato"));
      setSubmitting(false);
      return;
    }
    toast.success(editing ? "Contrato atualizado." : "Contrato criado.");
    setModalOpen(false);
    setSubmitting(false);
    await load();
  }

  async function handleDelete(contract: Contract) {
    const ok = await confirm({
      title: "Excluir este contrato?",
      description: "Essa ação não pode ser desfeita.",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    const { error } = await supabase.from("contracts").delete().eq("id", contract.id);
    if (error) {
      toast.error(
        error.code === "23503"
          ? "Não é possível excluir um contrato com pagamentos vinculados. Encerre-o em vez disso."
          : errorMessage(error, "Não foi possível excluir o contrato")
      );
      return;
    }
    toast.success("Contrato excluído.");
    await load();
  }

  const canCreate = properties.length > 0 && tenants.length > 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Contratos</h1>
          <p className="text-sm text-ink-muted mt-0.5">Vínculo entre imóveis e inquilinos</p>
        </div>
        <button onClick={openCreate} disabled={!canCreate} className="btn-primary">
          <Plus size={16} /> Novo contrato
        </button>
      </div>
      {!canCreate && (
        <p className="text-sm text-[#9a6a00] bg-status-warning/10 border border-status-warning/30 rounded-lg px-4 py-2.5">
          Cadastre ao menos um imóvel e um inquilino antes de criar um contrato.
        </p>
      )}

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-surface-page rounded-lg animate-pulse" />
            ))}
          </div>
        ) : contracts.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum contrato cadastrado"
            description="Crie um contrato vinculando um imóvel a um inquilino."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted border-b border-surface-border">
                  <th className="px-5 py-2.5 font-medium">Imóvel</th>
                  <th className="px-5 py-2.5 font-medium">Inquilino</th>
                  <th className="px-5 py-2.5 font-medium">Início</th>
                  <th className="px-5 py-2.5 font-medium">Aluguel</th>
                  <th className="px-5 py-2.5 font-medium">Água/Esgoto</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {contracts.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-surface-border/60 last:border-0 hover:bg-surface-page/60 transition"
                  >
                    <td className="px-5 py-3 font-medium text-ink">{c.property_nome}</td>
                    <td className="px-5 py-3 text-ink-secondary">{c.tenant_nome}</td>
                    <td className="px-5 py-3 text-ink-secondary">{formatDate(c.data_inicio)}</td>
                    <td className="px-5 py-3 text-ink-secondary tabular-nums">
                      {formatCurrency(c.valor_aluguel)}
                      <span className="text-ink-muted"> · dia {c.dia_vencimento}</span>
                    </td>
                    <td className="px-5 py-3 text-ink-secondary tabular-nums">
                      {formatCurrency(c.valor_agua_esgoto)}
                      <span className="text-ink-muted"> · dia {c.dia_vencimento_agua_esgoto}</span>
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={c.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => openEdit(c)}
                          className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                          aria-label="Editar contrato"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 text-ink-muted hover:text-status-critical hover:bg-status-critical/10 rounded-lg transition"
                          aria-label="Excluir contrato"
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
        <Modal title={editing ? "Editar contrato" : "Novo contrato"} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field label="Imóvel">
              <select
                required
                value={form.property_id}
                onChange={(e) => handlePropertyChange(e.target.value)}
                className="input"
              >
                <option value="">Selecione...</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nome}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Inquilino">
              <select
                required
                value={form.tenant_id}
                onChange={(e) => setForm({ ...form, tenant_id: e.target.value })}
                className="input"
              >
                <option value="">Selecione...</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.nome}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Início do contrato">
                <input
                  required
                  type="date"
                  value={form.data_inicio}
                  onChange={(e) => setForm({ ...form, data_inicio: e.target.value })}
                  className="input"
                />
              </Field>
              <Field label="Fim do contrato (opcional)">
                <input
                  type="date"
                  value={form.data_fim}
                  onChange={(e) => setForm({ ...form, data_fim: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide -mb-1">
              Aluguel
            </p>
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
              <Field label="Dia de vencimento (1-28)">
                <input
                  required
                  type="number"
                  min="1"
                  max="28"
                  value={form.dia_vencimento}
                  onChange={(e) => setForm({ ...form, dia_vencimento: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            <p className="text-xs font-medium text-ink-muted uppercase tracking-wide -mb-1">
              Água e esgoto
            </p>
            <div className="grid grid-cols-2 gap-4">
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
              <Field label="Dia de vencimento (1-28)">
                <input
                  required
                  type="number"
                  min="1"
                  max="28"
                  value={form.dia_vencimento_agua_esgoto}
                  onChange={(e) => setForm({ ...form, dia_vencimento_agua_esgoto: e.target.value })}
                  className="input"
                />
              </Field>
            </div>
            {editing && (
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) => setForm({ ...form, status: e.target.value as "ativo" | "encerrado" })}
                  className="input"
                >
                  <option value="ativo">Ativo</option>
                  <option value="encerrado">Encerrado</option>
                </select>
              </Field>
            )}
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
