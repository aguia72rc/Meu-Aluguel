import dayjs from "dayjs";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

const receiptsDir = path.join(__dirname, "..", "..", "receipts");
if (!fs.existsSync(receiptsDir)) {
  fs.mkdirSync(receiptsDir, { recursive: true });
}

export interface ReceiptData {
  numero: string;
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
  valorAluguel: number;
  valorAguaEsgoto: number;
  valorOutros: number;
  descricaoOutros?: string | null;
  valorTotal: number;
}

const MESES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonth(mesReferencia: string): string {
  const [year, month] = mesReferencia.split("-");
  return `${MESES[Number(month) - 1]} de ${year}`;
}

export function receiptFilePath(numero: string): string {
  return path.join(receiptsDir, `${numero}.pdf`);
}

export function generateReceiptPdf(data: ReceiptData): string {
  const filePath = receiptFilePath(data.numero);
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  doc.fontSize(18).text("Recibo de Pagamento de Aluguel", { align: "center" });
  doc.moveDown(0.3);
  doc.fontSize(10).fillColor("#555").text(`Recibo Nº ${data.numero}`, { align: "center" });
  doc.fillColor("#000");
  doc.moveDown(1.5);

  doc.fontSize(11);
  doc.text(`Emitido em: ${dayjs(data.dataEmissao).format("DD/MM/YYYY")}`);
  doc.text(`Referente ao mês: ${formatMonth(data.mesReferencia)}`);
  doc.moveDown(1);

  doc.fontSize(13).text("Locador(a)", { underline: true });
  doc.fontSize(11).text(data.proprietarioNome);
  doc.moveDown(0.8);

  doc.fontSize(13).text("Locatário(a)", { underline: true });
  doc.fontSize(11).text(data.tenantNome);
  if (data.tenantCpf) doc.text(`CPF: ${data.tenantCpf}`);
  doc.moveDown(0.8);

  doc.fontSize(13).text("Imóvel", { underline: true });
  doc.fontSize(11).text(data.propertyNome);
  doc.text(data.propertyEndereco);
  doc.moveDown(1);

  doc.fontSize(13).text("Detalhamento do pagamento", { underline: true });
  doc.moveDown(0.4);

  const rows: [string, string][] = [
    ["Aluguel", formatCurrency(data.valorAluguel)],
    ["Taxa de Água e Esgoto", formatCurrency(data.valorAguaEsgoto)],
  ];
  if (data.valorOutros > 0) {
    rows.push([data.descricaoOutros || "Outros", formatCurrency(data.valorOutros)]);
  }

  const tableTop = doc.y;
  let y = tableTop;
  doc.fontSize(11);
  rows.forEach(([label, value]) => {
    doc.text(label, 60, y);
    doc.text(value, 400, y, { width: 100, align: "right" });
    y += 20;
  });

  doc.moveTo(60, y + 4).lineTo(500, y + 4).strokeColor("#888").stroke();
  y += 12;
  doc.fontSize(12).font("Helvetica-Bold");
  doc.text("Total pago", 60, y);
  doc.text(formatCurrency(data.valorTotal), 400, y, { width: 100, align: "right" });
  doc.font("Helvetica");
  y += 30;

  doc.fontSize(11).text(`Data do vencimento: ${dayjs(data.dataVencimento).format("DD/MM/YYYY")}`, 60, y);
  y += 18;
  doc.text(`Data do pagamento: ${dayjs(data.dataPagamento).format("DD/MM/YYYY")}`, 60, y);
  y += 18;
  if (data.formaPagamento) {
    doc.text(`Forma de pagamento: ${data.formaPagamento}`, 60, y);
    y += 18;
  }

  doc.moveDown(3);
  doc.fontSize(10).fillColor("#555").text(
    "Este recibo confirma o pagamento integral dos valores acima referentes ao aluguel e à taxa de água e esgoto do imóvel e período indicados.",
    60,
    doc.y,
    { width: 440 }
  );

  doc.end();
  return filePath;
}
