import { useEffect, useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "../api/client";
import Field from "../components/Field";
import Modal from "../components/Modal";
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

  async function load() {
    setLoading(true);
    const { data } = await api.get("/properties");
    setProperties(data.properties);
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
    const payload = {
      nome: form.nome,
      endereco: form.endereco,
      cidade: form.cidade || null,
      valor_aluguel: Number(form.valor_aluguel),
      valor_agua_esgoto: Number(form.valor_agua_esgoto || 0),
      observacoes: form.observacoes || null,
      ativo: form.ativo,
    };
    try {
      if (editing) {
        await api.put(`/properties/${editing.id}`, payload);
      } else {
        await api.post("/properties", payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar o imóvel"));
    }
  }

  async function handleDelete(property: Property) {
    if (!confirm(`Excluir o imóvel "${property.nome}"?`)) return;
    try {
      await api.delete(`/properties/${property.id}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Não foi possível excluir o imóvel"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Imóveis</h1>
        <button
          onClick={openCreate}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Novo imóvel
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Carregando...</p>
        ) : properties.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Nenhum imóvel cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Nome</th>
                <th className="px-5 py-2 font-medium">Endereço</th>
                <th className="px-5 py-2 font-medium">Aluguel</th>
                <th className="px-5 py-2 font-medium">Água/Esgoto</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {properties.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-gray-900">{p.nome}</td>
                  <td className="px-5 py-2.5">
                    {p.endereco}
                    {p.cidade ? `, ${p.cidade}` : ""}
                  </td>
                  <td className="px-5 py-2.5">{formatCurrency(p.valor_aluguel)}</td>
                  <td className="px-5 py-2.5">{formatCurrency(p.valor_agua_esgoto)}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {p.ativo ? "Ativo" : "Inativo"}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right space-x-3">
                    <button
                      onClick={() => openEdit(p)}
                      className="text-primary-600 hover:underline"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-red-600 hover:underline"
                    >
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
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.ativo}
                onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
              />
              Imóvel ativo
            </label>
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

