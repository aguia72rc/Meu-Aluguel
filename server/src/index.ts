import cors from "cors";
import "dotenv/config";
import express from "express";
import "./db"; // garante que o schema seja criado
import { requireAuth } from "./middleware/auth";
import { authRouter } from "./routes/auth";
import { contractsRouter } from "./routes/contracts";
import { paymentsRouter } from "./routes/payments";
import { propertiesRouter } from "./routes/properties";
import { receiptsRouter } from "./routes/receipts";
import { tenantsRouter } from "./routes/tenants";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.use("/api/auth", authRouter);
app.use("/api/properties", requireAuth, propertiesRouter);
app.use("/api/tenants", requireAuth, tenantsRouter);
app.use("/api/contracts", requireAuth, contractsRouter);
app.use("/api/payments", requireAuth, paymentsRouter);
app.use("/api/receipts", requireAuth, receiptsRouter);

app.listen(PORT, () => {
  console.log(`Meu Aluguel API rodando em http://localhost:${PORT}`);
});
