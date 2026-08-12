import { supabase } from "./supabase";

export function portalUrl(token: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}#/portal/${token}`;
}

export async function getOrCreatePortalLink(tenantId: string): Promise<string> {
  const { data: existing, error: selectError } = await supabase
    .from("tenant_portal_tokens")
    .select("token")
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (selectError) throw selectError;
  if (existing) return portalUrl(existing.token);

  const { data, error } = await supabase
    .from("tenant_portal_tokens")
    .insert({ tenant_id: tenantId })
    .select("token")
    .single();
  if (error || !data) throw error ?? new Error("Não foi possível gerar o link do portal");
  return portalUrl(data.token);
}

export async function regeneratePortalLink(tenantId: string): Promise<string> {
  await supabase.from("tenant_portal_tokens").delete().eq("tenant_id", tenantId);
  return getOrCreatePortalLink(tenantId);
}
