import dayjs from "dayjs";
import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { AuthedRequest } from "../middleware/auth";
import { generateReceiptPdf } from "../utils/receiptPdf";

export const paymentsRouter = Router();

const PAYMENT_JOIN = `
  SELECT payments.*,
         contracts.property_id, contracts.tenant_id, contracts.dia_vencimento,
         properties.nome AS property_nome, properties.endereco AS property_endereco,
         tenants.nome AS tenant_nome, tenants.cpf AS tenant_cpf
  FROM payments
  JOIN contracts ON contracts.id = payments.contract_id
  JOIN properties ON properties.id = contracts.property_id
  JOIN tenants ON tenants.id = contracts.tenant_id
`;

interface PaymentRow {
  id: number;
  contract_id: number;
  mes_referencia: string;
  data_vencimento: string;
  status: string;
  [key: string]: unknown;
}

function withComputedStatus<T extends PaymentRow>(payment: T): T {
  if (payment.status === "pendente" && dayjs(payment.data_vencimento).isBefore(dayjs(), "day")) {
    return { ...payment, status: "atrasado" };
  }
  return payment;
}

paymentsRouter.get("/", (req, res) => {
  const { status, mes_referencia, contract_id } = req.query;
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (mes_referencia) {
    conditions.push("payments.mes_referencia = ?");
    params.push(mes_referencia);
  }
  if (contract_id) {
    conditions.push("payments.contract_id = ?");
    params.push(contract_id);
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
  let payments = db
    .prepare(`${PAYMENT_JOIN} ${where} ORDER BY payments.data_vencimento DESC`)
    .all(...params) as PaymentRow[];

  payments = payments.map(withComputedStatus);

  if (status) {
    payments = payments.filter((p) => p.status === status);
  }

  res.json({ payments });
});

paymentsRouter.get("/summary", (_req, res) => {
  const currentMonth = dayjs().format("YYYY-MM");
  let payments = db.prepare(PAYMENT_JOIN).all() as PaymentRow[];
  payments = payments.map(withComputedStatus);

  const recebidoMes = payments
    .filter((p) => p.status === "pago" && p.mes_referencia === currentMonth)
    .reduce((sum, p) => sum + (p.valor_total as number), 0);

  const pendentes = payments.filter((p) => p.status === "pendente");
  const atrasados = payments.filter((p) => p.status === "atrasado");

  const totalPendente = pendentes.reduce((sum, p) => sum + (p.valor_total as number), 0);
  const totalAtrasado = atrasados.reduce((sum, p) => sum + (p.valor_total as number), 0);

  res.json({
    mesAtual: currentMonth,
    recebidoMes,
    totalPendente,
    totalAtrasado,
    quantidadePendente: pendentes.length,
    quantidadeAtrasado: atrasados.length,
  });
});

paymentsRouter.get("/:id", (req, res) => {
  const payment = db.prepare(`${PAYMENT_JOIN} WHERE payments.id = ?`).get(req.params.id) as
    | PaymentRow
    | undefined;
  if (!payment) return res.status(404).json({ error: "Pagamento não encontrado" });
  res.json({ payment: withComputedStatus(payment) });
});

// Gera os lançamentos de pagamento (aluguel + água/esgoto) do mês para todos os contratos ativos
const generateSchema = z.object({
  mes_referencia: z.string().regex(/^\d{4}-\d{2}$/),
});

paymentsRouter.post("/generate", (req, res) => {
  const parsed = generateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "mes_referencia deve estar no formato YYYY-MM" });
  }
  const { mes_referencia } = parsed.data;

  const contracts = db
    .prepare("SELECT * FROM contracts WHERE status = 'ativo'")
    .all() as {
    id: number;
    dia_vencimento: number;
    valor_aluguel: number;
    valor_agua_esgoto: number;
  }[];

  const insertStmt = db.prepare(
    `INSERT OR IGNORE INTO payments
     (contract_id, mes_referencia, data_vencimento, valor_aluguel, valor_agua_esgoto, valor_total)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const created: number[] = [];
  const tx = db.transaction(() => {
    for (const contract of contracts) {
      const dueDay = Math.min(contract.dia_vencimento, 28);
      const dataVencimento = `${mes_referencia}-${String(dueDay).padStart(2, "0")}`;
      const valorTotal = contract.valor_aluguel + contract.valor_agua_esgoto;
      const result = insertStmt.run(
        contract.id,
        mes_referencia,
        dataVencimento,
        contract.valor_aluguel,
        contract.valor_agua_esgoto,
        valorTotal
      );
      if (result.changes > 0) created.push(result.lastInsertRowid as number);
    }
  });
  tx();

  res.status(201).json({ criados: created.length });
});

const updateSchema = z.object({
  valor_aluguel: z.number().nonnegative().optional(),
  valor_agua_esgoto: z.number().nonnegative().optional(),
  valor_outros: z.number().nonnegative().optional(),
  descricao_outros: z.string().optional().nullable(),
  data_vencimento: z.string().optional(),
  observacoes: z.string().optional().nullable(),
});

paymentsRouter.put("/:id", (req, res) => {
  const parsed = updateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const existing = db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return res.status(404).json({ error: "Pagamento não encontrado" });
  if (existing.status === "pago") {
    return res.status(409).json({ error: "Não é possível editar um pagamento já quitado" });
  }

  const merged = { ...existing, ...parsed.data };
  const valorTotal =
    (merged.valor_aluguel as number) +
    (merged.valor_agua_esgoto as number) +
    (merged.valor_outros as number);

  db.prepare(
    `UPDATE payments SET valor_aluguel = ?, valor_agua_esgoto = ?, valor_outros = ?,
     descricao_outros = ?, data_vencimento = ?, observacoes = ?, valor_total = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    merged.valor_aluguel,
    merged.valor_agua_esgoto,
    merged.valor_outros,
    merged.descricao_outros ?? null,
    merged.data_vencimento,
    merged.observacoes ?? null,
    valorTotal,
    req.params.id
  );

  const payment = db.prepare(`${PAYMENT_JOIN} WHERE payments.id = ?`).get(req.params.id);
  res.json({ payment });
});

