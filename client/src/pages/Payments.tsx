import { useEffect, useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "../api/client";
import Field from "../components/Field";
import Modal from "../components/Modal";
import type { Payment } from "../types";
import { currentMonth, formatCurrency, formatDate, formatMonth } from "../utils/format";

const statusLabel: Record<string, string> = {
  pendente: "Pendente",
  atrasado: "Atrasado",
  pago: "Pago",
  cancelado: "Cancelado",
};

const statusClass: Record<string, string> = {
  pendente: "bg-yellow-100 text-yellow-700",
  atrasado: "bg-red-100 text-red-700",
  pago: "bg-green-100 text-green-700",
  cancelado: "bg-gray-100 text-gray-600",
};

export default function Payments() {
  const [month, setMonth] = useState(currentMonth());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [payModalPayment, setPayModalPayment] = useState<Payment | null>(null);
  const [editModalPayment, setEditModalPayment] = useState<Payment | null>(null);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    const { data } = await api.get("/payments", { params: { mes_referencia: month } });
    setPayments(
      [...data.payments].sort((a: Payment, b: Payment) =>
        a.property_nome.localeCompare(b.property_nome)
      )
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  async function handleGenerate() {
    setGenerating(true);
    setError("");
    try {
      const { data } = await api.post("/payments/generate", { mes_referencia: month });
      await load();
      if (data.criados === 0) {
        alert("Todos os contratos ativos já possuem pagamento gerado para este mês.");
      }
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível gerar os pagamentos do mês"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(payment: Payment) {
    if (!confirm("Excluir este lançamento de pagamento?")) return;
    try {
      await api.delete(`/payments/${payment.id}`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Não foi possível excluir o pagamento"));
    }
  }

  async function handleUndo(payment: Payment) {
    if (!confirm("Desfazer este pagamento? O recibo emitido será removido.")) return;
    try {
      await api.post(`/payments/${payment.id}/undo-payment`);
      await load();
    } catch (err) {
      alert(apiErrorMessage(err, "Não foi possível desfazer o pagamento"));
    }
  }

  async function handleDownloadReceipt(payment: Payment) {
    const response = await api.get(`/receipts/by-payment/${payment.id}/download`, {
      responseType: "blob",
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement("a");
    link.href = url;
    link.download = `recibo-${payment.property_nome}-${payment.mes_referencia}.pdf`;
    link.click();
    window.URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Pagamentos</h1>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input w-auto"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="bg-primary-600 hover:bg-primary-700 disabled:opacity-60 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
          >
            {generating ? "Gerando..." : `Gerar cobranças de ${formatMonth(month)}`}
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <p className="p-5 text-sm text-gray-500">Carregando...</p>
        ) : payments.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">
            Nenhum pagamento para {formatMonth(month)}. Clique em "Gerar cobranças" para criar os
            lançamentos deste mês a partir dos contratos ativos.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Imóvel</th>
                <th className="px-5 py-2 font-medium">Inquilino</th>
                <th className="px-5 py-2 font-medium">Vencimento</th>
                <th className="px-5 py-2 font-medium">Aluguel</th>
                <th className="px-5 py-2 font-medium">Água/Esgoto</th>
                <th className="px-5 py-2 font-medium">Total</th>
                <th className="px-5 py-2 font-medium">Status</th>
                <th className="px-5 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5 font-medium text-gray-900">{p.property_nome}</td>
                  <td className="px-5 py-2.5">{p.tenant_nome}</td>
                  <td className="px-5 py-2.5">{formatDate(p.data_vencimento)}</td>
                  <td className="px-5 py-2.5">{formatCurrency(p.valor_aluguel)}</td>
                  <td className="px-5 py-2.5">{formatCurrency(p.valor_agua_esgoto)}</td>
                  <td className="px-5 py-2.5 font-medium">{formatCurrency(p.valor_total)}</td>
                  <td className="px-5 py-2.5">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusClass[p.status]}`}>
                      {statusLabel[p.status]}
                    </span>
                  </td>
                  <td className="px-5 py-2.5 text-right space-x-3 whitespace-nowrap">
                    {p.status === "pago" ? (
                      <>
                        <button
                          onClick={() => handleDownloadReceipt(p)}
                          className="text-primary-600 hover:underline"
                        >
                          Recibo
                        </button>
                        <button onClick={() => handleUndo(p)} className="text-gray-500 hover:underline">
                          Desfazer
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setPayModalPayment(p)}
                          className="text-green-600 hover:underline"
                        >
                          Marcar como pago
                        </button>
                        <button
                          onClick={() => setEditModalPayment(p)}
                          className="text-primary-600 hover:underline"
                        >
                          Editar
                        </button>
                        <button onClick={() => handleDelete(p)} className="text-red-600 hover:underline">
                          Excluir
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {payModalPayment && (
        <PayModal
          payment={payModalPayment}
          onClose={() => setPayModalPayment(null)}
          onPaid={() => {
            setPayModalPayment(null);
            load();
          }}
        />
      )}

      {editModalPayment && (
        <EditPaymentModal
          payment={editModalPayment}
          onClose={() => setEditModalPayment(null)}
          onSaved={() => {
            setEditModalPayment(null);
            load();
          }}
        />
      )}
    </div>
  );
}

function PayModal({
  payment,
  onClose,
  onPaid,
}: {
  payment: Payment;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().slice(0, 10));
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/payments/${payment.id}/pay`, {
        data_pagamento: dataPagamento,
        forma_pagamento: formaPagamento,
      });
      onPaid();
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível registrar o pagamento"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Registrar pagamento" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          {payment.property_nome} — {payment.tenant_nome} — {formatMonth(payment.mes_referencia)}
        </p>
        <div className="bg-gray-50 rounded-lg p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-500">Aluguel</span>
            <span>{formatCurrency(payment.valor_aluguel)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Água e Esgoto</span>
            <span>{formatCurrency(payment.valor_agua_esgoto)}</span>
          </div>
          {payment.valor_outros > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">{payment.descricao_outros || "Outros"}</span>
              <span>{formatCurrency(payment.valor_outros)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1 border-t border-gray-200">
            <span>Total</span>
            <span>{formatCurrency(payment.valor_total)}</span>
          </div>
        </div>
        <Field label="Data do pagamento">
          <input
            type="date"
            required
            value={dataPagamento}
            onChange={(e) => setDataPagamento(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Forma de pagamento">
          <select
            value={formaPagamento}
            onChange={(e) => setFormaPagamento(e.target.value)}
            className="input"
          >
            <option value="PIX">PIX</option>
            <option value="Transferência">Transferência</option>
            <option value="Dinheiro">Dinheiro</option>
            <option value="Boleto">Boleto</option>
            <option value="Outro">Outro</option>
          </select>
        </Field>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:opacity-60 rounded-lg"
          >
            {submitting ? "Registrando..." : "Confirmar pagamento e gerar recibo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function EditPaymentModal({
  payment,
  onClose,
  onSaved,
}: {
  payment: Payment;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [valorAluguel, setValorAluguel] = useState(String(payment.valor_aluguel));
  const [valorAgua, setValorAgua] = useState(String(payment.valor_agua_esgoto));
  const [valorOutros, setValorOutros] = useState(String(payment.valor_outros));
  const [descricaoOutros, setDescricaoOutros] = useState(payment.descricao_outros ?? "");
  const [dataVencimento, setDataVencimento] = useState(payment.data_vencimento.slice(0, 10));
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.put(`/payments/${payment.id}`, {
        valor_aluguel: Number(valorAluguel),
        valor_agua_esgoto: Number(valorAgua || 0),
        valor_outros: Number(valorOutros || 0),
        descricao_outros: descricaoOutros || null,
        data_vencimento: dataVencimento,
      });
      onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, "Não foi possível salvar o pagamento"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Editar lançamento" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">
          {payment.property_nome} — {payment.tenant_nome} — {formatMonth(payment.mes_referencia)}
        </p>
        <Field label="Vencimento">
          <input
            type="date"
            required
            value={dataVencimento}
            onChange={(e) => setDataVencimento(e.target.value)}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Aluguel (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              required
              value={valorAluguel}
              onChange={(e) => setValorAluguel(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Água e Esgoto (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorAgua}
              onChange={(e) => setValorAgua(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <p className="text-xs text-gray-500 -mt-2">
          Ajuste a taxa de água e esgoto deste mês caso o valor tenha variado em relação ao valor
          fixo do contrato.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Outros valores (R$)">
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorOutros}
              onChange={(e) => setValorOutros(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="Descrição">
            <input
              value={descricaoOutros}
              onChange={(e) => setDescricaoOutros(e.target.value)}
              className="input"
              placeholder="Ex: IPTU"
            />
          </Field>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-60 rounded-lg"
          >
            {submitting ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
