// Meu Aluguel — Edge Function "calendar-feed"
//
// Publica um calendário .ics (assinável no iPhone, Google Calendar,
// Outlook) com vencimentos de aluguel/água e esgoto pendentes e
// lembretes de renovação de contrato.
//
// IMPORTANTE ao publicar (Supabase Dashboard > Edge Functions):
// desligue "Enforce JWT Verification" nesta função. Ela usa o `token`
// da query string como autenticação própria — apps de calendário não
// conseguem enviar um login do Supabase, então o gateway barraria a
// requisição antes mesmo dela chegar aqui se a verificação de JWT do
// Supabase estiver ligada.
//
// URL final: https://<project-ref>.functions.supabase.co/calendar-feed?token=SEU_TOKEN

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MESES = [
  "janeiro", "fevereiro", "março", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
];

function formatCurrency(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatMonthLabel(mesReferencia: string): string {
  const [year, month] = mesReferencia.split("-");
  return `${MESES[Number(month) - 1]} de ${year}`;
}

function icsDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function icsDateOnly(isoDate: string): string {
  return isoDate.replace(/-/g, "");
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// Dobra linhas com mais de 75 octetos e escapa caracteres especiais,
// conforme RFC 5545.
function escapeText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

function foldLine(line: string): string {
  if (line.length <= 75) return line;
  let result = "";
  let rest = line;
  while (rest.length > 75) {
    result += rest.slice(0, 75) + "\r\n ";
    rest = rest.slice(75);
  }
  return result + rest;
}

interface VEvent {
  uid: string;
  dateOnly: string;
  summary: string;
  description: string;
  alarmDaysBefore?: number;
}

function buildIcs(events: VEvent[]): string {
  const now = icsDate(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Meu Aluguel//Calendar Feed//PT",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Meu Aluguel",
    "X-WR-TIMEZONE:America/Sao_Paulo",
    "REFRESH-INTERVAL;VALUE=DURATION:PT6H",
  ];

  for (const ev of events) {
    lines.push("BEGIN:VEVENT");
    lines.push(foldLine(`UID:${ev.uid}@meu-aluguel`));
    lines.push(`DTSTAMP:${now}`);
    lines.push(`DTSTART;VALUE=DATE:${icsDateOnly(ev.dateOnly)}`);
    lines.push(foldLine(`SUMMARY:${escapeText(ev.summary)}`));
    lines.push(foldLine(`DESCRIPTION:${escapeText(ev.description)}`));
    lines.push("STATUS:CONFIRMED");
    lines.push("TRANSP:TRANSPARENT");
    if (ev.alarmDaysBefore) {
      lines.push("BEGIN:VALARM");
      lines.push("ACTION:DISPLAY");
      lines.push(foldLine(`DESCRIPTION:${escapeText(ev.summary)}`));
      lines.push(`TRIGGER:-P${ev.alarmDaysBefore}D`);
      lines.push("END:VALARM");
    }
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
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

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return new Response("Token ausente. Use ?token=SEU_TOKEN na URL.", { status: 400 });
  }

  const tokens = await supabaseRest(
    `calendar_feed_tokens?select=id&token=eq.${encodeURIComponent(token)}`
  );
  if (!Array.isArray(tokens) || tokens.length === 0) {
    return new Response("Token inválido.", { status: 403 });
  }

  const todayIso = new Date().toISOString().slice(0, 10);
  const events: VEvent[] = [];

  const payments = await supabaseRest(
    "payments?select=id,tipo,mes_referencia,data_vencimento,valor_total,status," +
      "contracts(properties(nome),tenants(nome))" +
      "&status=eq.pendente&order=data_vencimento.asc"
  );

  for (const p of payments) {
    const propertyNome = p.contracts?.properties?.nome ?? "Imóvel";
    const tenantNome = p.contracts?.tenants?.nome ?? "Inquilino";
    const isOverdue = p.data_vencimento < todayIso;
    const tipoLabel = p.tipo === "agua_esgoto" ? "Água e Esgoto" : "Aluguel";
    const emoji = p.tipo === "agua_esgoto" ? "💧" : "💰";
    const prefix = isOverdue ? "⚠️ Atrasado: " : "";

    events.push({
      uid: `payment-${p.id}`,
      dateOnly: p.data_vencimento,
      summary: `${prefix}${emoji} ${tipoLabel} - ${propertyNome} (${tenantNome})`,
      description:
        `${tipoLabel} de ${formatMonthLabel(p.mes_referencia)}\n` +
        `Inquilino: ${tenantNome}\n` +
        `Valor: ${formatCurrency(p.valor_total)}` +
        (isOverdue ? "\nStatus: atrasado" : ""),
      alarmDaysBefore: 1,
    });
  }

  const contracts = await supabaseRest(
    "contracts?select=id,data_fim,properties(nome),tenants(nome)" +
      "&status=eq.ativo&data_fim=not.is.null"
  );

  for (const c of contracts) {
    const propertyNome = c.properties?.nome ?? "Imóvel";
    const tenantNome = c.tenants?.nome ?? "Inquilino";
    const reminderDate = addDays(c.data_fim, -30);

    events.push({
      uid: `renewal-${c.id}`,
      dateOnly: reminderDate,
      summary: `📄 Renovar contrato - ${propertyNome} (${tenantNome})`,
      description:
        `O contrato de ${tenantNome} no imóvel ${propertyNome} encerra em ` +
        `${c.data_fim.split("-").reverse().join("/")}. Verifique a renovação.`,
      alarmDaysBefore: 7,
    });
  }

  const ics = buildIcs(events);

  return new Response(ics, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
