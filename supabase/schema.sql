-- Meu Aluguel — schema para Supabase (Postgres)
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase
-- (Project > SQL Editor > New query > cole e clique em "Run").

create extension if not exists "pgcrypto";

-- Função utilitária para manter updated_at em dia
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- ─────────────────────────────────────────────────────────────
-- Imóveis
-- ─────────────────────────────────────────────────────────────
create table if not exists properties (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  endereco text not null,
  cidade text,
  valor_aluguel numeric(12,2) not null default 0,
  valor_agua_esgoto numeric(12,2) not null default 0,
  ativo boolean not null default true,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger properties_set_updated_at
  before update on properties
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Inquilinos
-- ─────────────────────────────────────────────────────────────
create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nome text not null,
  cpf text,
  email text,
  telefone text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger tenants_set_updated_at
  before update on tenants
  for each row execute function set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Contratos
-- ─────────────────────────────────────────────────────────────
create table if not exists contracts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  property_id uuid not null references properties(id) on delete restrict,
  tenant_id uuid not null references tenants(id) on delete restrict,
  data_inicio date not null,
  data_fim date,
  dia_vencimento smallint not null default 5 check (dia_vencimento between 1 and 28),
  dia_vencimento_agua_esgoto smallint not null default 5 check (dia_vencimento_agua_esgoto between 1 and 28),
  valor_aluguel numeric(12,2) not null,
  valor_agua_esgoto numeric(12,2) not null default 0,
  status text not null default 'ativo' check (status in ('ativo', 'encerrado')),
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger contracts_set_updated_at
  before update on contracts
  for each row execute function set_updated_at();

create index if not exists idx_contracts_property on contracts(property_id);
create index if not exists idx_contracts_tenant on contracts(tenant_id);

-- ─────────────────────────────────────────────────────────────
-- Pagamentos — aluguel e água/esgoto são cobranças independentes:
-- um contrato ativo gera até 2 lançamentos por mês (um por `tipo`),
-- cada um com seu próprio vencimento, pagamento e recibo.
-- ─────────────────────────────────────────────────────────────
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete restrict,
  tipo text not null default 'aluguel' check (tipo in ('aluguel', 'agua_esgoto')),
  mes_referencia text not null, -- formato YYYY-MM
  data_vencimento date not null,
  valor numeric(12,2) not null, -- valor principal desse tipo de cobrança
  valor_outros numeric(12,2) not null default 0,
  descricao_outros text,
  valor_total numeric(12,2) not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado', 'cancelado')),
  data_pagamento date,
  forma_pagamento text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, mes_referencia, tipo)
);

create trigger payments_set_updated_at
  before update on payments
  for each row execute function set_updated_at();

create index if not exists idx_payments_contract on payments(contract_id);
create index if not exists idx_payments_status on payments(status);

-- ─────────────────────────────────────────────────────────────
-- Recibos emitidos (o PDF em si fica no Storage, bucket "recibos")
-- ─────────────────────────────────────────────────────────────
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  payment_id uuid not null unique references payments(id) on delete cascade,
  numero text not null unique,
  data_emissao timestamptz not null default now(),
  storage_path text not null
);

-- ─────────────────────────────────────────────────────────────
-- Tokens do feed de calendário (assinatura .ics para iPhone/Google
-- Calendar/Outlook) — servidos pela Edge Function "calendar-feed"
-- ─────────────────────────────────────────────────────────────
create table if not exists calendar_feed_tokens (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  token text not null unique default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Contas de inquilino: vincula um login do Supabase Auth (e-mail +
-- senha, criado pelo administrador na tela de Inquilinos, via a Edge
-- Function "manage-tenant-login") a um inquilino. Um usuário
-- autenticado presente aqui é um inquilino; qualquer outro login é um
-- administrador — é essa distinção que as políticas de RLS abaixo usam.
-- ─────────────────────────────────────────────────────────────
create table if not exists tenant_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
--
-- Administradores (qualquer login que NÃO esteja em tenant_accounts):
-- acesso total a tudo, sem isolamento por usuário — pensado para poucas
-- pessoas de confiança (você e, por exemplo, seu cônjuge/sócio)
-- compartilhando a mesma gestão dos imóveis. `owner_id` fica só como
-- registro de quem cadastrou cada linha, sem efeito na permissão.
--
-- Inquilinos (login vinculado em tenant_accounts): acesso somente
-- leitura, restrito aos próprios contratos, pagamentos e recibos.
-- ─────────────────────────────────────────────────────────────
alter table properties enable row level security;
alter table tenants enable row level security;
alter table contracts enable row level security;
alter table payments enable row level security;
alter table receipts enable row level security;
alter table calendar_feed_tokens enable row level security;
alter table tenant_accounts enable row level security;

-- Funções auxiliares SECURITY DEFINER: ignoram RLS internamente ao
-- consultar tenant_accounts, evitando que uma policy sobre a própria
-- tenant_accounts (ou sobre qualquer outra tabela que a consulte) vire
-- uma recursão infinita.
create or replace function is_tenant_account()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from tenant_accounts where user_id = auth.uid());
$$;

create or replace function current_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from tenant_accounts where user_id = auth.uid();
$$;

create policy "tenant_accounts_admin_all" on tenant_accounts
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

create policy "tenant_accounts_select_self" on tenant_accounts
  for select to authenticated using (user_id = auth.uid());

create policy "properties_admin_all" on properties
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

create policy "properties_tenant_select" on properties
  for select to authenticated
  using (exists (
    select 1 from contracts c where c.property_id = properties.id and c.tenant_id = current_tenant_id()
  ));

create policy "tenants_admin_all" on tenants
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

create policy "tenants_tenant_select_self" on tenants
  for select to authenticated
  using (id = current_tenant_id());

create policy "contracts_admin_all" on contracts
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

create policy "contracts_tenant_select_self" on contracts
  for select to authenticated
  using (tenant_id = current_tenant_id());

create policy "payments_admin_all" on payments
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

create policy "payments_tenant_select_self" on payments
  for select to authenticated
  using (exists (
    select 1 from contracts c where c.id = payments.contract_id and c.tenant_id = current_tenant_id()
  ));

create policy "receipts_admin_all" on receipts
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

create policy "receipts_tenant_select_self" on receipts
  for select to authenticated
  using (exists (
    select 1 from payments p
    join contracts c on c.id = p.contract_id
    where p.id = receipts.payment_id and c.tenant_id = current_tenant_id()
  ));

create policy "calendar_feed_tokens_admin_all" on calendar_feed_tokens
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

-- ─────────────────────────────────────────────────────────────
-- Storage — bucket privado para os PDFs dos recibos. Administradores
-- têm acesso total; inquilinos só baixam (select) os próprios recibos.
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('recibos', 'recibos', false)
on conflict (id) do nothing;

create policy "recibos_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'recibos' and not is_tenant_account());

create policy "recibos_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recibos' and not is_tenant_account());

create policy "recibos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recibos' and not is_tenant_account());

create policy "recibos_tenant_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recibos' and exists (
      select 1 from receipts r
      join payments p on p.id = r.payment_id
      join contracts c on c.id = p.contract_id
      where r.storage_path = storage.objects.name and c.tenant_id = current_tenant_id()
    )
  );
