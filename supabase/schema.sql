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
-- Pagamentos (um lançamento por mês de referência por contrato)
-- ─────────────────────────────────────────────────────────────
create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  contract_id uuid not null references contracts(id) on delete restrict,
  mes_referencia text not null, -- formato YYYY-MM
  data_vencimento date not null,
  valor_aluguel numeric(12,2) not null,
  valor_agua_esgoto numeric(12,2) not null default 0,
  valor_outros numeric(12,2) not null default 0,
  descricao_outros text,
  valor_total numeric(12,2) not null,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'atrasado', 'cancelado')),
  data_pagamento date,
  forma_pagamento text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (contract_id, mes_referencia)
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
-- Row Level Security — cada usuário só vê os próprios dados
-- ─────────────────────────────────────────────────────────────
alter table properties enable row level security;
alter table tenants enable row level security;
alter table contracts enable row level security;
alter table payments enable row level security;
alter table receipts enable row level security;

create policy "properties_owner_all" on properties
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "tenants_owner_all" on tenants
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "contracts_owner_all" on contracts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "payments_owner_all" on payments
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "receipts_owner_all" on receipts
  for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Storage — bucket privado para os PDFs dos recibos
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('recibos', 'recibos', false)
on conflict (id) do nothing;

-- Cada usuário só acessa arquivos dentro da própria "pasta" (primeiro
-- segmento do caminho = seu próprio auth.uid()), ex: "<uid>/REC-2026-00001.pdf"
create policy "recibos_owner_select" on storage.objects
  for select using (
    bucket_id = 'recibos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recibos_owner_insert" on storage.objects
  for insert with check (
    bucket_id = 'recibos' and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "recibos_owner_delete" on storage.objects
  for delete using (
    bucket_id = 'recibos' and (storage.foldername(name))[1] = auth.uid()::text
  );
