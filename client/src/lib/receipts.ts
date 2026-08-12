import type { PaymentType } from "../types";
import { generateReceiptPdfBlob } from "./receiptPdf";
import { supabase } from "./supabase";

interface PayInput {
  paymentId: string;
  dataPagamento: string;
  formaPagamento: string | null;
}

interface ContractJoin {
  properties: { nome: string; endereco: string };
  tenants: { nome: string; cpf: string | null };
}

const NUMERO_PREFIXO: Record<PaymentType, string> = {
  aluguel: "ALG",
  agua_esgoto: "AGU",
};

export async function markPaymentAsPaid({ paymentId, dataPagamento, formaPagamento }: PayInput) {
  const { data: payment, error: fetchError } = await supabase
    .from("payments")
    .select("*, contracts(properties(nome, endereco), tenants(nome, cpf))")
    .eq("id", paymentId)
    .single();
  if (fetchError || !payment) throw fetchError ?? new Error("Pagamento não encontrado");

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) throw new Error("Sessão expirada, faça login novamente");
  const proprietarioNome =
    (user.user_metadata?.name as string | undefined) || user.email || "Administrador";

  const { error: updateError } = await supabase
    .from("payments")
    .update({ status: "pago", data_pagamento: dataPagamento, forma_pagamento: formaPagamento })
    .eq("id", paymentId);
  if (updateError) throw updateError;

  const tipo = payment.tipo as PaymentType;
  const prefixo = NUMERO_PREFIXO[tipo];
  const year = dataPagamento.slice(0, 4);
  const { count } = await supabase
    .from("receipts")
    .select("id", { count: "exact", head: true })
    .like("numero", `${prefixo}-${year}-%`);
  const numero = `${prefixo}-${year}-${String((count ?? 0) + 1).padStart(5, "0")}`;

  const contract = payment.contracts as unknown as ContractJoin;

  const blob = generateReceiptPdfBlob({
    numero,
    tipo,
    dataEmissao: new Date().toISOString(),
    proprietarioNome,
    tenantNome: contract.tenants.nome,
    tenantCpf: contract.tenants.cpf,
    propertyNome: contract.properties.nome,
    propertyEndereco: contract.properties.endereco,
    mesReferencia: payment.mes_referencia,
    dataVencimento: payment.data_vencimento,
    dataPagamento,
    formaPagamento,
    valor: payment.valor,
    valorOutros: payment.valor_outros,
    descricaoOutros: payment.descricao_outros,
    valorTotal: payment.valor_total,
  });

  const storagePath = `${user.id}/${numero}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("recibos")
    .upload(storagePath, blob, { contentType: "application/pdf" });
  if (uploadError) throw uploadError;

  const { error: insertError } = await supabase
    .from("receipts")
    .insert({ payment_id: paymentId, numero, storage_path: storagePath });
  if (insertError) throw insertError;
}

export async function undoPayment(paymentId: string) {
  const { data: receipt } = await supabase
    .from("receipts")
    .select("id, storage_path")
    .eq("payment_id", paymentId)
    .maybeSingle();

  if (receipt) {
    await supabase.storage.from("recibos").remove([receipt.storage_path]);
    await supabase.from("receipts").delete().eq("id", receipt.id);
  }

  const { error } = await supabase
    .from("payments")
    .update({ status: "pendente", data_pagamento: null, forma_pagamento: null })
    .eq("id", paymentId);
  if (error) throw error;
}

export async function downloadReceiptFile(storagePath: string, filename: string) {
  const { data, error } = await supabase.storage.from("recibos").download(storagePath);
  if (error || !data) throw error ?? new Error("Arquivo não encontrado");
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

// Link temporário (7 dias) para compartilhar o recibo com o inquilino sem
// que ele precise ter login no sistema — usado no envio por WhatsApp.
export async function createReceiptShareLink(storagePath: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("recibos")
    .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
  if (error || !data) throw error ?? new Error("Não foi possível gerar o link do recibo");
  return data.signedUrl;
}
