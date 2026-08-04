import { useEffect, useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "../api/client";
import Field from "../components/Field";
import Modal from "../components/Modal";
import type { Tenant } from "../types";

const emptyForm = { nome: "", cpf: "", email: "", telefone: "", observacoes: "" };

export default function Tenants() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Tenant | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [error, setError] = useState("");

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
      } else {
        await api.post("/tenants", payload);
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar o inquilino"));
    }
  }

  async function handleDelete(tenant: Tenant) {
    if (!confirm(`Excluir o inquilino "${tenant.nome}"?`)) return;
    try {
      await api.delete(`/tenants/${tenant.id}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Não foi possível excluir o inquilino"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Inquilinos</h1>
        <button
          onClick={openCreate}
          className="bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
        >
          + Novo inquilino
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Carregando...</p>
        ) : tenants.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Nenhum inquilino cadastrado ainda.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Nome</th>
                <th className="px-5 py-2 font-medium">CPF</th>
                <th className="px-5 py-2 font-medium">Email</th>
                <th className="px-5 py-2 font-medium">Telefone</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-gray-900">{t.nome}</td>
                  <td className="px-5 py-2.5">{t.cpf || "-"}</td>
                  <td className="px-5 py-2.5">{t.email || "-"}</td>
                  <td className="px-5 py-2.5">{t.telefone || "-"}</td>
                  <td className="px-5 py-2.5 text-right space-x-3">
                    <button onClick={() => openEdit(t)} className="text-primary-600 hover:underline">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(t)} className="text-red-600 hover:underline">
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

