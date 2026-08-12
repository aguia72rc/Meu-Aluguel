-- Meu Aluguel — Migration 005: portal do inquilino
--
-- Cada inquilino recebe um link único, sem senha, para ver seus próprios
-- contratos (com contagem de dias até o fim da vigência) e baixar os
-- recibos de aluguel e água/esgoto já pagos. A autenticação desse link é
-- o próprio token, servido pela Edge Function "tenant-portal" (veja
-- supabase/functions/tenant-portal/index.ts e o passo 5b do README).

create table if not exists tenant_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

alter table tenant_portal_tokens enable row level security;

create policy "tenant_portal_tokens_authenticated_all" on tenant_portal_tokens
  for all to authenticated using (true) with check (true);
