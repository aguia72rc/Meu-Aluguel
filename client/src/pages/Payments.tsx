import { Download, Pencil, Receipt, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { api, apiErrorMessage } from "../api/client";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import type { Payment } from "../types";
import { currentMonth, formatCurrency, formatDate, formatMonth } from "../utils/format";

export default function Payments() {
  const [month, setMonth] = useState(currentMonth());
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [payModalPayment, setPayModalPayment] = useState<Payment | null>(null);
  const [editModalPayment, setEditModalPayment] = useState<Payment | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

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
    try {
      const { data } = await api.post("/payments/generate", { mes_referencia: month });
      await load();
      if (data.criados === 0) {
        toast.info("Todos os contratos ativos já possuem pagamento gerado para este mês.");
      } else {
        toast.success(`${data.criados} cobrança(s) gerada(s) para ${formatMonth(month)}.`);
      }
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível gerar os pagamentos do mês"));
    } finally {
      setGenerating(false);
    }
  }

  async function handleDelete(payment: Payment) {
    const ok = await confirm({
      title: "Excluir este lançamento?",
      description: `${payment.property_nome} — ${formatMonth(payment.mes_referencia)}`,
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/payments/${payment.id}`);
      toast.success("Lançamento excluído.");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível excluir o pagamento"));
    }
  }

  async function handleUndo(payment: Payment) {
    const ok = await confirm({
      title: "Desfazer este pagamento?",
      description: "O recibo emitido será removido junto.",
      confirmLabel: "Desfazer",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.post(`/payments/${payment.id}/undo-payment`);
      toast.success("Pagamento desfeito.");
      await load();
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível desfazer o pagamento"));
    }
  }

  async function handleDownloadReceipt(payment: Payment) {
    try {
      const response = await api.get(`/receipts/by-payment/${payment.id}/download`, {
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = `recibo-${payment.property_nome}-${payment.mes_referencia}.pdf`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(apiErrorMessage(err, "Não foi possível baixar o recibo"));
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Pagamentos</h1>
          <p className="text-sm text-ink-muted mt-0.5">Cobranças mensais e recibos</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="input w-auto"
            aria-label="Mês de referência"
          />
          <button onClick={handleGenerate} disabled={generating} className="btn-primary whitespace-nowrap">
            {generating ? "Gerando..." : "Gerar cobranças"}
          </button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-surface-page rounded-lg animate-pulse" />
            ))}
          </div>
        ) : payments.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title={`Nenhum pagamento para ${formatMonth(month)}`}
            description='Clique em "Gerar cobranças" para criar os lançamentos deste mês a partir dos contratos ativos.'
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted border-b border-surface-border">
                  <th className="px-5 py-2.5 font-medium">Imóvel</th>
                  <th className="px-5 py-2.5 font-medium">Inquilino</th>
                  <th className="px-5 py-2.5 font-medium">Vencimento</th>
                  <th className="px-5 py-2.5 font-medium">Aluguel</th>
                  <th className="px-5 py-2.5 font-medium">Água/Esgoto</th>
                  <th className="px-5 py-2.5 font-medium">Total</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr
                    key={p.id}
                    className="border-b border-surface-border/60 last:border-0 hover:bg-surface-page/60 transition"
                  >
                    <td className="px-5 py-3 font-medium text-ink">{p.property_nome}</td>
                    <td className="px-5 py-3 text-ink-secondary">{p.tenant_nome}</td>
                    <td className="px-5 py-3 text-ink-secondary">{formatDate(p.data_vencimento)}</td>
                    <td className="px-5 py-3 text-ink-secondary tabular-nums">
                      {formatCurrency(p.valor_aluguel)}
                    </td>
                    <td className="px-5 py-3 text-ink-secondary tabular-nums">
                      {formatCurrency(p.valor_agua_esgoto)}
                    </td>
                    <td className="px-5 py-3 font-medium text-ink tabular-nums">
                      {formatCurrency(p.valor_total)}
                    </td>
                    <td className="px-5 py-3">
                      <StatusBadge status={p.status} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        {p.status === "pago" ? (
                          <>
                            <button
                              onClick={() => handleDownloadReceipt(p)}
                              className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                              aria-label="Baixar recibo"
                              title="Baixar recibo"
                            >
                              <Download size={15} />
                            </button>
                            <button
                              onClick={() => handleUndo(p)}
                              className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-page rounded-lg transition"
                              aria-label="Desfazer pagamento"
                              title="Desfazer pagamento"
                            >
                              <RotateCcw size={15} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => setPayModalPayment(p)}
                              className="p-1.5 text-ink-muted hover:text-status-good hover:bg-status-good/10 rounded-lg transition"
                              aria-label="Marcar como pago"
                              title="Marcar como pago"
                            >
                              <Receipt size={15} />
                            </button>
                            <button
                              onClick={() => setEditModalPayment(p)}
                              className="p-1.5 text-ink-muted hover:text-primary-600 hover:bg-primary-50 rounded-lg transition"
                              aria-label="Editar lançamento"
                              title="Editar"
                            >
                              <Pencil size={15} />
                            </button>
                            <button
                              onClick={() => handleDelete(p)}
                              className="p-1.5 text-ink-muted hover:text-status-critical hover:bg-status-critical/10 rounded-lg transition"
                              aria-label="Excluir lançamento"
                              title="Excluir"
                            >
                              <Trash2 size={15} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  const toast = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await api.post(`/payments/${payment.id}/pay`, {
        data_pagamento: dataPagamento,
        forma_pagamento: formaPagamento,
      });
      toast.success("Pagamento registrado e recibo gerado.");
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
        <p className="text-sm text-ink-secondary">
          {payment.property_nome} — {payment.tenant_nome} — {formatMonth(payment.mes_referencia)}
        </p>
        <div className="bg-surface-page rounded-xl p-3.5 text-sm space-y-1.5">
          <div className="flex justify-between">
            <span className="text-ink-muted">Aluguel</span>
            <span className="tabular-nums">{formatCurrency(payment.valor_aluguel)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-ink-muted">Água e Esgoto</span>
            <span className="tabular-nums">{formatCurrency(payment.valor_agua_esgoto)}</span>
          </div>
          {payment.valor_outros > 0 && (
            <div className="flex justify-between">
              <span className="text-ink-muted">{payment.descricao_outros || "Outros"}</span>
              <span className="tabular-nums">{formatCurrency(payment.valor_outros)}</span>
            </div>
          )}
          <div className="flex justify-between font-semibold pt-1.5 border-t border-surface-border">
            <span>Total</span>
            <span className="tabular-nums">{formatCurrency(payment.valor_total)}</span>
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
        {error && (
          <p className="text-sm text-status-critical bg-status-critical/5 border border-status-critical/20 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3 pt-2">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancelar
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-status-good px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-60"
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
  const toast = useToast();

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
      toast.success("Lançamento atualizado.");
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
        <p className="text-sm text-ink-secondary">
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
        <p className="text-xs text-ink-muted -mt-2">
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
            {submitting ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
