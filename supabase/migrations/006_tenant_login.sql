-- Meu Aluguel — Migration 006: login e senha para os inquilinos
--
-- Substitui o portal por link/token (migration 005) por um login de
-- verdade: cada inquilino ganha um e-mail e senha próprios, criados
-- pelo administrador na tela de Inquilinos (via a Edge Function
-- "manage-tenant-login"). O inquilino entra pelo mesmo formulário de
-- login do sistema e, graças ao RLS abaixo, só enxerga (somente
-- leitura) os próprios contratos, pagamentos e recibos.
--
-- Se você já tinha rodado a migration 005 (portal por link), ela é
-- desfeita aqui — ninguém chegou a receber aquele link, então não há
-- nada para migrar.

drop table if exists tenant_portal_tokens cascade;

-- ─────────────────────────────────────────────────────────────
-- Vincula um login do Supabase Auth a um inquilino
-- ─────────────────────────────────────────────────────────────
create table if not exists tenant_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references tenants(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table tenant_accounts enable row level security;

create policy "tenant_accounts_admin_all" on tenant_accounts
  for all to authenticated
  using (not exists (select 1 from tenant_accounts ta where ta.user_id = auth.uid()))
  with check (not exists (select 1 from tenant_accounts ta where ta.user_id = auth.uid()));

create policy "tenant_accounts_select_self" on tenant_accounts
  for select to authenticated using (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- RLS: administradores continuam com acesso total; inquilinos logados
-- só enxergam (somente leitura) os próprios dados
-- ─────────────────────────────────────────────────────────────
drop policy if exists "properties_authenticated_all" on properties;

create policy "properties_admin_all" on properties
  for all to authenticated
  using (not exists (select 1 from tenant_accounts where user_id = auth.uid()))
  with check (not exists (select 1 from tenant_accounts where user_id = auth.uid()));

create policy "properties_tenant_select" on properties
  for select to authenticated
  using (exists (
    select 1 from contracts c
    join tenant_accounts ta on ta.tenant_id = c.tenant_id
    where c.property_id = properties.id and ta.user_id = auth.uid()
  ));

drop policy if exists "tenants_authenticated_all" on tenants;

create policy "tenants_admin_all" on tenants
  for all to authenticated
  using (not exists (select 1 from tenant_accounts where user_id = auth.uid()))
  with check (not exists (select 1 from tenant_accounts where user_id = auth.uid()));

create policy "tenants_tenant_select_self" on tenants
  for select to authenticated
  using (exists (
    select 1 from tenant_accounts ta where ta.tenant_id = tenants.id and ta.user_id = auth.uid()
  ));

drop policy if exists "contracts_authenticated_all" on contracts;

create policy "contracts_admin_all" on contracts
  for all to authenticated
  using (not exists (select 1 from tenant_accounts where user_id = auth.uid()))
  with check (not exists (select 1 from tenant_accounts where user_id = auth.uid()));

create policy "contracts_tenant_select_self" on contracts
  for select to authenticated
  using (exists (
    select 1 from tenant_accounts ta where ta.tenant_id = contracts.tenant_id and ta.user_id = auth.uid()
  ));

drop policy if exists "payments_authenticated_all" on payments;

create policy "payments_admin_all" on payments
  for all to authenticated
  using (not exists (select 1 from tenant_accounts where user_id = auth.uid()))
  with check (not exists (select 1 from tenant_accounts where user_id = auth.uid()));

create policy "payments_tenant_select_self" on payments
  for select to authenticated
  using (exists (
    select 1 from contracts c
    join tenant_accounts ta on ta.tenant_id = c.tenant_id
    where c.id = payments.contract_id and ta.user_id = auth.uid()
  ));

drop policy if exists "receipts_authenticated_all" on receipts;

create policy "receipts_admin_all" on receipts
  for all to authenticated
  using (not exists (select 1 from tenant_accounts where user_id = auth.uid()))
  with check (not exists (select 1 from tenant_accounts where user_id = auth.uid()));

create policy "receipts_tenant_select_self" on receipts
  for select to authenticated
  using (exists (
    select 1 from payments p
    join contracts c on c.id = p.contract_id
    join tenant_accounts ta on ta.tenant_id = c.tenant_id
    where p.id = receipts.payment_id and ta.user_id = auth.uid()
  ));

drop policy if exists "calendar_feed_tokens_authenticated_all" on calendar_feed_tokens;

create policy "calendar_feed_tokens_admin_all" on calendar_feed_tokens
  for all to authenticated
  using (not exists (select 1 from tenant_accounts where user_id = auth.uid()))
  with check (not exists (select 1 from tenant_accounts where user_id = auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- Storage: administradores continuam com acesso total ao bucket;
-- inquilinos só baixam (select) os próprios recibos já pagos
-- ─────────────────────────────────────────────────────────────
drop policy if exists "recibos_authenticated_select" on storage.objects;
drop policy if exists "recibos_authenticated_insert" on storage.objects;
drop policy if exists "recibos_authenticated_delete" on storage.objects;

create policy "recibos_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'recibos' and not exists (select 1 from tenant_accounts where user_id = auth.uid()));

create policy "recibos_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recibos' and not exists (select 1 from tenant_accounts where user_id = auth.uid()));

create policy "recibos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recibos' and not exists (select 1 from tenant_accounts where user_id = auth.uid()));

create policy "recibos_tenant_select_own" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'recibos' and exists (
      select 1 from receipts r
      join payments p on p.id = r.payment_id
      join contracts c on c.id = p.contract_id
      join tenant_accounts ta on ta.tenant_id = c.tenant_id
      where r.storage_path = storage.objects.name and ta.user_id = auth.uid()
    )
  );
