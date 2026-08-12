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
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import EmptyState from "../components/EmptyState";
import Modal from "../components/Modal";
import StatusBadge from "../components/StatusBadge";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { errorMessage } from "../lib/errors";
import { downloadReceiptFile } from "../lib/receipts";
import { supabase } from "../lib/supabase";
import type { PaymentType } from "../types";
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
  tipo: PaymentType;
  mes_referencia: string;
  valor_total: number;
  data_pagamento: string | null;
  contract_id: string;
  receipts:
    | { numero: string; data_emissao: string; storage_path: string }
    | { numero: string; data_emissao: string; storage_path: string }[]
    | null;
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
  tipo: PaymentType;
  mes_referencia: string;
  valor_total: number;
  numero: string;
  data_emissao: string;
  storage_path: string;
  property_nome: string;
}

const TABS: { tipo: PaymentType; label: string; icon: typeof Home }[] = [
  { tipo: "aluguel", label: "Aluguel", icon: Home },
  { tipo: "agua_esgoto", label: "Água e Esgoto", icon: Droplets },
];

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
  const [tipoTab, setTipoTab] = useState<PaymentType>("aluguel");

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
          .select(
            "id, tipo, mes_referencia, valor_total, data_pagamento, contract_id, receipts(numero, data_emissao, storage_path)"
          )
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

  const activeContract = useMemo(() => contracts.find((c) => c.status === "ativo") ?? null, [contracts]);
  const filteredReceipts = useMemo(() => receipts.filter((r) => r.tipo === tipoTab), [receipts, tipoTab]);
  const primeiroNome = tenantNome.split(" ")[0];

  return (
    <div className="min-h-screen bg-surface-page">
      <header className="bg-white border-b border-surface-border">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary-500 text-white flex items-center justify-center font-bold text-sm">
              MA
            </div>
            <span className="font-semibold text-ink">Meu Aluguel</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPasswordModalOpen(true)}
              className="p-2 text-ink-muted hover:text-ink hover:bg-surface-page rounded-lg transition"
              aria-label="Trocar senha"
              title="Trocar senha"
            >
              <KeyRound size={17} />
            </button>
            <button
              onClick={handleLogout}
              className="p-2 text-ink-muted hover:text-status-critical hover:bg-status-critical/10 rounded-lg transition"
              aria-label="Sair"
              title="Sair"
            >
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-8">
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
            <div className="relative overflow-hidden rounded-2xl bg-primary-700 text-white px-6 py-7 sm:px-8 sm:py-8">
              <div
                aria-hidden
                className="absolute -top-20 -right-16 h-64 w-64 rounded-full bg-white/10 blur-3xl"
              />
              <div
                aria-hidden
                className="absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-primary-900/30 blur-3xl"
              />
              <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                <div>
                  <p className="text-primary-100 text-sm">Bem-vindo(a) de volta</p>
                  <h1 className="text-2xl sm:text-3xl font-bold mt-1">Olá, {primeiroNome}!</h1>
                  {activeContract && (
                    <p className="text-primary-100 text-sm mt-2">{activeContract.property_nome}</p>
                  )}
                </div>
                {activeContract && activeContract.dias_restantes !== null && (
                  <div className="bg-white/10 rounded-xl px-6 py-4 text-center shrink-0">
                    <p className="text-3xl font-bold tabular-nums">
                      {Math.abs(activeContract.dias_restantes)}
                    </p>
                    <p className="text-xs text-primary-100 mt-1 max-w-[9rem]">
                      {activeContract.dias_restantes < 0
                        ? "dias em atraso — aguardando renovação"
                        : "dias até o fim do contrato"}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-ink-secondary">
                {contracts.length > 1 ? "Meus contratos" : "Meu contrato"}
              </h2>
              {contracts.length === 0 ? (
                <div className="card">
                  <EmptyState
                    icon={Building2}
                    title="Nenhum contrato vinculado"
                    description="Fale com o administrador se isso não parecer certo."
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {contracts.map((c) => (
                    <ContractCard key={c.id} contract={c} />
                  ))}
                </div>
              )}
            </div>

            <div className="card overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2">
                <ReceiptIcon size={16} className="text-primary-600" />
                <h2 className="text-sm font-semibold text-ink">Recibos</h2>
              </div>

              <div className="flex gap-1 px-5 border-b border-surface-border">
                {TABS.map((tab) => {
                  const count = receipts.filter((r) => r.tipo === tab.tipo).length;
                  return (
                    <button
                      key={tab.tipo}
                      onClick={() => setTipoTab(tab.tipo)}
                      className={`flex items-center gap-2 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${
                        tipoTab === tab.tipo
                          ? "border-primary-500 text-primary-700"
                          : "border-transparent text-ink-secondary hover:text-ink"
                      }`}
                    >
                      <tab.icon size={15} />
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

              {filteredReceipts.length === 0 ? (
                <EmptyState
                  icon={ReceiptIcon}
                  title="Nenhum recibo por aqui ainda"
                  description="Assim que um pagamento for confirmado, o recibo aparece nesta lista."
                />
              ) : (
                <div className="divide-y divide-surface-border/60">
                  {filteredReceipts.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => handleDownload(r)}
                      disabled={downloadingId === r.id}
                      className="w-full flex items-center justify-between gap-3 px-5 py-3.5 hover:bg-surface-page/60 transition disabled:opacity-50 text-left"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-9 w-9 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
                          <ReceiptIcon size={16} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-ink truncate">
                            {formatMonth(r.mes_referencia)}
                          </p>
                          <p className="text-xs text-ink-muted truncate">
                            {r.property_nome} · {formatCurrency(r.valor_total)}
                          </p>
                        </div>
                      </div>
                      <span className="flex items-center gap-1.5 text-xs font-medium text-primary-600 shrink-0">
                        <Download size={14} />
                        Baixar
                      </span>
                    </button>
                  ))}
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 rounded-lg bg-primary-50 text-primary-600 flex items-center justify-center shrink-0">
            <Building2 size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{contract.property_nome}</p>
            <p className="text-xs text-ink-muted truncate">{contract.property_endereco}</p>
          </div>
        </div>
        <StatusBadge status={contract.status} />
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
