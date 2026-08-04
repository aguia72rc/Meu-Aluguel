import fs from "fs";
import { Router } from "express";
import { db } from "../db";

export const receiptsRouter = Router();

receiptsRouter.get("/", (_req, res) => {
  const receipts = db
    .prepare(
      `SELECT receipts.*,
              payments.mes_referencia, payments.valor_total, payments.valor_aluguel,
              payments.valor_agua_esgoto, payments.data_pagamento, payments.forma_pagamento,
              payments.contract_id,
              properties.nome AS property_nome, properties.endereco AS property_endereco,
              tenants.nome AS tenant_nome
       FROM receipts
       JOIN payments ON payments.id = receipts.payment_id
       JOIN contracts ON contracts.id = payments.contract_id
       JOIN properties ON properties.id = contracts.property_id
       JOIN tenants ON tenants.id = contracts.tenant_id
       ORDER BY receipts.data_emissao DESC`
    )
    .all();
  res.json({ receipts });
});

receiptsRouter.get("/:id/download", (req, res) => {
  const receipt = db.prepare("SELECT * FROM receipts WHERE id = ?").get(req.params.id) as
    | { arquivo: string; numero: string }
    | undefined;
  if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
  if (!fs.existsSync(receipt.arquivo)) {
    return res.status(404).json({ error: "Arquivo do recibo não encontrado no servidor" });
  }
  res.download(receipt.arquivo, `${receipt.numero}.pdf`);
});

receiptsRouter.get("/by-payment/:paymentId/download", (req, res) => {
  const receipt = db
    .prepare("SELECT * FROM receipts WHERE payment_id = ?")
    .get(req.params.paymentId) as { arquivo: string; numero: string } | undefined;
  if (!receipt) return res.status(404).json({ error: "Recibo não encontrado" });
  if (!fs.existsSync(receipt.arquivo)) {
    return res.status(404).json({ error: "Arquivo do recibo não encontrado no servidor" });
  }
  res.download(receipt.arquivo, `${receipt.numero}.pdf`);
});
