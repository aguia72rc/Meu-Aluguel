import { jsPDF } from "jspdf";
import type { PaymentType } from "../types";
import { formatCurrency, formatDate, formatMonth } from "../utils/format";

export interface ReceiptData {
  numero: string;
  tipo: PaymentType;
  dataEmissao: string;
  proprietarioNome: string;
  tenantNome: string;
  tenantCpf?: string | null;
  propertyNome: string;
  propertyEndereco: string;
  mesReferencia: string;
  dataVencimento: string;
  dataPagamento: string;
  formaPagamento?: string | null;
  valor: number;
  valorOutros: number;
  descricaoOutros?: string | null;
  valorTotal: number;
}

const TITULO: Record<PaymentType, string> = {
  aluguel: "Recibo de Pagamento de Aluguel",
  agua_esgoto: "Recibo de Pagamento de Água e Esgoto",
};

const ITEM_LABEL: Record<PaymentType, string> = {
  aluguel: "Aluguel",
  agua_esgoto: "Taxa de Água e Esgoto",
};

const RODAPE: Record<PaymentType, string> = {
  aluguel:
    "Este recibo confirma o pagamento integral do valor de aluguel acima referente ao imóvel e período indicados.",
  agua_esgoto:
    "Este recibo confirma o pagamento integral da taxa de água e esgoto acima referente ao imóvel e período indicados.",
};

export function generateReceiptPdfBlob(data: ReceiptData): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const marginX = 50;
  let y = 60;

  doc.setFontSize(18);
  doc.text(TITULO[data.tipo], 297.5, y, { align: "center" });
  y += 20;
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  doc.text(`Recibo Nº ${data.numero}`, 297.5, y, { align: "center" });
  doc.setTextColor(0, 0, 0);
  y += 40;

  doc.setFontSize(11);
  doc.text(`Emitido em: ${formatDate(data.dataEmissao)}`, marginX, y);
  y += 16;
  doc.text(`Referente ao mês: ${formatMonth(data.mesReferencia)}`, marginX, y);
  y += 26;

  doc.setFontSize(13);
  doc.text("Locador(a)", marginX, y);
  doc.setLineWidth(0.5);
  doc.line(marginX, y + 2, marginX + 60, y + 2);
  y += 18;
  doc.setFontSize(11);
  doc.text(data.proprietarioNome, marginX, y);
  y += 26;

  doc.setFontSize(13);
  doc.text("Locatário(a)", marginX, y);
  doc.line(marginX, y + 2, marginX + 70, y + 2);
  y += 18;
  doc.setFontSize(11);
  doc.text(data.tenantNome, marginX, y);
  y += 16;
  if (data.tenantCpf) {
    doc.text(`CPF: ${data.tenantCpf}`, marginX, y);
    y += 16;
  }
  y += 10;

  doc.setFontSize(13);
  doc.text("Imóvel", marginX, y);
  doc.line(marginX, y + 2, marginX + 40, y + 2);
  y += 18;
  doc.setFontSize(11);
  doc.text(data.propertyNome, marginX, y);
  y += 16;
  doc.text(data.propertyEndereco, marginX, y);
  y += 30;

  doc.setFontSize(13);
  doc.text("Detalhamento do pagamento", marginX, y);
  doc.line(marginX, y + 2, marginX + 175, y + 2);
  y += 24;

  const rows: [string, string][] = [[ITEM_LABEL[data.tipo], formatCurrency(data.valor)]];
  if (data.valorOutros > 0) {
    rows.push([data.descricaoOutros || "Outros", formatCurrency(data.valorOutros)]);
  }

  doc.setFontSize(11);
  for (const [label, value] of rows) {
    doc.text(label, marginX + 10, y);
    doc.text(value, 500, y, { align: "right" });
    y += 20;
  }

  doc.setDrawColor(136, 136, 136);
  doc.line(marginX + 10, y + 4, 500, y + 4);
  y += 16;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("Total pago", marginX + 10, y);
  doc.text(formatCurrency(data.valorTotal), 500, y, { align: "right" });
  doc.setFont("helvetica", "normal");
  y += 30;

  doc.setFontSize(11);
  doc.text(`Data do vencimento: ${formatDate(data.dataVencimento)}`, marginX + 10, y);
  y += 18;
  doc.text(`Data do pagamento: ${formatDate(data.dataPagamento)}`, marginX + 10, y);
  y += 18;
  if (data.formaPagamento) {
    doc.text(`Forma de pagamento: ${data.formaPagamento}`, marginX + 10, y);
    y += 18;
  }

  y += 26;
  doc.setFontSize(10);
  doc.setTextColor(85, 85, 85);
  const footer = doc.splitTextToSize(RODAPE[data.tipo], 440);
  doc.text(footer, marginX + 10, y);

  return doc.output("blob");
}
