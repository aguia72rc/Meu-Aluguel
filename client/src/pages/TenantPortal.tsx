import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Download,
  Droplets,
  Home,
  Loader2,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { formatCurrency, formatDate, formatMonth } from "../utils/format";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface PortalContract {
  id: string;
  property_nome: string;
  property_endereco: string;
  data_inicio: string;
  data_fim: string | null;
  status: "ativo" | "encerrado";
  dias_restantes: number | null;
}

interface PortalReceipt {
  id: string;
  tipo: "aluguel" | "agua_esgoto";
  mes_referencia: string;
  valor_total: number;
  data_pagamento: string | null;
  numero: string;
  data_emissao: string;
  property_nome: string;
  download_url: string;
}

interface PortalData {
  tenant: { nome: string };
  contracts: PortalContract[];
  receipts: PortalReceipt[];
}

const TIPO_LABEL: Record<PortalReceipt["tipo"], string> = {
  aluguel: "Aluguel",
  agua_esgoto: "Água e Esgoto",
};

const TIPO_ICON = { aluguel: Home, agua_esgoto: Droplets } as const;

export default function TenantPortal() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<PortalData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(
          `${SUPABASE_URL}/functions/v1/tenant-portal?token=${encodeURIComponent(token ?? "")}`
        );
        if (!res.ok) {
          throw new Error(
            res.status === 403 ? "Link inválido ou expirado." : "Não foi possível carregar seus dados."
          );
        }
        const json = (await res.json()) as PortalData;
        if (!cancelled) setData(json);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Não foi possível carregar seus dados.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-xl font-bold text-ink">Meu Aluguel</h1>
          <p className="text-sm text-ink-muted">Área do inquilino</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="animate-spin text-ink-muted" size={28} />
          </div>
        ) : error ? (
          <div className="card p-6 text-center space-y-2">
            <AlertTriangle className="mx-auto text-status-critical" size={28} />
            <p className="text-sm text-ink-secondary">{error}</p>
          </div>
        ) : data ? (
          <>
            <p className="text-lg font-semibold text-ink">Olá, {data.tenant.nome.split(" ")[0]}!</p>

            <div className="space-y-3">
              {data.contracts.map((c) => (
                <ContractCard key={c.id} contract={c} />
              ))}
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-surface-border flex items-center gap-2">
                <ReceiptIcon size={16} className="text-primary-600" />
                <h2 className="text-sm font-semibold text-ink">Recibos</h2>
              </div>
              {data.receipts.length === 0 ? (
                <p className="p-5 text-sm text-ink-muted">Nenhum recibo emitido ainda.</p>
              ) : (
                <div className="divide-y divide-surface-border/60">
                  {data.receipts.map((r) => {
                    const Icon = TIPO_ICON[r.tipo];
                    return (
                      <a
                        key={r.id}
                        href={r.download_url}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-page/60 transition"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-9 w-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                            <Icon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink truncate">
                              {TIPO_LABEL[r.tipo]} · {formatMonth(r.mes_referencia)}
                            </p>
                            <p className="text-xs text-ink-muted truncate">
                              {r.property_nome} · {formatCurrency(r.valor_total)}
                            </p>
                          </div>
                        </div>
                        <Download size={16} className="text-ink-muted shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

function ContractCard({ contract }: { contract: PortalContract }) {
  const encerrado = contract.status === "encerrado";
  const dias = contract.dias_restantes;

  let badgeClass = "bg-surface-page text-ink-muted";
  if (!encerrado && dias !== null) {
    if (dias <= 30) badgeClass = "bg-status-critical/10 text-status-critical";
    else if (dias <= 90) badgeClass = "bg-amber-500/10 text-amber-600";
    else badgeClass = "bg-status-good/10 text-status-good";
  }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start gap-3">
        <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
          <Building2 size={18} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink truncate">{contract.property_nome}</p>
          <p className="text-xs text-ink-muted truncate">{contract.property_endereco}</p>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-ink-muted">Vigência do contrato</span>
        <span className="text-ink font-medium">
          {formatDate(contract.data_inicio)} —{" "}
          {contract.data_fim ? formatDate(contract.data_fim) : "indeterminado"}
        </span>
      </div>

      {encerrado ? (
        <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-surface-page text-ink-muted">
          <CalendarClock size={15} />
          Contrato encerrado
        </div>
      ) : dias !== null ? (
        <div className={`flex items-center gap-2 text-sm rounded-lg px-3 py-2 ${badgeClass}`}>
          <CalendarClock size={15} />
          {dias < 0
            ? `Contrato vencido há ${Math.abs(dias)} dia${Math.abs(dias) === 1 ? "" : "s"} — aguardando renovação`
            : dias === 0
              ? "Contrato vence hoje"
              : `Faltam ${dias} dia${dias === 1 ? "" : "s"} para o fim da vigência`}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-sm rounded-lg px-3 py-2 bg-surface-page text-ink-muted">
          <CalendarClock size={15} />
          Contrato por prazo indeterminado
        </div>
      )}
    </div>
  );
}
