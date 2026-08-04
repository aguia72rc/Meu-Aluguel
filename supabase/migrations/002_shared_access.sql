-- Meu Aluguel — migração: torna o acesso compartilhado entre administradores
--
-- Antes: cada usuário só via os próprios dados (RLS por owner_id = auth.uid()).
-- Depois: qualquer usuário autenticado (qualquer login criado em
-- Authentication > Users) vê e edita todos os dados. Use isso quando mais de
-- uma pessoa de confiança vai administrar os mesmos imóveis.
--
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase existente
-- (Project > SQL Editor > New query > cole e clique em "Run").

drop policy if exists "properties_owner_all" on properties;
create policy "properties_authenticated_all" on properties
  for all to authenticated using (true) with check (true);

drop policy if exists "tenants_owner_all" on tenants;
create policy "tenants_authenticated_all" on tenants
  for all to authenticated using (true) with check (true);

drop policy if exists "contracts_owner_all" on contracts;
create policy "contracts_authenticated_all" on contracts
  for all to authenticated using (true) with check (true);

drop policy if exists "payments_owner_all" on payments;
create policy "payments_authenticated_all" on payments
  for all to authenticated using (true) with check (true);

drop policy if exists "receipts_owner_all" on receipts;
create policy "receipts_authenticated_all" on receipts
  for all to authenticated using (true) with check (true);

drop policy if exists "recibos_owner_select" on storage.objects;
drop policy if exists "recibos_owner_insert" on storage.objects;
drop policy if exists "recibos_owner_delete" on storage.objects;

create policy "recibos_authenticated_select" on storage.objects
  for select to authenticated using (bucket_id = 'recibos');

create policy "recibos_authenticated_insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'recibos');

create policy "recibos_authenticated_delete" on storage.objects
  for delete to authenticated using (bucket_id = 'recibos');
