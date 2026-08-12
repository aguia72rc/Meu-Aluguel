-- Meu Aluguel — Migration 007: corrige recursão infinita no RLS
--
-- A migration 006 criou a policy "tenant_accounts_admin_all" consultando a
-- própria tabela tenant_accounts dentro de si mesma (para descobrir se
-- quem está logado é administrador). O Postgres rejeita isso com
-- "infinite recursion detected in policy for relation tenant_accounts".
-- Como TODAS as outras tabelas (imóveis, inquilinos, contratos,
-- pagamentos, recibos, tokens de calendário) e o Storage passaram a
-- consultar tenant_accounts para decidir quem é administrador, o erro se
-- propagava para qualquer leitura do sistema — por isso a aplicação
-- parecia "vazia", mas nenhum dado foi apagado.
--
-- A correção usa duas funções SECURITY DEFINER (que ignoram RLS
-- internamente, evitando a recursão) no lugar das subconsultas diretas.

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

-- tenant_accounts
drop policy if exists "tenant_accounts_admin_all" on tenant_accounts;
create policy "tenant_accounts_admin_all" on tenant_accounts
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

-- properties
drop policy if exists "properties_admin_all" on properties;
create policy "properties_admin_all" on properties
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

drop policy if exists "properties_tenant_select" on properties;
create policy "properties_tenant_select" on properties
  for select to authenticated
  using (exists (
    select 1 from contracts c where c.property_id = properties.id and c.tenant_id = current_tenant_id()
  ));

-- tenants
drop policy if exists "tenants_admin_all" on tenants;
create policy "tenants_admin_all" on tenants
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

drop policy if exists "tenants_tenant_select_self" on tenants;
create policy "tenants_tenant_select_self" on tenants
  for select to authenticated
  using (id = current_tenant_id());

-- contracts
drop policy if exists "contracts_admin_all" on contracts;
create policy "contracts_admin_all" on contracts
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

drop policy if exists "contracts_tenant_select_self" on contracts;
create policy "contracts_tenant_select_self" on contracts
  for select to authenticated
  using (tenant_id = current_tenant_id());

-- payments
drop policy if exists "payments_admin_all" on payments;
create policy "payments_admin_all" on payments
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

drop policy if exists "payments_tenant_select_self" on payments;
create policy "payments_tenant_select_self" on payments
  for select to authenticated
  using (exists (
    select 1 from contracts c where c.id = payments.contract_id and c.tenant_id = current_tenant_id()
  ));

-- receipts
drop policy if exists "receipts_admin_all" on receipts;
create policy "receipts_admin_all" on receipts
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

drop policy if exists "receipts_tenant_select_self" on receipts;
create policy "receipts_tenant_select_self" on receipts
  for select to authenticated
  using (exists (
    select 1 from payments p
    join contracts c on c.id = p.contract_id
    where p.id = receipts.payment_id and c.tenant_id = current_tenant_id()
  ));

-- calendar_feed_tokens
drop policy if exists "calendar_feed_tokens_admin_all" on calendar_feed_tokens;
create policy "calendar_feed_tokens_admin_all" on calendar_feed_tokens
  for all to authenticated
  using (not is_tenant_account())
  with check (not is_tenant_account());

-- storage (bucket "recibos")
drop policy if exists "recibos_admin_select" on storage.objects;
create policy "recibos_admin_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'recibos' and not is_tenant_account());

drop policy if exists "recibos_admin_insert" on storage.objects;
create policy "recibos_admin_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'recibos' and not is_tenant_account());

drop policy if exists "recibos_admin_delete" on storage.objects;
create policy "recibos_admin_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'recibos' and not is_tenant_account());

drop policy if exists "recibos_tenant_select_own" on storage.objects;
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
