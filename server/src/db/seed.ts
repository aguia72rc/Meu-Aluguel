import bcrypt from "bcryptjs";
import "dotenv/config";
import { db } from "./index";

function seed() {
  const email = process.env.ADMIN_EMAIL || "admin@meualuguel.local";
  const password = process.env.ADMIN_PASSWORD || "admin123";

  const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (existing) {
    console.log(`Usuário admin já existe (${email}). Nada a fazer.`);
    return;
  }

  const name = process.env.ADMIN_NAME || "Administrador";
  const passwordHash = bcrypt.hashSync(password, 10);
  db.prepare(
    "INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)"
  ).run(email, passwordHash, name);

  console.log(`Usuário admin criado: ${email}`);
}

seed();
