import { Router } from "express";
import { z } from "zod";
import { db } from "../db";

export const tenantsRouter = Router();

const tenantSchema = z.object({
  nome: z.string().min(1),
  cpf: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  telefone: z.string().optional().nullable(),
  observacoes: z.string().optional().nullable(),
});

tenantsRouter.get("/", (_req, res) => {
  const tenants = db.prepare("SELECT * FROM tenants ORDER BY nome ASC").all();
  res.json({ tenants });
});

tenantsRouter.get("/:id", (req, res) => {
  const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.params.id);
  if (!tenant) return res.status(404).json({ error: "Inquilino não encontrado" });
  res.json({ tenant });
});

tenantsRouter.post("/", (req, res) => {
  const parsed = tenantSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const t = parsed.data;
  const result = db
    .prepare(
      `INSERT INTO tenants (nome, cpf, email, telefone, observacoes) VALUES (?, ?, ?, ?, ?)`
    )
    .run(t.nome, t.cpf ?? null, t.email || null, t.telefone ?? null, t.observacoes ?? null);
  const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(result.lastInsertRowid);
  res.status(201).json({ tenant });
});

tenantsRouter.put("/:id", (req, res) => {
  const parsed = tenantSchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const existing = db
    .prepare("SELECT * FROM tenants WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: "Inquilino não encontrado" });

  const merged = { ...existing, ...parsed.data };
  db.prepare(
    `UPDATE tenants SET nome = ?, cpf = ?, email = ?, telefone = ?, observacoes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    merged.nome,
    merged.cpf ?? null,
    merged.email ?? null,
    merged.telefone ?? null,
    merged.observacoes ?? null,
    req.params.id
  );

  const tenant = db.prepare("SELECT * FROM tenants WHERE id = ?").get(req.params.id);
  res.json({ tenant });
});

tenantsRouter.delete("/:id", (req, res) => {
  const contractCount = db
    .prepare("SELECT COUNT(*) as count FROM contracts WHERE tenant_id = ?")
    .get(req.params.id) as { count: number };

  if (contractCount.count > 0) {
    return res.status(409).json({
      error: "Não é possível excluir um inquilino com contratos vinculados.",
    });
  }

  const result = db.prepare("DELETE FROM tenants WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Inquilino não encontrado" });
  res.status(204).send();
});
