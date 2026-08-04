import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import type { Payment, PaymentSummary } from "../types";
import { formatCurrency, formatDate, formatMonth } from "../utils/format";

export default function Dashboard() {
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [pendentes, setPendentes] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const [summaryRes, paymentsRes] = await Promise.all([
      api.get("/payments/summary"),
      api.get("/payments"),
    ]);
    setSummary(summaryRes.data);
    const all: Payment[] = paymentsRes.data.payments;
    setPendentes(
      all
        .filter((p) => p.status === "pendente" || p.status === "atrasado")
        .sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento))
        .slice(0, 8)
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  if (loading || !summary) {
    return <p className="text-gray-500">Carregando...</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Painel</h1>
        <p className="text-gray-500 text-sm">Resumo de {formatMonth(summary.mesAtual)}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Recebido no mês</p>
          <p className="text-2xl font-bold text-green-600 mt-1">
            {formatCurrency(summary.recebidoMes)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Pendente ({summary.quantidadePendente})</p>
          <p className="text-2xl font-bold text-yellow-600 mt-1">
            {formatCurrency(summary.totalPendente)}
          </p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
          <p className="text-sm text-gray-500">Atrasado ({summary.quantidadeAtrasado})</p>
          <p className="text-2xl font-bold text-red-600 mt-1">
            {formatCurrency(summary.totalAtrasado)}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-gray-900">Próximos pagamentos</h2>
          <Link to="/pagamentos" className="text-sm text-primary-600 hover:underline">
            Ver todos
          </Link>
        </div>
        {pendentes.length === 0 ? (
          <p className="p-5 text-sm text-gray-500">Nenhum pagamento pendente. Tudo em dia!</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-5 py-2 font-medium">Imóvel</th>
                <th className="px-5 py-2 font-medium">Inquilino</th>
                <th className="px-5 py-2 font-medium">Vencimento</th>
                <th className="px-5 py-2 font-medium">Valor</th>
                <th className="px-5 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {pendentes.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 last:border-0">
                  <td className="px-5 py-2.5">{p.property_nome}</td>
                  <td className="px-5 py-2.5">{p.tenant_nome}</td>
                  <td className="px-5 py-2.5">{formatDate(p.data_vencimento)}</td>
                  <td className="px-5 py-2.5">{formatCurrency(p.valor_total)}</td>
                  <td className="px-5 py-2.5">
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        p.status === "atrasado"
                          ? "bg-red-100 text-red-700"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {p.status === "atrasado" ? "Atrasado" : "Pendente"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
