import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../db";
import { requireAuth, AuthedRequest } from "../middleware/auth";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

interface UserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
}

authRouter.post("/login", (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email ou senha inválidos" });
  }
  const { email, password } = parsed.data;

  const user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email) as UserRow | undefined;

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: "Credenciais inválidas" });
  }

  const secret = process.env.JWT_SECRET || "dev-secret";
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "30d" });

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name },
  });
});

authRouter.get("/me", requireAuth, (req: AuthedRequest, res) => {
  const user = db
    .prepare("SELECT id, email, name FROM users WHERE id = ?")
    .get(req.userId);
  if (!user) return res.status(404).json({ error: "Usuário não encontrado" });
  res.json({ user });
});
