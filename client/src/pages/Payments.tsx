import { Banknote, Download, Droplets, MessageCircle, Pencil, Receipt, RotateCcw, Trash2, Wallet } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import EmptyState from "../components/EmptyState";
import Field from "../components/Field";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { useConfirm } from "../context/ConfirmContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { createReceiptShareLink, downloadReceiptFile, markPaymentAsPaid, undoPayment } from "../lib/receipts";
import { supabase } from "../lib/supabase";
import { buildWhatsAppLink, receiptMessage, reminderMessage } from "../lib/whatsapp";
import type { Payment, PaymentType } from "../types";
import { currentMonth, formatCurrency, formatDate, formatMonth, today } from "../utils/format";

interface PaymentRow {
  id: string;
  contract_id: string;
  tipo: PaymentType;
  mes_referencia: string;
  data_vencimento: string;
  valor: number;
  valor_outros: number;
  descricao_outros: string | null;
  valor_total: number;
  status: "pendente" | "pago" | "atrasado" | "cancelado";
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  contracts: {
    dia_vencimento: number;
    dia_vencimento_agua_esgoto: number;
    properties: { nome: string; endereco: string } | null;
    tenants: { nome: string; cpf: string | null; telefone: string | null } | null;
  } | null;
}

function flattenPayment(row: PaymentRow): Payment {
  const computedStatus =
    row.status === "pendente" && row.data_vencimento < today() ? "atrasado" : row.status;
  return {
    ...row,
    status: computedStatus,
    property_nome: row.contracts?.properties?.nome ?? "",
    property_endereco: row.contracts?.properties?.endereco ?? "",
    tenant_nome: row.contracts?.tenants?.nome ?? "",
    tenant_cpf: row.contracts?.tenants?.cpf ?? null,
    tenant_telefone: row.contracts?.tenants?.telefone ?? null,
  };
}

const PAYMENT_SELECT =
  "*, contracts(dia_vencimento, dia_vencimento_agua_esgoto, properties(nome, endereco), tenants(nome, cpf, telefone))";

const TABS: { tipo: PaymentType; label: string; icon: typeof Banknote }[] = [
  { tipo: "aluguel", label: "Aluguel", icon: Banknote },
  { tipo: "agua_esgoto", label: "Água e Esgoto", icon: Droplets },
];

const VALOR_LABEL: Record<PaymentType, string> = {
  aluguel: "Aluguel",
  agua_esgoto: "Água e Esgoto",
};

