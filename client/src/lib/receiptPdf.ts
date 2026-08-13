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

// Mesma paleta da interface (tailwind.config.js), para o PDF ficar
// visualmente consistente com o resto do sistema.
type RGB = [number, number, number];
const PRIMARY: RGB = [28, 92, 171];
const INK: RGB = [11, 11, 11];
const INK_SECONDARY: RGB = [82, 81, 78];
const INK_MUTED: RGB = [137, 135, 129];
const SURFACE_PAGE: RGB = [249, 249, 247];
const BORDER: RGB = [225, 224, 217];
const WHITE: RGB = [255, 255, 255];
const SIGNATURE_INK: RGB = [30, 41, 82];

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN_X = 48;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_X * 2;

export function generateReceiptPdfBlob(data: ReceiptData): Blob {
  const doc = new jsPDF({ unit: "pt", format: "a4" });

  drawHeader(doc, data);
  let y = drawInfoSection(doc, 168);
  y = drawPaymentTable(doc, data, y + 20);
  drawFooter(doc, data, y + 30);

  return doc.output("blob");

  function drawInfoSection(d: jsPDF, startY: number): number {
    const gap = 16;
    const colWidth = (CONTENT_WIDTH - gap) / 2;
    const rowHeight = 74;

    drawBox(d, MARGIN_X, startY, colWidth, rowHeight);
    drawLabel(d, "Locador(a)", MARGIN_X + 16, startY + 24);
    drawValue(d, data.proprietarioNome, MARGIN_X + 16, startY + 46);

    const col2X = MARGIN_X + colWidth + gap;
    drawBox(d, col2X, startY, colWidth, rowHeight);
    drawLabel(d, "Locatário(a)", col2X + 16, startY + 24);
    drawValue(d, data.tenantNome, col2X + 16, startY + 46);
    if (data.tenantCpf) {
      drawValue(d, `CPF ${data.tenantCpf}`, col2X + 16, startY + 61, { muted: true, size: 9.5 });
    }

    const propertyY = startY + rowHeight + 14;
    drawBox(d, MARGIN_X, propertyY, CONTENT_WIDTH, rowHeight);
    drawLabel(d, "Imóvel", MARGIN_X + 16, propertyY + 24);
    drawValue(d, data.propertyNome, MARGIN_X + 16, propertyY + 46);
    drawValue(d, data.propertyEndereco, MARGIN_X + 16, propertyY + 61, { muted: true, size: 9.5 });

    return propertyY + rowHeight;
  }
}

