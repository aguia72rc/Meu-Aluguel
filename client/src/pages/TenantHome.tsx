import {
  AlertTriangle,
  Building2,
  CalendarClock,
  Download,
  Droplets,
  Home,
  KeyRound,
  Loader2,
  LogOut,
  Receipt as ReceiptIcon,
} from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { downloadReceiptFile } from "../lib/receipts";
import { supabase } from "../lib/supabase";
import { formatCurrency, formatDate, formatMonth } from "../utils/format";

interface ContractRow {
  id: string;
  data_inicio: string;
  data_fim: string | null;
  status: "ativo" | "encerrado";
  properties: { nome: string; endereco: string } | null;
}

interface PaymentRow {
  id: string;
  tipo: "aluguel" | "agua_esgoto";
  mes_referencia: string;
  valor_total: number;
  data_pagamento: string | null;
  contract_id: string;
  receipts: { numero: string; data_emissao: string; storage_path: string } | { numero: string; data_emissao: string; storage_path: string }[] | null;
}

interface ContractView {
  id: string;
  property_nome: string;
  property_endereco: string;
  data_inicio: string;
  data_fim: string | null;
  status: "ativo" | "encerrado";
  dias_restantes: number | null;
}

interface ReceiptView {
  id: string;
  tipo: "aluguel" | "agua_esgoto";
  mes_referencia: string;
  valor_total: number;
  numero: string;
  data_emissao: string;
  storage_path: string;
  property_nome: string;
}

const TIPO_LABEL: Record<ReceiptView["tipo"], string> = {
  aluguel: "Aluguel",
  agua_esgoto: "Água e Esgoto",
};

const TIPO_ICON = { aluguel: Home, agua_esgoto: Droplets } as const;

function diasRestantes(dataFim: string | null): number | null {
  if (!dataFim) return null;
  const today = new Date();
  const todayIso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(
    today.getDate()
  ).padStart(2, "0")}`;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round(
    (new Date(`${dataFim}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / msPerDay
  );
}

export default function TenantHome() {
  const { tenantId, logout } = useAuth();
  const navigate = useNavigate();
  const [tenantNome, setTenantNome] = useState("");
  const [contracts, setContracts] = useState<ContractView[]>([]);
  const [receipts, setReceipts] = useState<ReceiptView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    load(tenantId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId]);

  async function load(id: string) {
    setLoading(true);
    setError("");
    try {
      const { data: tenant, error: tenantError } = await supabase
        .from("tenants")
        .select("nome")
        .eq("id", id)
        .single();
      if (tenantError || !tenant) throw tenantError ?? new Error("Inquilino não encontrado");
      setTenantNome(tenant.nome);

      const { data: contractRows, error: contractsError } = await supabase
        .from("contracts")
        .select("id, data_inicio, data_fim, status, properties(nome, endereco)")
        .eq("tenant_id", id)
        .order("data_inicio", { ascending: false });
      if (contractsError) throw contractsError;

      const contractsView: ContractView[] = ((contractRows as unknown as ContractRow[]) ?? []).map((c) => ({
        id: c.id,
        property_nome: c.properties?.nome ?? "Imóvel",
        property_endereco: c.properties?.endereco ?? "",
        data_inicio: c.data_inicio,
        data_fim: c.data_fim,
        status: c.status,
        dias_restantes: diasRestantes(c.data_fim),
      }));
      setContracts(contractsView);

      const contractIds = contractsView.map((c) => c.id);
      const propertyByContract = new Map(contractsView.map((c) => [c.id, c.property_nome]));

      if (contractIds.length > 0) {
        const { data: paymentRows, error: paymentsError } = await supabase
          .from("payments")
          .select("id, tipo, mes_referencia, valor_total, data_pagamento, contract_id, receipts(numero, data_emissao, storage_path)")
          .in("contract_id", contractIds)
          .eq("status", "pago")
          .order("data_pagamento", { ascending: false });
        if (paymentsError) throw paymentsError;

        const receiptsView: ReceiptView[] = ((paymentRows as unknown as PaymentRow[]) ?? [])
          .map((p) => {
            const receipt = Array.isArray(p.receipts) ? p.receipts[0] : p.receipts;
            if (!receipt) return null;
            return {
              id: p.id,
              tipo: p.tipo,
              mes_referencia: p.mes_referencia,
              valor_total: p.valor_total,
              numero: receipt.numero,
              data_emissao: receipt.data_emissao,
              storage_path: receipt.storage_path,
              property_nome: propertyByContract.get(p.contract_id) ?? "Imóvel",
            };
          })
          .filter((r): r is ReceiptView => r !== null);
        setReceipts(receiptsView);
      } else {
        setReceipts([]);
      }
    } catch (err) {
      setError(errorMessage(err, "Não foi possível carregar seus dados"));
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(receipt: ReceiptView) {
    setDownloadingId(receipt.id);
    try {
      await downloadReceiptFile(receipt.storage_path, `${receipt.numero}.pdf`);
    } catch (err) {
      setError(errorMessage(err, "Não foi possível baixar o recibo"));
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleLogout() {
    await logout();
    navigate("/login");
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="max-w-2xl mx-auto px-4 py-10 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-ink">Meu Aluguel</h1>
            <p className="text-sm text-ink-muted">Área do inquilino</p>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setPasswordModalOpen(true)}
              className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink transition"
            >
              <KeyRound size={15} />
              Trocar senha
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 text-sm text-ink-muted hover:text-status-critical transition"
            >
              <LogOut size={15} />
              Sair
            </button>
          </div>
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
        ) : (
          <>
            <p className="text-lg font-semibold text-ink">Olá, {tenantNome.split(" ")[0]}!</p>

            <div className="space-y-3">
              {contracts.map((c) => (
                <ContractCard key={c.id} contract={c} />
              ))}
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-3.5 border-b border-surface-border flex items-center gap-2">
                <ReceiptIcon size={16} className="text-primary-600" />
                <h2 className="text-sm font-semibold text-ink">Recibos</h2>
              </div>
              {receipts.length === 0 ? (
                <p className="p-5 text-sm text-ink-muted">Nenhum recibo emitido ainda.</p>
              ) : (
                <div className="divide-y divide-surface-border/60">
                  {receipts.map((r) => {
                    const Icon = TIPO_ICON[r.tipo];
                    return (
                      <button
                        key={r.id}
                        onClick={() => handleDownload(r)}
                        disabled={downloadingId === r.id}
                        className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-page/60 transition disabled:opacity-50 text-left"
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
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {passwordModalOpen && <ChangePasswordModal onClose={() => setPasswordModalOpen(false)} />}
    </div>
  );
}

function ChangePasswordModal({ onClose }: { onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 6) {
      setError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }
    setSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (updateError) {
      setError(errorMessage(updateError, "Não foi possível trocar a senha"));
      return;
    }
    toast.success("Senha alterada.");
    onClose();
  }

  return (
    <Modal title="Trocar senha" onClose={onClose}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-ink-secondary mb-1.5">Nova senha</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink-secondary mb-1.5">Confirmar senha</label>
          <input
            type="password"
            required
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="input"
          />
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

function ContractCard({ contract }: { contract: ContractView }) {
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
