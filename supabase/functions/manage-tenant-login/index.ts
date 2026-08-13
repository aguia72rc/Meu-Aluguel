// Meu Aluguel — Edge Function "manage-tenant-login"
//
// Cria ou redefine o login (e-mail + senha) de um inquilino no Supabase
// Auth, e vincula esse login ao registro do inquilino na tabela
// `tenant_accounts`. Só administradores (usuários autenticados que NÃO
// estão em `tenant_accounts`) podem chamar esta função — chamada a
// partir da tela de Inquilinos.
//
// Ao contrário da calendar-feed e da (antiga) tenant-portal, esta função
// deve ficar com "Enforce JWT Verification" LIGADO (padrão) — só um
// administrador com sessão válida pode criar/alterar logins de inquilino.
//
// Requisição: POST { tenantId, email, password }

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });
}

async function serviceRoleRest(path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase REST error (${res.status}): ${await res.text()}`);
  }
  // Com "Prefer: return=minimal" o PostgREST responde sem corpo (às vezes
  // 201, às vezes 204, dependendo do método) — checar o texto em vez do
  // status evita chamar .json() num corpo vazio.
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  try {
    return await handleRequest(req);
  } catch (err) {
    // Sem isso, qualquer exceção não tratada (ex: serviceRoleRest lançando
    // erro) faz o Deno devolver uma resposta de erro genérica (não-JSON),
    // e o cliente só consegue mostrar "Edge Function returned a non-2xx
    // status code" em vez da mensagem real do problema.
    console.error(err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Erro interno ao processar a requisição." },
      500
    );
  }
});

async function handleRequest(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "Método não suportado." }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return jsonResponse({ error: "Não autenticado." }, 401);

  const callerRes = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: ANON_KEY, Authorization: authHeader },
  });
  if (!callerRes.ok) return jsonResponse({ error: "Sessão inválida." }, 401);
  const caller = await callerRes.json();

  const callerTenantRows = await serviceRoleRest(
    `tenant_accounts?select=id&user_id=eq.${caller.id}&limit=1`
  );
  if (Array.isArray(callerTenantRows) && callerTenantRows.length > 0) {
    return jsonResponse({ error: "Apenas administradores podem gerenciar logins de inquilino." }, 403);
  }

  let body: { tenantId?: string; email?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Corpo da requisição inválido." }, 400);
  }
  const { tenantId, email, password } = body;
  if (!tenantId || !email || !password) {
    return jsonResponse({ error: "tenantId, email e password são obrigatórios." }, 400);
  }
  if (password.length < 6) {
    return jsonResponse({ error: "A senha precisa ter pelo menos 6 caracteres." }, 400);
  }

  const tenantRows = await serviceRoleRest(`tenants?select=id&id=eq.${tenantId}&limit=1`);
  if (!Array.isArray(tenantRows) || tenantRows.length === 0) {
    return jsonResponse({ error: "Inquilino não encontrado." }, 404);
  }

  const existing = await serviceRoleRest(
    `tenant_accounts?select=id,user_id&tenant_id=eq.${tenantId}&limit=1`
  );
  const existingAccount = Array.isArray(existing) && existing.length > 0 ? existing[0] : null;

  if (existingAccount) {
    const updateRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${existingAccount.user_id}`, {
      method: "PUT",
      headers: {
        apikey: SERVICE_ROLE_KEY,
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password, email_confirm: true }),
    });
    if (!updateRes.ok) {
      return jsonResponse({ error: `Não foi possível atualizar o login (${await updateRes.text()})` }, 400);
    }
    return jsonResponse({ success: true, created: false });
  }

  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, email_confirm: true }),
  });
  if (!createRes.ok) {
    const text = await createRes.text();
    const message = text.includes("already been registered")
      ? "Esse e-mail já está cadastrado (talvez como administrador ou outro inquilino)."
      : `Não foi possível criar o login (${text})`;
    return jsonResponse({ error: message }, 400);
  }
  const newUser = await createRes.json();

  try {
    await serviceRoleRest("tenant_accounts", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ tenant_id: tenantId, user_id: newUser.id }),
    });
  } catch (err) {
    // Reverte a criação do usuário se não conseguirmos vincular o inquilino,
    // pra não deixar um login órfão sem tenant_accounts.
    await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${newUser.id}`, {
      method: "DELETE",
      headers: { apikey: SERVICE_ROLE_KEY, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
    });
    throw err;
  }

  return jsonResponse({ success: true, created: true });
}
