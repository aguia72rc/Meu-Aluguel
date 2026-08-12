import type { PaymentType } from "../types";
import { formatCurrency, formatDate, formatMonth } from "../utils/format";

// Normaliza telefone brasileiro para o formato que o WhatsApp espera
// (só dígitos, com DDI 55 na frente). Retorna null se não parecer válido.
export function normalizePhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 10) return null;
  if (digits.startsWith("55") && digits.length >= 12) return digits;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  return digits;
}

export function buildWhatsAppLink(phone: string | null | undefined, message: string): string | null {
  const normalized = normalizePhone(phone);
  if (!normalized) return null;
  return `https://wa.me/${normalized}?text=${encodeURIComponent(message)}`;
}

const TIPO_LABEL: Record<PaymentType, string> = {
  aluguel: "aluguel",
  agua_esgoto: "água e esgoto",
};

export function reminderMessage(params: {
  tenantNome: string;
  propertyNome: string;
  tipo: PaymentType;
  valorTotal: number;
  dataVencimento: string;
  atrasado: boolean;
}): string {
  const { tenantNome, propertyNome, tipo, valorTotal, dataVencimento, atrasado } = params;
  const primeiroNome = tenantNome.split(" ")[0];
  if (atrasado) {
    return (
      `Olá, ${primeiroNome}! Passando para lembrar que o pagamento de ${TIPO_LABEL[tipo]} do imóvel ` +
      `${propertyNome}, no valor de ${formatCurrency(valorTotal)} (vencimento em ${formatDate(dataVencimento)}), ` +
      `está em atraso. Poderia verificar, por favor?`
    );
  }
  return (
    `Olá, ${primeiroNome}! Passando para lembrar que o pagamento de ${TIPO_LABEL[tipo]} do imóvel ` +
    `${propertyNome}, no valor de ${formatCurrency(valorTotal)}, vence em ${formatDate(dataVencimento)}.`
  );
}

export function receiptMessage(params: {
  tenantNome: string;
  propertyNome: string;
  tipo: PaymentType;
  mesReferencia: string;
  receiptUrl: string;
}): string {
  const { tenantNome, propertyNome, tipo, mesReferencia, receiptUrl } = params;
  const primeiroNome = tenantNome.split(" ")[0];
  return (
    `Olá, ${primeiroNome}! Segue o recibo de pagamento de ${TIPO_LABEL[tipo]} de ${formatMonth(mesReferencia)} ` +
    `referente ao imóvel ${propertyNome}: ${receiptUrl}`
  );
}