function drawHeader(doc: jsPDF, data: ReceiptData) {
  const headerHeight = 118;
  doc.setFillColor(...PRIMARY);
  doc.rect(0, 0, PAGE_WIDTH, headerHeight, "F");

  doc.setFillColor(...WHITE);
  doc.roundedRect(MARGIN_X, 34, 42, 42, 9, 9, "F");
  doc.setTextColor(...PRIMARY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("MA", MARGIN_X + 21, 34 + 27, { align: "center" });

  doc.setTextColor(...WHITE);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Meu Aluguel", MARGIN_X + 56, 34 + 18);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.text("Gestão de imóveis, pagamentos e recibos", MARGIN_X + 56, 34 + 33);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12.5);
  doc.text(TITULO[data.tipo].toUpperCase(), PAGE_WIDTH - MARGIN_X, 34 + 16, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Recibo Nº ${data.numero}`, PAGE_WIDTH - MARGIN_X, 34 + 34, { align: "right" });
  doc.setFontSize(9);
  doc.text(
    `Emitido em ${formatDate(data.dataEmissao)} · Ref. ${formatMonth(data.mesReferencia)}`,
    PAGE_WIDTH - MARGIN_X,
    34 + 50,
    { align: "right" }
  );
}

function drawPaymentTable(doc: jsPDF, data: ReceiptData, startY: number): number {
  let y = startY;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PRIMARY);
  doc.text("DETALHAMENTO DO PAGAMENTO", MARGIN_X, y);
  y += 14;

  const rows: [string, string][] = [[ITEM_LABEL[data.tipo], formatCurrency(data.valor)]];
  if (data.valorOutros > 0) {
    rows.push([data.descricaoOutros || "Outros", formatCurrency(data.valorOutros)]);
  }

  const rowHeight = 28;
  const boxHeight = rows.length * rowHeight + 16;
  const boxTop = y;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.75);
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_X, boxTop, CONTENT_WIDTH, boxHeight, "FD");

  rows.forEach(([label, value], i) => {
    const rowY = boxTop + 20 + i * rowHeight;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.setTextColor(...INK_SECONDARY);
    doc.text(label, MARGIN_X + 16, rowY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...INK);
    doc.text(value, PAGE_WIDTH - MARGIN_X - 16, rowY, { align: "right" });
    if (i < rows.length - 1) {
      doc.setDrawColor(...BORDER);
      doc.setLineWidth(0.5);
      doc.line(MARGIN_X + 16, rowY + rowHeight / 2 + 2, PAGE_WIDTH - MARGIN_X - 16, rowY + rowHeight / 2 + 2);
    }
  });

  y = boxTop + boxHeight + 12;

  const totalHeight = 42;
  doc.setFillColor(...PRIMARY);
  doc.roundedRect(MARGIN_X, y, CONTENT_WIDTH, totalHeight, 6, 6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(...WHITE);
  doc.text("TOTAL PAGO", MARGIN_X + 18, y + totalHeight / 2 + 4);
  doc.setFontSize(15);
  doc.text(formatCurrency(data.valorTotal), PAGE_WIDTH - MARGIN_X - 18, y + totalHeight / 2 + 5, {
    align: "right",
  });

  return y + totalHeight;
}

function drawFooter(doc: jsPDF, data: ReceiptData, startY: number) {
  let y = startY;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK_MUTED);
  const metaParts = [
    `Vencimento: ${formatDate(data.dataVencimento)}`,
    `Pagamento: ${formatDate(data.dataPagamento)}`,
  ];
  if (data.formaPagamento) metaParts.push(`Forma: ${data.formaPagamento}`);
  doc.text(metaParts.join("   ·   "), MARGIN_X, y);
  y += 28;

  doc.setFontSize(9.5);
  doc.setTextColor(...INK_SECONDARY);
  const footerLines = doc.splitTextToSize(RODAPE[data.tipo], CONTENT_WIDTH);
  doc.text(footerLines, MARGIN_X, y);
  y += footerLines.length * 13 + 60;

  const sigWidth = 220;
  const sigX = (PAGE_WIDTH - sigWidth) / 2;
  drawSignatureScribble(doc, sigX + sigWidth / 2, y - 10);
  doc.setDrawColor(...INK_MUTED);
  doc.setLineWidth(0.75);
  doc.line(sigX, y, sigX + sigWidth, y);
  y += 16;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(...INK);
  doc.text(data.proprietarioNome, PAGE_WIDTH / 2, y, { align: "center" });
  y += 13;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...INK_MUTED);
  doc.text("Locador(a)", PAGE_WIDTH / 2, y, { align: "center" });

  const barY = PAGE_HEIGHT - 50;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.75);
  doc.line(MARGIN_X, barY, PAGE_WIDTH - MARGIN_X, barY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...INK_MUTED);
  doc.text("Meu Aluguel · Recibo gerado eletronicamente", MARGIN_X, barY + 16);
  doc.text(`Nº ${data.numero}`, PAGE_WIDTH - MARGIN_X, barY + 16, { align: "right" });
}

// Rubrica estilizada (traço vetorial, não depende de nenhuma fonte
// cursiva) desenhada logo acima da linha de assinatura — um "RC"
// cursivo com floreio, referência às iniciais de Reinaldo Candido.
function drawSignatureScribble(doc: jsPDF, centerX: number, baseY: number) {
  doc.setDrawColor(...SIGNATURE_INK);
  doc.setLineWidth(1.4);
  doc.setLineCap("round");
  doc.setLineJoin("round");

  const startX = centerX - 74;

  const strokeR: [number, number, number, number, number, number][] = [
    [2, -13, 6, -24, 13, -26],
    [8, -2, 12, 3, 11, 10],
    [-1, 7, -8, 10, -13, 8],
    [6, 4, 12, 8, 17, 12],
  ];
  doc.lines(strokeR, startX, baseY, [1, 1], "S", false);

  const strokeC: [number, number, number, number, number, number][] = [
    [-10, -5, -15, -15, -11, -24],
    [3, -8, 12, -11, 20, -9],
  ];
  doc.lines(strokeC, startX + 38, baseY - 2, [1, 1], "S", false);

  const strokeTail: [number, number, number, number, number, number][] = [
    [6, 6, 12, 10, 20, 6],
    [6, -3, 9, -8, 6, -14],
    [-3, -6, -10, -8, -14, -3],
    [5, 8, 16, 14, 28, 8],
    [8, -5, 16, -6, 22, 0],
  ];
  doc.lines(strokeTail, startX + 58, baseY - 12, [1, 1], "S", false);
}

function drawBox(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(...SURFACE_PAGE);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.75);
  doc.roundedRect(x, y, w, h, 6, 6, "FD");
}

function drawLabel(doc: jsPDF, text: string, x: number, y: number) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...PRIMARY);
  doc.text(text.toUpperCase(), x, y);
}

function drawValue(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  opts?: { muted?: boolean; size?: number }
) {
  doc.setFont("helvetica", opts?.muted ? "normal" : "bold");
  doc.setFontSize(opts?.size ?? 11.5);
  doc.setTextColor(...(opts?.muted ? INK_SECONDARY : INK));
  doc.text(text, x, y);
}
