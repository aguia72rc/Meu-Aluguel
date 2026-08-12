import { supabase } from "./supabase";

export async function hasTenantLogin(tenantId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("tenant_accounts")
    .select("id")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (error) throw error;
  return !!data;
}

export function generatePassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  let result = "";
  for (let i = 0; i < 10; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function saveTenantLogin(params: {
  tenantId: string;
  email: string;
  password: string;
}): Promise<void> {
  const { data, error } = await supabase.functions.invoke("manage-tenant-login", { body: params });
  if (error) {
    let message = error.message;
    const context = (error as { context?: Response }).context;
    if (context && typeof context.json === "function") {
      try {
        const body = await context.json();
        if (body?.error) message = body.error;
      } catch {
        // sem corpo JSON legível, mantém a mensagem padrão do erro
      }
    }
    throw new Error(message ?? "Não foi possível salvar o login");
  }
  if (data?.error) throw new Error(data.error);
}
