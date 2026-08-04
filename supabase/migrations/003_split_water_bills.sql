-- Meu Aluguel — migração: separa a cobrança de água/esgoto do aluguel
--
-- Antes: cada contrato gerava 1 pagamento por mês, somando aluguel + água
-- e esgoto num único lançamento (um vencimento, um recibo).
-- Depois: cada contrato gera até 2 pagamentos por mês — um do tipo
-- 'aluguel' e outro do tipo 'agua_esgoto' — cada um com seu próprio dia
-- de vencimento, status de pagamento e recibo em PDF.
--
-- Rode este arquivo inteiro no SQL Editor do seu projeto Supabase existente
-- (Project > SQL Editor > New query > cole e clique em "Run").
--
-- Nota sobre o histórico: meses já pagos antes desta migração têm o valor
-- da água/esgoto migrado para um novo lançamento já marcado como "pago",
-- mas SEM recibo em PDF próprio (o recibo antigo, combinado, continua
-- valendo e fica associado ao lançamento de aluguel). Só pagamentos feitos
-- a partir de agora geram os dois recibos separados.

-- 1) Contratos: novo dia de vencimento da água/esgoto (começa igual ao do
--    aluguel; edite depois em cada contrato se for diferente)
alter table contracts
  add column if not exists dia_vencimento_agua_esgoto smallint
    check (dia_vencimento_agua_esgoto between 1 and 28);

update contracts
  set dia_vencimento_agua_esgoto = dia_vencimento
  where dia_vencimento_agua_esgoto is null;

alter table contracts
  alter column dia_vencimento_agua_esgoto set not null,
  alter column dia_vencimento_agua_esgoto set default 5;

-- 2) Pagamentos: adiciona o discriminador de tipo
alter table payments
  add column if not exists tipo text not null default 'aluguel'
    check (tipo in ('aluguel', 'agua_esgoto'));

-- 3) Troca a restrição de unicidade ANTES de inserir qualquer linha nova:
--    a antiga (contract_id, mes_referencia) impediria a linha de
--    água/esgoto de conviver com a de aluguel no mesmo contrato/mês.
alter table payments drop constraint if exists payments_contract_id_mes_referencia_key;
alter table payments drop constraint if exists payments_contract_tipo_mes_unique;
alter table payments add constraint payments_contract_tipo_mes_unique
  unique (contract_id, mes_referencia, tipo);

-- 4) Renomeia valor_aluguel -> valor (agora é só "o valor principal deste
--    tipo de cobrança"). Precisa vir ANTES do passo 5, que insere
--    linhas referenciando a coluna já com o nome novo. Em bloco
--    condicional para não quebrar se este script for rodado 2x.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_name = 'payments' and column_name = 'valor_aluguel'
  ) then
    alter table payments rename column valor_aluguel to valor;
  end if;
end $$;

-- 5) Separa o valor da água/esgoto dos lançamentos combinados existentes
--    em novos lançamentos próprios, preservando status e datas de
--    pagamento (mas sem um recibo em PDF vinculado — ver nota acima)
insert into payments (
  owner_id, contract_id, tipo, mes_referencia, data_vencimento,
  valor, valor_outros, descricao_outros, valor_total,
  status, data_pagamento, forma_pagamento, observacoes
)
select
  owner_id, contract_id, 'agua_esgoto', mes_referencia, data_vencimento,
  valor_agua_esgoto, 0, null, valor_agua_esgoto,
  status, data_pagamento, forma_pagamento, observacoes
from payments
where valor_agua_esgoto > 0;

-- 6) Recalcula o total dos lançamentos de aluguel para não incluir mais
--    a água/esgoto, e remove a coluna antiga
update payments
  set valor_total = valor + valor_outros
  where tipo = 'aluguel';

alter table payments drop column if exists valor_agua_esgoto;
