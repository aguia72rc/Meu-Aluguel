import { Download, Receipt as ReceiptIcon, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import EmptyState from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { downloadReceiptFile } from "../lib/receipts";
import { supabase } from "../lib/supabase";
import type { Receipt } from "../types";
import { formatCurrency, formatDate, formatMonth } from "../utils/format";

interface ReceiptRow {
  id: string;
  payment_id: string;
  numero: string;
  data_emissao: string;
  storage_path: string;
  payments: {
    mes_referencia: string;
    valor_total: number;
    contracts: {
      properties: { nome: string } | null;
      tenants: { nome: string } | null;
    } | null;
  } | null;
}

function flattenReceipt(row: ReceiptRow): Receipt {
  return {
    id: row.id,
    payment_id: row.payment_id,
    numero: row.numero,
    data_emissao: row.data_emissao,
    storage_path: row.storage_path,
    mes_referencia: row.payments?.mes_referencia ?? "",
    valor_total: row.payments?.valor_total ?? 0,
    property_nome: row.payments?.contracts?.properties?.nome ?? "",
    tenant_nome: row.payments?.contracts?.tenants?.nome ?? "",
  };
}

export default function Receipts() {
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const toast = useToast();

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("receipts")
      .select("*, payments(mes_referencia, valor_total, contracts(properties(nome), tenants(nome)))")
      .order("data_emissao", { ascending: false });
    if (error) toast.error(errorMessage(error, "Não foi possível carregar os recibos"));
    setReceipts(((data as unknown as ReceiptRow[]) ?? []).map(flattenReceipt));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return receipts;
    return receipts.filter(
      (r) =>
        r.property_nome.toLowerCase().includes(term) ||
        r.tenant_nome.toLowerCase().includes(term) ||
        r.numero.toLowerCase().includes(term)
    );
  }, [receipts, search]);

  const totalEmitido = useMemo(
    () => receipts.reduce((sum, r) => sum + r.valor_total, 0),
    [receipts]
  );

  async function handleDownload(receipt: Receipt) {
    setDownloadingId(receipt.id);
    try {
      await downloadReceiptFile(receipt.storage_path, `${receipt.numero}.pdf`);
    } catch (err) {
      toast.error(errorMessage(err, "Não foi possível baixar o recibo"));
    } finally {
      setDownloadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-ink">Recibos</h1>
          <p className="text-sm text-ink-muted mt-0.5">
            {receipts.length} recibo{receipts.length === 1 ? "" : "s"} emitido
            {receipts.length === 1 ? "" : "s"} · {formatCurrency(totalEmitido)} no total
          </p>
        </div>
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por imóvel, inquilino ou número"
            className="input pl-9 w-72"
          />
        </div>
      </div>

      <div className="card overflow-hidden">
        {loading ? (
          <div className="p-5 space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-12 bg-surface-page rounded-lg animate-pulse" />
            ))}
          </div>
        ) : receipts.length === 0 ? (
          <EmptyState
            icon={ReceiptIcon}
            title="Nenhum recibo emitido ainda"
            description='Recibos são gerados automaticamente ao marcar um pagamento como pago, na tela de Pagamentos.'
          />
        ) : filtered.length === 0 ? (
          <EmptyState icon={Search} title="Nenhum recibo encontrado" description="Tente outro termo de busca." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-ink-muted border-b border-surface-border">
                  <th className="px-5 py-2.5 font-medium">Nº do recibo</th>
                  <th className="px-5 py-2.5 font-medium">Imóvel</th>
                  <th className="px-5 py-2.5 font-medium">Inquilino</th>
                  <th className="px-5 py-2.5 font-medium">Mês referência</th>
                  <th className="px-5 py-2.5 font-medium">Emitido em</th>
                  <th className="px-5 py-2.5 font-medium">Valor</th>
                  <th className="px-5 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className="border-b border-surface-border/60 last:border-0 hover:bg-surface-page/60 transition"
                  >
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                          <ReceiptIcon size={15} />
                        </div>
                        <span className="font-medium text-ink tabular-nums">{r.numero}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-ink-secondary">{r.property_nome}</td>
                    <td className="px-5 py-3 text-ink-secondary">{r.tenant_nome}</td>
                    <td className="px-5 py-3 text-ink-secondary">{formatMonth(r.mes_referencia)}</td>
                    <td className="px-5 py-3 text-ink-secondary">{formatDate(r.data_emissao)}</td>
                    <td className="px-5 py-3 font-medium text-ink tabular-nums">
                      {formatCurrency(r.valor_total)}
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => handleDownload(r)}
                        disabled={downloadingId === r.id}
                        className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50 transition"
                      >
                        <Download size={14} />
                        Baixar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
