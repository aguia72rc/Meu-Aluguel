import { AlertCircle, ArrowRight, CircleDollarSign, Clock, Droplets, Home } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RevenueChart, { type RevenuePoint } from "../components/RevenueChart";
import StatusBadge from "../components/StatusBadge";
import { errorMessage } from "../lib/errors";
import { supabase } from "../lib/supabase";
import type { Payment, PaymentSummary, PaymentType } from "../types";
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

const TIPO_ICON: Record<PaymentType, typeof Home> = {
  aluguel: Home,
  agua_esgoto: Droplets,
};

const TIPO_LABEL: Record<PaymentType, string> = {
  aluguel: "Aluguel",
  agua_esgoto: "Água e Esgoto",
};

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

const MESES_ABREV = [
  "Jan",
  "Fev",
  "Mar",
  "Abr",
  "Mai",
  "Jun",
  "Jul",
  "Ago",
  "Set",
  "Out",
  "Nov",
  "Dez",
];

function lastMonths(count: number): string[] {
  const now = new Date();
  const months: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [pendentes, setPendentes] = useState<Payment[]>([]);
  const [chartData, setChartData] = useState<RevenuePoint[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("payments")
      .select(
        "*, contracts(dia_vencimento, dia_vencimento_agua_esgoto, properties(nome, endereco), tenants(nome, cpf))"
      );
    if (error) {
      console.error(errorMessage(error));
      setLoading(false);
      return;
    }
    const all: Payment[] = ((data as unknown as PaymentRow[]) ?? []).map(flattenPayment);

    const mesAtual = currentMonth();
    const recebidoMes = all
      .filter((p) => p.status === "pago" && p.mes_referencia === mesAtual)
      .reduce((sum, p) => sum + p.valor_total, 0);
    const pendentesList = all.filter((p) => p.status === "pendente");
    const atrasadosList = all.filter((p) => p.status === "atrasado");
    setSummary({
      mesAtual,
      recebidoMes,
      totalPendente: pendentesList.reduce((sum, p) => sum + p.valor_total, 0),
      totalAtrasado: atrasadosList.reduce((sum, p) => sum + p.valor_total, 0),
      quantidadePendente: pendentesList.length,
      quantidadeAtrasado: atrasadosList.length,
    });

    setPendentes(
      all
        .filter((p) => p.status === "pendente" || p.status === "atrasado")
        .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
        .slice(0, 8)
    );

    const months = lastMonths(6);
    const paidByMonth = new Map<string, number>();
    for (const p of all) {
      if (p.status === "pago") {
        paidByMonth.set(p.mes_referencia, (paidByMonth.get(p.mes_referencia) || 0) + p.valor_total);
      }
    }
    setChartData(
      months.map((m) => ({
        label: MESES_ABREV[Number(m.split("-")[1]) - 1],
        value: paidByMonth.get(m) || 0,
      }))
    );

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading || !summary) {
    return (
      <div className="space-y-8 animate-pulse">
        <div className="h-8 w-48 bg-surface-border rounded" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-28 bg-surface-border rounded-2xl" />
          ))}
        </div>
        <div className="h-64 bg-surface-border rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-ink">Painel</h1>
        <p className="text-ink-muted text-sm mt-0.5">Resumo de {formatMonth(summary.mesAtual)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard
          icon={CircleDollarSign}
          tone="good"
          label="Recebido no mês"
          value={formatCurrency(summary.recebidoMes)}
        />
        <StatCard
          icon={Clock}
          tone="warning"
          label={`Pendente (${summary.quantidadePendente})`}
          value={formatCurrency(summary.totalPendente)}
        />
        <StatCard
          icon={AlertCircle}
          tone="critical"
          label={`Atrasado (${summary.quantidadeAtrasado})`}
          value={formatCurrency(summary.totalAtrasado)}
        />
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="font-semibold text-ink mb-1">Receita recebida — últimos 6 meses</h2>
        <p className="text-sm text-ink-muted mb-4">Soma de aluguel e água/esgoto por mês de pagamento</p>
        <RevenueChart data={chartData} />
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-border">
          <h2 className="font-semibold text-ink">Próximos pagamentos</h2>
          <Link
            to="/pagamentos"
            className="text-sm text-primary-600 hover:text-primary-700 font-medium inline-flex items-center gap-1"
          >
            Ver todos <ArrowRight size={14} />
          </Link>
        </div>
        {pendentes.length === 0 ? (
          <p className="p-8 text-sm text-ink-muted text-center">
            Nenhum pagamento pendente. Tudo em dia!
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted border-b border-surface-border">
                  <th className="px-5 py-2.5 font-medium">Imóvel</th>
                  <th className="px-5 py-2.5 font-medium">Tipo</th>
                  <th className="px-5 py-2.5 font-medium">Inquilino</th>
                  <th className="px-5 py-2.5 font-medium">Vencimento</th>
                  <th className="px-5 py-2.5 font-medium">Valor</th>
                  <th className="px-5 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pendentes.map((p) => {
                  const TipoIcon = TIPO_ICON[p.tipo];
                  return (
                    <tr key={p.id} className="border-b border-surface-border/60 last:border-0 hover:bg-surface-page/60 transition">
                      <td className="px-5 py-3 font-medium text-ink">{p.property_nome}</td>
                      <td className="px-5 py-3 text-ink-secondary">
                        <span className="inline-flex items-center gap-1.5">
                          <TipoIcon size={14} className="text-ink-muted" />
                          {TIPO_LABEL[p.tipo]}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-ink-secondary">{p.tenant_nome}</td>
                      <td className="px-5 py-3 text-ink-secondary">{formatDate(p.data_vencimento)}</td>
                      <td className="px-5 py-3 text-ink-secondary tabular-nums">{formatCurrency(p.valor_total)}</td>
                      <td className="px-5 py-3">
                        <StatusBadge status={p.status === "atrasado" ? "atrasado" : "pendente"} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  tone,
  label,
  value,
}: {
  icon: typeof CircleDollarSign;
  tone: "good" | "warning" | "critical";
  label: string;
  value: string;
}) {
  const toneClasses = {
    good: "bg-status-good/10 text-status-good",
    warning: "bg-status-warning/15 text-[#9a6a00]",
    critical: "bg-status-critical/10 text-status-critical",
  }[tone];
  const valueClasses = {
    good: "text-status-good",
    warning: "text-[#9a6a00]",
    critical: "text-status-critical",
  }[tone];

  return (
    <div className="card p-5 flex items-start gap-4">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${toneClasses}`}>
        <Icon size={20} />
      </div>
      <div className="min-w-0">
        <p className="text-sm text-ink-muted">{label}</p>
        <p className={`text-2xl font-bold mt-0.5 tabular-nums ${valueClasses}`}>{value}</p>
      </div>
    </div>
  );
}
