import { useEffect, useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "../api/client";
import Field from "../components/Field";
import Modal from "../components/Modal";
import type { Contract, Property, Tenant } from "../types";
import { formatCurrency, formatDate } from "../utils/format";

const emptyForm = {
  property_id: "",
  tenant_id: "",
  data_inicio: "",
  data_fim: "",
  dia_vencimento: "5",
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

  async function load() {
    setLoading(true);
    const [contractsRes, propertiesRes, tenantsRes] = await Promise.all([
      api.get("/contracts"),
      api.get("/properties"),
      api.get("/tenants"),
    ]);
    setContracts(contractsRes.data.contracts);
    setProperties(propertiesRes.data.properties);
    setTenants(tenantsRes.data.tenants);
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
    const payload = {
      property_id: Number(form.property_id),
      tenant_id: Number(form.tenant_id),
      data_inicio: form.data_inicio,
      data_fim: form.data_fim || null,
      dia_vencimento: Number(form.dia_vencimento),
      valor_aluguel: Number(form.valor_aluguel),
      valor_agua_esgoto: Number(form.valor_agua_esgoto || 0),
      status: form.status,
      observacoes: form.observacoes || null,
    };
    try {
      if (editing) {
        await api.put(`/contracts/${editing.id}`, payload);
      } else {
        await api.post("/contracts", payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar o contrato"));
    }
  }

  async function handleDelete(contract: Contract) {
    if (!confirm("Excluir este contrato?")) return;
    try {
      await api.delete(`/contracts/${contract.id}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Não foi possível excluir o contrato"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Contratos</h1>
        <button
          onClick={openCreate}
          disabled={properties.length === 0 || tenants.length === 0}
          className="bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Novo contrato
        </button>
      </div>
      {(properties.length === 0 || tenants.length === 0) && (
        <p className="text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
          Cadastre ao menos um imóvel e um inquilino antes de criar um contrato.
        </p>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Carregando...</p>
        ) : contracts.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Nenhum contrato cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Imóvel</th>
                <th className="px-5 py-2 font-medium">Inquilino</th>
                <th className="px-5 py-2 font-medium">Início</th>
                <th className="px-5 py-2 font-medium">Vencimento</th>
                <th className="px-5 py-2 font-medium">Aluguel</th>
                <th className="px-5 py-2 font-medium">Água/Esgoto</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {contracts.map((c) => (
                <tr key={c.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-gray-900">{c.property_nome}</td>
                  <td className="px-5 py-2.5">{c.tenant_nome}</td>
                  <td className="px-5 py-2.5">{formatDate(c.data_inicio)}</td>
                  <td className="px-5 py-2.5">Dia {c.dia_vencimento}</td>
                  <td className="px-5 py-2.5">{formatCurrency(c.valor_aluguel)}</td>
                  <td className="px-5 py-2.5">{formatCurrency(c.valor_agua_esgoto)}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        c.status === "ativo" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {c.status === "ativo" ? "Ativo" : "Encerrado"}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right space-x-3">
                    <button onClick={() => openEdit(c)} className="text-primary-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(c)} className="text-red-600 hover:underline">
                      Excluir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 rounded-lg"
              >
                Salvar
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

