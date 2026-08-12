// Meu Aluguel — Edge Function "tenant-portal"
//
// Serve os dados do "Portal do inquilino": contratos (com dias restantes
// até o fim da vigência) e recibos de aluguel/água e esgoto já pagos,
// cada um com um link de download temporário. Consumida pela página
// pública /#/portal/:token — sem login, o próprio token na URL é a
// autenticação.
//
// IMPORTANTE ao publicar (Supabase Dashboard > Edge Functions): desligue
// "Enforce JWT Verification" nesta função, pelo mesmo motivo da
// calendar-feed — o navegador do inquilino não tem um login do Supabase,
// então essa checagem bloquearia a requisição antes mesmo dela chegar aqui.
//
// URL final: https://<project-ref>.functions.supabase.co/tenant-portal?token=SEU_TOKEN

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

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

async function supabaseRest(path: string): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
    },
  });
  if (!res.ok) {
    throw new Error(`Supabase REST error (${res.status}): ${await res.text()}`);
  }
  return res.json();
}

async function signStoragePath(path: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/sign/recibos/${path}`, {
    method: "POST",
    headers: {
      apikey: SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ expiresIn: 60 * 60 * 24 * 7 }),
  });
  if (!res.ok) {
    throw new Error(`Supabase Storage sign error (${res.status}): ${await res.text()}`);
  }
  const { signedURL } = await res.json();
  return `${SUPABASE_URL}/storage/v1${signedURL}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) return jsonResponse({ error: "Token ausente." }, 400);

  const tokenRows = await supabaseRest(
    `tenant_portal_tokens?select=tenant_id&token=eq.${encodeURIComponent(token)}`
  );
  if (!Array.isArray(tokenRows) || tokenRows.length === 0) {
    return jsonResponse({ error: "Link inválido ou expirado." }, 403);
  }
  const tenantId = tokenRows[0].tenant_id;

  const tenants = await supabaseRest(`tenants?select=nome&id=eq.${tenantId}`);
  const tenant = tenants[0];
  if (!tenant) return jsonResponse({ error: "Inquilino não encontrado." }, 404);

  const contracts = await supabaseRest(
    "contracts?select=id,data_inicio,data_fim,status,properties(nome,endereco)" +
      `&tenant_id=eq.${tenantId}&order=data_inicio.desc`
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const msPerDay = 24 * 60 * 60 * 1000;
  const todayMs = new Date(`${todayIso}T00:00:00Z`).getTime();

  const propertyByContract = new Map<string, string>();
  const contractsOut = contracts.map((c: any) => {
    propertyByContract.set(c.id, c.properties?.nome ?? "Imóvel");
    const diasRestantes =
      c.data_fim != null
        ? Math.round((new Date(`${c.data_fim}T00:00:00Z`).getTime() - todayMs) / msPerDay)
        : null;
    return {
      id: c.id,
      property_nome: c.properties?.nome ?? "Imóvel",
      property_endereco: c.properties?.endereco ?? "",
      data_inicio: c.data_inicio,
      data_fim: c.data_fim,
      status: c.status,
      dias_restantes: diasRestantes,
    };
  });

  const contractIds: string[] = contracts.map((c: any) => c.id);
  const receiptsOut: any[] = [];

  if (contractIds.length > 0) {
    const payments = await supabaseRest(
      "payments?select=id,tipo,mes_referencia,valor_total,data_pagamento,contract_id," +
        "receipts(numero,data_emissao,storage_path)" +
        `&contract_id=in.(${contractIds.join(",")})&status=eq.pago&order=data_pagamento.desc`
    );

    for (const p of payments) {
      const receipt = Array.isArray(p.receipts) ? p.receipts[0] : p.receipts;
      if (!receipt) continue;
      const downloadUrl = await signStoragePath(receipt.storage_path);
      receiptsOut.push({
        id: p.id,
        tipo: p.tipo,
        mes_referencia: p.mes_referencia,
        valor_total: p.valor_total,
        data_pagamento: p.data_pagamento,
        numero: receipt.numero,
        data_emissao: receipt.data_emissao,
        property_nome: propertyByContract.get(p.contract_id) ?? "Imóvel",
        download_url: downloadUrl,
      });
    }
  }

  return jsonResponse({
    tenant: { nome: tenant.nome },
    contracts: contractsOut,
    receipts: receiptsOut,
  });
});
