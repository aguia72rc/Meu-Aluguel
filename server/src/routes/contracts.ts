import { Router } from "express";
import { z } from "zod";
import { db } from "../db";

export const contractsRouter = Router();

const contractSchema = z.object({
  property_id: z.number().int().positive(),
  tenant_id: z.number().int().positive(),
  data_inicio: z.string().min(1),
  data_fim: z.string().optional().nullable(),
  dia_vencimento: z.number().int().min(1).max(28).default(5),
  valor_aluguel: z.number().nonnegative().optional(),
  valor_agua_esgoto: z.number().nonnegative().optional(),
  status: z.enum(["ativo", "encerrado"]).optional().default("ativo"),
  observacoes: z.string().optional().nullable(),
});

const CONTRACT_JOIN = `
  SELECT contracts.*,
         properties.nome AS property_nome, properties.endereco AS property_endereco,
         tenants.nome AS tenant_nome
  FROM contracts
  JOIN properties ON properties.id = contracts.property_id
  JOIN tenants ON tenants.id = contracts.tenant_id
`;

contractsRouter.get("/", (_req, res) => {
  const contracts = db.prepare(`${CONTRACT_JOIN} ORDER BY contracts.status ASC, contracts.data_inicio DESC`).all();
  res.json({ contracts });
});

contractsRouter.get("/:id", (req, res) => {
  const contract = db.prepare(`${CONTRACT_JOIN} WHERE contracts.id = ?`).get(req.params.id);
  if (!contract) return res.status(404).json({ error: "Contrato não encontrado" });
  res.json({ contract });
});

contractsRouter.post("/", (req, res) => {
  const parsed = contractSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const c = parsed.data;

  const property = db.prepare("SELECT * FROM properties WHERE id = ?").get(c.property_id) as
    | { valor_aluguel: number; valor_agua_esgoto: number }
    | undefined;
  if (!property) return res.status(400).json({ error: "Imóvel inválido" });

  const tenant = db.prepare("SELECT id FROM tenants WHERE id = ?").get(c.tenant_id);
  if (!tenant) return res.status(400).json({ error: "Inquilino inválido" });

  const valorAluguel = c.valor_aluguel ?? property.valor_aluguel;
  const valorAgua = c.valor_agua_esgoto ?? property.valor_agua_esgoto;

  const result = db
    .prepare(
      `INSERT INTO contracts
       (property_id, tenant_id, data_inicio, data_fim, dia_vencimento, valor_aluguel, valor_agua_esgoto, status, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      c.property_id,
      c.tenant_id,
      c.data_inicio,
      c.data_fim ?? null,
      c.dia_vencimento,
      valorAluguel,
      valorAgua,
      c.status,
      c.observacoes ?? null
    );

  const contract = db.prepare(`${CONTRACT_JOIN} WHERE contracts.id = ?`).get(result.lastInsertRowid);
  res.status(201).json({ contract });
});

contractsRouter.put("/:id", (req, res) => {
  const parsed = contractSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const existing = db.prepare("SELECT * FROM contracts WHERE id = ?").get(req.params.id) as
    | Record<string, unknown>
    | undefined;
  if (!existing) return res.status(404).json({ error: "Contrato não encontrado" });

  const merged = { ...existing, ...parsed.data };
  db.prepare(
    `UPDATE contracts SET property_id = ?, tenant_id = ?, data_inicio = ?, data_fim = ?,
     dia_vencimento = ?, valor_aluguel = ?, valor_agua_esgoto = ?, status = ?, observacoes = ?,
     updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    merged.property_id,
    merged.tenant_id,
    merged.data_inicio,
    merged.data_fim ?? null,
    merged.dia_vencimento,
    merged.valor_aluguel,
    merged.valor_agua_esgoto,
    merged.status,
    merged.observacoes ?? null,
    req.params.id
  );

  const contract = db.prepare(`${CONTRACT_JOIN} WHERE contracts.id = ?`).get(req.params.id);
  res.json({ contract });
});

contractsRouter.delete("/:id", (req, res) => {
  const paymentCount = db
    .prepare("SELECT COUNT(*) as count FROM payments WHERE contract_id = ?")
    .get(req.params.id) as { count: number };

  if (paymentCount.count > 0) {
    return res.status(409).json({
      error: "Não é possível excluir um contrato com pagamentos vinculados. Encerre-o em vez disso.",
    });
  }

  const result = db.prepare("DELETE FROM contracts WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Contrato não encontrado" });
  res.status(204).send();
});
