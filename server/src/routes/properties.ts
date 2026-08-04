import { Router } from "express";
import { z } from "zod";
import { db } from "../db";

export const propertiesRouter = Router();

const propertySchema = z.object({
  nome: z.string().min(1),
  endereco: z.string().min(1),
  cidade: z.string().optional().nullable(),
  valor_aluguel: z.number().nonnegative(),
  valor_agua_esgoto: z.number().nonnegative().default(0),
  ativo: z.boolean().optional().default(true),
  observacoes: z.string().optional().nullable(),
});

propertiesRouter.get("/", (_req, res) => {
  const properties = db
    .prepare("SELECT * FROM properties ORDER BY nome ASC")
    .all();
  res.json({ properties });
});

propertiesRouter.get("/:id", (req, res) => {
  const property = db
    .prepare("SELECT * FROM properties WHERE id = ?")
    .get(req.params.id);
  if (!property) return res.status(404).json({ error: "Imóvel não encontrado" });
  res.json({ property });
});

propertiesRouter.post("/", (req, res) => {
  const parsed = propertySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const p = parsed.data;
  const result = db
    .prepare(
      `INSERT INTO properties (nome, endereco, cidade, valor_aluguel, valor_agua_esgoto, ativo, observacoes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      p.nome,
      p.endereco,
      p.cidade ?? null,
      p.valor_aluguel,
      p.valor_agua_esgoto,
      p.ativo ? 1 : 0,
      p.observacoes ?? null
    );
  const property = db
    .prepare("SELECT * FROM properties WHERE id = ?")
    .get(result.lastInsertRowid);
  res.status(201).json({ property });
});

propertiesRouter.put("/:id", (req, res) => {
  const parsed = propertySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const existing = db
    .prepare("SELECT * FROM properties WHERE id = ?")
    .get(req.params.id) as Record<string, unknown> | undefined;
  if (!existing) return res.status(404).json({ error: "Imóvel não encontrado" });

  const merged = { ...existing, ...parsed.data };
  db.prepare(
    `UPDATE properties SET nome = ?, endereco = ?, cidade = ?, valor_aluguel = ?,
     valor_agua_esgoto = ?, ativo = ?, observacoes = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    merged.nome,
    merged.endereco,
    merged.cidade ?? null,
    merged.valor_aluguel,
    merged.valor_agua_esgoto,
    merged.ativo ? 1 : 0,
    merged.observacoes ?? null,
    req.params.id
  );

  const property = db
    .prepare("SELECT * FROM properties WHERE id = ?")
    .get(req.params.id);
  res.json({ property });
});

propertiesRouter.delete("/:id", (req, res) => {
  const contractCount = db
    .prepare("SELECT COUNT(*) as count FROM contracts WHERE property_id = ?")
    .get(req.params.id) as { count: number };

  if (contractCount.count > 0) {
    return res.status(409).json({
      error: "Não é possível excluir um imóvel com contratos vinculados. Desative-o em vez disso.",
    });
  }

  const result = db.prepare("DELETE FROM properties WHERE id = ?").run(req.params.id);
  if (result.changes === 0) return res.status(404).json({ error: "Imóvel não encontrado" });
  res.status(204).send();
});