export default function Payments() {
  const [month, setMonth] = useState(currentMonth());
  const [tipo, setTipo] = useState<PaymentType>("aluguel");
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [payModalPayment, setPayModalPayment] = useState<Payment | null>(null);
  const [editModalPayment, setEditModalPayment] = useState<Payment | null>(null);
  const confirm = useConfirm();
  const toast = useToast();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select(PAYMENT_SELECT)
      .eq("mes_referencia", month)
      .order("data_vencimento", { ascending: false });
    if (error) toast.error(errorMessage(error, "Não foi possível carregar os pagamentos"));
    const rows = ((data as unknown as PaymentRow[]) ?? []).map(flattenPayment);
    rows.sort((a, b) => a.property_nome.localeCompare(b.property_nome));
    setAllPayments(rows);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const payments = allPayments.filter((p) => p.tipo === tipo);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { data: contracts, error: contractsError } = await supabase
        .from("contracts")
        .select("id, dia_vencimento, dia_vencimento_agua_esgoto, valor_aluguel, valor_agua_esgoto")
        .eq("status", "ativo");
      if (contractsError) throw contractsError;

      const rows: {
        contract_id: string;
        tipo: PaymentType;
        mes_referencia: string;
        data_vencimento: string;
        valor: number;
        valor_total: number;
      }[] = [];

      for (const c of contracts ?? []) {
        const rentDueDay = Math.min(c.dia_vencimento, 28);
        rows.push({
          contract_id: c.id,
          tipo: "aluguel",
          mes_referencia: month,
          data_vencimento: `${month}-${String(rentDueDay).padStart(2, "0")}`,
          valor: c.valor_aluguel,
          valor_total: c.valor_aluguel,
        });
        if (c.valor_agua_esgoto > 0) {
          const waterDueDay = Math.min(c.dia_vencimento_agua_esgoto, 28);
          rows.push({
            contract_id: c.id,
            tipo: "agua_esgoto",
            mes_referencia: month,
            data_vencimento: `${month}-${String(waterDueDay).padStart(2, "0")}`,
            valor: c.valor_agua_esgoto,
            valor_total: c.valor_agua_esgoto,
          });
        }
      }

      if (rows.length === 0) {
        toast.info("Nenhum contrato ativo encontrado.");
        return;
      }

      const { data: inserted, error: upsertError } = await supabase
        .from("payments")
        .upsert(rows, { onConflict: "contract_id,mes_referencia,tipo", ignoreDuplicates: true })
        .select("id");
      if (upsertError) throw upsertError;

      await load();
      if (!inserted || inserted.length === 0) {
        toast.info("Todos os contratos ativos já possuem cobrança gerada para este mês.");
      } else {
        toast.success(`${inserted.length} cobrança(s) gerada(s) para ${formatMonth(month)}.`);
      }
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível gerar os pagamentos do mês"));
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
    const { error } = await supabase.from("payments").delete().eq("id", payment.id);
    if (error) {
      toast.error(errorMessage(error, "Não foi possível excluir o pagamento"));
      return;
    }
    toast.success("Lançamento excluído.");
    await load();
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
      await undoPayment(payment.id);
      toast.success("Pagamento desfeito.");
      await load();
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível desfazer o pagamento"));
    }
  }

  async function handleDownloadReceipt(payment: Payment) {
    try {
      const { data: receipt, error } = await supabase
        .from("receipts")
        .select("storage_path")
        .eq("payment_id", payment.id)
        .single();
      if (error || !receipt) throw error ?? new Error("Recibo não encontrado");
      await downloadReceiptFile(
        receipt.storage_path,
        `recibo-${payment.tipo}-${payment.property_nome}-${payment.mes_referencia}.pdf`
      );
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível baixar o recibo"));
    }
  }

  function handleSendReminder(payment: Payment) {
    const message = reminderMessage({
      tenantNome: payment.tenant_nome,
      propertyNome: payment.property_nome,
      tipo: payment.tipo,
      valorTotal: payment.valor_total,
      dataVencimento: payment.data_vencimento,
      atrasado: payment.status === "atrasado",
    });
    const link = buildWhatsAppLink(payment.tenant_telefone, message);
    if (!link) {
      toast.error("Inquilino sem telefone cadastrado (ou número inválido).");
      return;
    }
    window.open(link, "_blank");
  }

  async function handleSendReceipt(payment: Payment) {
    try {
      const { data: receipt, error } = await supabase
        .from("receipts")
        .select("storage_path")
        .eq("payment_id", payment.id)
        .single();
      if (error || !receipt) throw error ?? new Error("Recibo não encontrado");
      const receiptUrl = await createReceiptShareLink(receipt.storage_path);
      const message = receiptMessage({
        tenantNome: payment.tenant_nome,
        propertyNome: payment.property_nome,
        tipo: payment.tipo,
        mesReferencia: payment.mes_referencia,
        receiptUrl,
      });
      const link = buildWhatsAppLink(payment.tenant_telefone, message);
      if (!link) {
        toast.error("Inquilino sem telefone cadastrado (ou número inválido).");
        return;
      }
      window.open(link, "_blank");
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível enviar o recibo"));
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

      <div className="flex gap-1 border-b border-surface-border">
        {TABS.map((tab) => {
          const count = allPayments.filter(
            (p) => p.tipo === tab.tipo && p.status !== "pago"
          ).length;
          return (
            <button
              key={tab.tipo}
              onClick={() => setTipo(tab.tipo)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                tipo === tab.tipo
                  ? "border-primary-500 text-primary-700"
                  : "border-transparent text-ink-secondary hover:text-ink"
              }`}
            >
              <tab.icon size={16} />
              {tab.label}
              {count > 0 && (
                <span className="inline-flex items-center justify-center min-w-5 h-5 px-1 rounded-full bg-surface-page text-xs text-ink-muted">
                  {count}
                </span>
              )}
            </button>
          );
        })}
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
            title={`Nenhum pagamento de ${VALOR_LABEL[tipo].toLowerCase()} para ${formatMonth(month)}`}
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
                  <th className="px-5 py-2.5 font-medium">Valor</th>
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
                              onClick={() => handleSendReceipt(p)}
                              className="p-1.5 text-ink-muted hover:text-status-good hover:bg-status-good/10 rounded-lg transition"
                              aria-label="Enviar recibo por WhatsApp"
                              title="Enviar recibo por WhatsApp"
                            >
                              <MessageCircle size={15} />
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
                              onClick={() => handleSendReminder(p)}
                              className="p-1.5 text-ink-muted hover:text-status-good hover:bg-status-good/10 rounded-lg transition"
                              aria-label="Enviar lembrete por WhatsApp"
                              title="Enviar lembrete por WhatsApp"
                            >
                              <MessageCircle size={15} />
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
  const [dataPagamento, setDataPagamento] = useState(today());
  const [formaPagamento, setFormaPagamento] = useState("PIX");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    try {
      await markPaymentAsPaid({ paymentId: payment.id, dataPagamento, formaPagamento });
      toast.success("Pagamento registrado e recibo gerado.");
      onPaid();
    } catch (err) {
      setError(errorMessage(err, "Não foi possível registrar o pagamento"));
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
            <span className="text-ink-muted">{VALOR_LABEL[payment.tipo]}</span>
            <span className="tabular-nums">{formatCurrency(payment.valor)}</span>
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
  const [valor, setValor] = useState(String(payment.valor));
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
    const valorTotal = Number(valor) + Number(valorOutros || 0);
    const { error: dbError } = await supabase
      .from("payments")
      .update({
        valor: Number(valor),
        valor_outros: Number(valorOutros || 0),
        descricao_outros: descricaoOutros || null,
        data_vencimento: dataVencimento,
        valor_total: valorTotal,
      })
      .eq("id", payment.id);
    if (dbError) {
      setError(errorMessage(dbError, "Não foi possível salvar o pagamento"));
      setSubmitting(false);
      return;
    }
    toast.success("Lançamento atualizado.");
    setSubmitting(false);
    onSaved();
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
        <Field label={`${VALOR_LABEL[payment.tipo]} (R$)`}>
          <input
            type="number"
            step="0.01"
            min="0"
            required
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="input"
          />
        </Field>
        {payment.tipo === "agua_esgoto" && (
          <p className="text-xs text-ink-muted -mt-2">
            Ajuste esse valor caso a conta de água/esgoto tenha variado em relação ao valor fixo
            do contrato.
          </p>
        )}
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
              placeholder="Ex: multa por atraso"
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
