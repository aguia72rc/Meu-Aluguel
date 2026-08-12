-- Meu Aluguel — migração: link de assinatura de calendário
--
-- Cria a tabela de tokens usados pela Edge Function "calendar-feed" para
-- publicar um link .ics (assinável no iPhone, Google Calendar, Outlook)
-- com vencimentos de aluguel, água/esgoto e lembretes de renovação de
-- contrato. Qualquer administrador pode gerar/ver os tokens (mesma
-- lógica de acesso compartilhado do resto do sistema); a Edge Function
-- em si roda com a service_role key, então ignora RLS ao consultar os
-- dados — a única barreira de segurança do feed é o token em si (por
-- isso ele é longo e aleatório: trate a URL do feed como uma senha).
--
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Project > SQL Editor > New query > cole e clique em "Run").

create table if not exists calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

alter table calendar_feed_tokens enable row level security;

create policy "calendar_feed_tokens_authenticated_all" on calendar_feed_tokens
  for all to authenticated using (true) with check (true);