const paySchema = z.object({
  data_pagamento: z.string().optional(),
  forma_pagamento: z.string().optional().nullable(),
});

paymentsRouter.post("/:id/pay", (req: AuthedRequest, res) => {
  const parsed = paySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const payment = db.prepare(`${PAYMENT_JOIN} WHERE payments.id = ?`).get(req.params.id) as
    | PaymentRow
    | undefined;
  if (!payment) return res.status(404).json({ error: "Pagamento não encontrado" });
  if (payment.status === "pago") {
    return res.status(409).json({ error: "Pagamento já está quitado" });
  }

  const dataPagamento = parsed.data.data_pagamento || dayjs().format("YYYY-MM-DD");
  const formaPagamento = parsed.data.forma_pagamento ?? null;

  db.prepare(
    `UPDATE payments SET status = 'pago', data_pagamento = ?, forma_pagamento = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(dataPagamento, formaPagamento, req.params.id);

  const owner = db.prepare("SELECT name FROM users WHERE id = ?").get(req.userId) as
    | { name: string }
    | undefined;

  // Gera o recibo em PDF automaticamente
  const year = dayjs(dataPagamento).format("YYYY");
  const countRow = db
    .prepare("SELECT COUNT(*) as count FROM receipts WHERE numero LIKE ?")
    .get(`REC-${year}-%`) as { count: number };
  const numero = `REC-${year}-${String(countRow.count + 1).padStart(5, "0")}`;

  const filePath = generateReceiptPdf({
    numero,
    dataEmissao: dayjs().toISOString(),
    proprietarioNome: owner?.name || "Administrador",
    tenantNome: payment.tenant_nome as string,
    tenantCpf: payment.tenant_cpf as string | null,
    propertyNome: payment.property_nome as string,
    propertyEndereco: payment.property_endereco as string,
    mesReferencia: payment.mes_referencia,
    dataVencimento: payment.data_vencimento,
    dataPagamento,
    formaPagamento,
    valorAluguel: payment.valor_aluguel as number,
    valorAguaEsgoto: payment.valor_agua_esgoto as number,
    valorOutros: payment.valor_outros as number,
    descricaoOutros: payment.descricao_outros as string | null,
    valorTotal: payment.valor_total as number,
  });

  db.prepare(
    `INSERT INTO receipts (payment_id, numero, arquivo) VALUES (?, ?, ?)`
  ).run(payment.id, numero, filePath);

  const updatedPayment = db.prepare(`${PAYMENT_JOIN} WHERE payments.id = ?`).get(req.params.id);
  const receipt = db.prepare("SELECT * FROM receipts WHERE payment_id = ?").get(payment.id);
  res.json({ payment: updatedPayment, receipt });
});

paymentsRouter.post("/:id/undo-payment", (req, res) => {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id) as
    | { status: string }
    | undefined;
  if (!payment) return res.status(404).json({ error: "Pagamento não encontrado" });
  if (payment.status !== "pago") {
    return res.status(409).json({ error: "Pagamento não está quitado" });
  }

  db.prepare("DELETE FROM receipts WHERE payment_id = ?").run(req.params.id);
  db.prepare(
    `UPDATE payments SET status = 'pendente', data_pagamento = NULL, forma_pagamento = NULL, updated_at = datetime('now')
     WHERE id = ?`
  ).run(req.params.id);

  const updated = db.prepare(`${PAYMENT_JOIN} WHERE payments.id = ?`).get(req.params.id);
  res.json({ payment: withComputedStatus(updated as PaymentRow) });
});

paymentsRouter.delete("/:id", (req, res) => {
  const payment = db.prepare("SELECT * FROM payments WHERE id = ?").get(req.params.id) as
    | { status: string }
    | undefined;
  if (!payment) return res.status(404).json({ error: "Pagamento não encontrado" });
  if (payment.status === "pago") {
    return res.status(409).json({ error: "Não é possível excluir um pagamento já quitado" });
  }
  db.prepare("DELETE FROM payments WHERE id = ?").run(req.params.id);
  res.status(204).send();
});
