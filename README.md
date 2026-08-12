# Meu Aluguel

Sistema web para gestão de imóveis alugados: cadastro de imóveis e inquilinos, contratos, controle de pagamentos mensais (aluguel + taxa de água e esgoto) e emissão automática de recibos em PDF.

**Arquitetura:** aplicativo 100% estático (React + Vite), hospedado gratuitamente no **GitHub Pages**, falando diretamente com um projeto **Supabase** (banco Postgres + autenticação + armazenamento de arquivos). Não há backend próprio — o Supabase cobre login, banco de dados e o storage dos PDFs dos recibos.

## Funcionalidades

- **Imóveis**: cadastro com endereço, valor do aluguel e valor fixo da taxa de água e esgoto.
- **Inquilinos**: cadastro com CPF, e-mail e telefone.
- **Contratos**: vincula imóvel + inquilino, define dia de vencimento e valores (herdados do imóvel, editáveis por contrato) — **aluguel e água/esgoto têm cada um seu próprio dia de vencimento**.
- **Pagamentos**: aluguel e água/esgoto são cobranças **totalmente independentes**, cada uma em sua própria aba, com vencimento, pagamento e recibo próprios. "Gerar cobranças" cria as duas de uma vez a partir dos contratos ativos; permite ajustar valores pontuais (ex: conta de água variou naquele mês) ou lançar valores extras (ex: multa por atraso).
- **Recibos**: ao marcar um pagamento como pago, um recibo em PDF específico daquele tipo (Aluguel ou Água e Esgoto) é gerado no navegador e enviado para o Supabase Storage, disponível para download a qualquer momento na tela de Recibos.
- **Painel**: resumo do mês (recebido, pendente, atrasado), gráfico de receita dos últimos 6 meses e próximos vencimentos.
- **Calendário (iPhone / Google Calendar / Outlook)**: link único de assinatura, gerado na tela de Perfil, com vencimentos pendentes, atrasos e lembretes de renovação de contrato — atualiza sozinho, sem precisar exportar nada de novo.
- Login via Supabase Auth (e-mail e senha).

## 1. Criar o projeto no Supabase

1. Crie uma conta grátis em [supabase.com](https://supabase.com) e clique em **New Project**.
2. Depois que o projeto for criado, vá em **SQL Editor > New query**, cole o conteúdo de [`supabase/schema.sql`](supabase/schema.sql) e clique em **Run**. Isso cria as tabelas, as políticas de segurança (RLS) e o bucket de armazenamento dos recibos.
3. Crie seu usuário de acesso em **Authentication > Users > Add user** (marque "Auto Confirm User"). Esse é o e-mail/senha que você vai usar para entrar no sistema.
4. Em **Project Settings > API**, copie:
   - **Project URL**
   - **anon public key**

## 2. Configurar e rodar localmente

```bash
cd client
cp .env.example .env
# edite .env com a Project URL e a anon key copiadas acima
npm install
npm run dev
```

Acesse `http://localhost:5173` e entre com o e-mail/senha criados no passo 1.3.

### Adicionar outros administradores

Todo login criado em **Authentication > Users** enxerga e edita os mesmos dados — não existe separação por usuário, é pensado para poucas pessoas de confiança administrando os mesmos imóveis juntas (você e seu cônjuge/sócio, por exemplo). Para adicionar alguém:

1. **Authentication > Users > Add user**, com o e-mail/senha da pessoa (marque "Auto Confirm User").
2. Pronto — no próximo login dela, já aparece tudo que você cadastrou.

Se o seu projeto foi criado *antes* dessa funcionalidade existir (schema antigo, isolado por usuário), rode uma vez o arquivo [`supabase/migrations/002_shared_access.sql`](supabase/migrations/002_shared_access.sql) no SQL Editor para liberar o acesso compartilhado.

### Já tinha um projeto antes da separação aluguel / água e esgoto?

Se o seu projeto já existia antes de aluguel e água/esgoto virarem cobranças separadas, rode uma vez o arquivo [`supabase/migrations/003_split_water_bills.sql`](supabase/migrations/003_split_water_bills.sql) no SQL Editor. **Sem isso o site publicado vai dar erro** ao carregar Pagamentos/Recibos, porque essas telas passam a esperar colunas novas (`tipo`, `valor`) que só existem depois da migração. Meses já pagos antes da migração continuam com o recibo antigo (combinado) associado ao lançamento de aluguel; a parte de água/esgoto desses meses passa a existir como um lançamento próprio já marcado como pago, mas sem um PDF de recibo separado.

## 3. Publicar no GitHub Pages

O repositório já vem com um workflow (`.github/workflows/deploy-pages.yml`) que builda e publica o site a cada push.

1. No repositório do GitHub, vá em **Settings > Pages** e em "Build and deployment" escolha **Source: GitHub Actions**.
2. Em **Settings > Secrets and variables > Actions > New repository secret**, cadastre:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Dê um push na branch monitorada pelo workflow (por padrão `main`) — o Actions builda o app e publica em `https://<seu-usuário>.github.io/Meu-Aluguel/`.

> A `anon key` do Supabase é uma chave pública (protegida pelas políticas de RLS do banco), então não há problema em ela ficar embutida no site publicado.

## 4. Publicar a assinatura de calendário (opcional)

Para usar o link de calendário (iPhone / Google Calendar / Outlook), publique a Edge Function que gera o feed. Não precisa da CLI do Supabase — dá pra fazer tudo pelo painel:

1. No projeto Supabase, vá em **Edge Functions > Deploy a new function**.
2. Nome da função: `calendar-feed`.
3. Cole o conteúdo de [`supabase/functions/calendar-feed/index.ts`](supabase/functions/calendar-feed/index.ts) no editor e clique em **Deploy**.
4. **Importante:** nas configurações dessa função, **desligue "Enforce JWT Verification"**. A função usa seu próprio token (na URL) como autenticação — apps de calendário não conseguem enviar um login do Supabase, então essa checagem do Supabase bloquearia a requisição antes mesmo dela chegar na função.
5. Rode [`supabase/migrations/004_calendar_feed.sql`](supabase/migrations/004_calendar_feed.sql) no SQL Editor (cria a tabela que guarda o token do link).

Depois disso, na tela de **Perfil** do sistema, clique em "Gerar link do calendário" e siga as instruções na tela para assinar no iPhone ou no Google Calendar.

> O link do calendário funciona como uma senha: quem tiver o link vê os vencimentos e valores. Trate-o como algo privado, e gere um novo (revogando o antigo) se ele vazar.

## Fluxo de uso

1. Cadastre seus **imóveis**, informando o valor do aluguel e da taxa de água e esgoto.
2. Cadastre os **inquilinos**.
3. Crie um **contrato** vinculando imóvel e inquilino (os valores são copiados do imóvel, mas podem ser ajustados).
4. Todo mês, na tela de **Pagamentos**, clique em "Gerar cobranças" para criar os lançamentos de aluguel e de água/esgoto de todos os contratos ativos — cada um aparece na sua própria aba.
5. Quando o inquilino pagar (o aluguel e a água/esgoto podem ser pagos em datas diferentes), clique em "Marcar como pago" — o recibo em PDF daquele tipo é gerado automaticamente e fica disponível na tela de **Recibos**.

## Estrutura do projeto

```
client/               Aplicativo React + Vite + TypeScript + Tailwind CSS
supabase/schema.sql   Schema do banco, políticas de RLS e bucket de recibos
supabase/migrations/  Migrações incrementais para projetos já existentes
supabase/functions/   Edge Function calendar-feed (assinatura de calendário)
```
