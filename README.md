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
- **Envio por WhatsApp**: nas telas de Pagamentos e Recibos, um botão abre o WhatsApp já com a mensagem pronta para o inquilino — lembrete de vencimento/atraso ou o link do recibo em PDF (válido por 7 dias). Usa o telefone cadastrado do inquilino; é um clique manual, não é envio automático (não precisa de conta ou aprovação da Meta).
- **Portal do inquilino**: cada morador tem seu próprio login (e-mail e senha, criados pelo administrador na tela de Inquilinos) para consultar sozinho o prazo até o fim do seu contrato (contagem de dias, com aviso quando estiver perto de vencer) e baixar os recibos de aluguel e água/esgoto já pagos — sem precisar entrar em contato com o administrador. O acesso é restrito aos próprios dados por RLS no banco.
- Login via Supabase Auth (e-mail e senha) para todo mundo — administradores têm acesso total, inquilinos têm acesso somente leitura aos próprios dados.

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

## 3b. Publicar na Vercel (alternativa ao GitHub Pages)

O app também pode ser hospedado na [Vercel](https://vercel.com), que dá um domínio `.vercel.app` na hora e facilita configurar domínio próprio depois.

1. Na Vercel, **Add New → Project** → selecione o repositório.
2. Deixe **Root Directory em branco** (não mude para `client`) — o [`vercel.json`](vercel.json) na raiz do repositório já instrui a Vercel a entrar em `client/` para instalar e buildar (`cd client && npm install && npm run build`) e a servir a partir de `client/dist`. Isso existe porque, na prática, o campo "Root Directory" da interface nem sempre é aplicado de forma confiável em builds — o `vercel.json` resolve isso sem depender dele.
3. Em "Environment Variables", adicione `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` (mesmos valores usados no GitHub Pages).
4. Deploy. A cada push na `main`, a Vercel builda de novo automaticamente.

## 4. Publicar a assinatura de calendário (opcional)

Para usar o link de calendário (iPhone / Google Calendar / Outlook), publique a Edge Function que gera o feed. Não precisa da CLI do Supabase — dá pra fazer tudo pelo painel:

1. No projeto Supabase, vá em **Edge Functions > Deploy a new function**.
2. Nome da função: `calendar-feed`.
3. Cole o conteúdo de [`supabase/functions/calendar-feed/index.ts`](supabase/functions/calendar-feed/index.ts) no editor e clique em **Deploy**.
4. **Importante:** nas configurações dessa função, **desligue "Enforce JWT Verification"**. A função usa seu próprio token (na URL) como autenticação — apps de calendário não conseguem enviar um login do Supabase, então essa checagem do Supabase bloquearia a requisição antes mesmo dela chegar na função.
5. Rode [`supabase/migrations/004_calendar_feed.sql`](supabase/migrations/004_calendar_feed.sql) no SQL Editor (cria a tabela que guarda o token do link).

Depois disso, na tela de **Perfil** do sistema, clique em "Gerar link do calendário" e siga as instruções na tela para assinar no iPhone ou no Google Calendar.

> O link do calendário funciona como uma senha: quem tiver o link vê os vencimentos e valores. Trate-o como algo privado, e gere um novo (revogando o antigo) se ele vazar.

## 5. Publicar o login dos inquilinos (opcional)

Para poder criar o login (e-mail + senha) de cada inquilino pela tela de Inquilinos, publique a Edge Function responsável por isso. Mesmo processo das outras funções, mas com uma diferença importante — veja o passo 4:

1. No projeto Supabase, vá em **Edge Functions > Deploy a new function**.
2. Nome da função: `manage-tenant-login`.
3. Cole o conteúdo de [`supabase/functions/manage-tenant-login/index.ts`](supabase/functions/manage-tenant-login/index.ts) no editor e clique em **Deploy**.
4. **Deixe "Enforce JWT Verification" LIGADO** (é o padrão) — ao contrário da `calendar-feed`, essa função só pode ser chamada por um administrador com sessão ativa; a própria função também confere isso por segurança.
5. Rode [`supabase/migrations/006_tenant_login.sql`](supabase/migrations/006_tenant_login.sql) no SQL Editor (cria a tabela que vincula o login de cada inquilino e ajusta o RLS para que inquilinos só vejam os próprios dados).

Depois disso, na tela de **Inquilinos**, clique no ícone de chave ao lado do inquilino para criar o login dele (e-mail + senha, com opção de gerar uma senha aleatória) e enviar os dados de acesso por WhatsApp (ou copiar e mandar por outro meio). O inquilino entra pelo mesmo formulário de login do sistema — depois de logado, cai direto na área dele, sem acesso ao painel de administração.

> Se o seu projeto já tinha o portal por link (migration 005, nunca chegou a ser usado por ninguém), a migration 006 desfaz aquela tabela automaticamente.

## Fluxo de uso

1. Cadastre seus **imóveis**, informando o valor do aluguel e da taxa de água e esgoto.
2. Cadastre os **inquilinos**.
3. Crie um **contrato** vinculando imóvel e inquilino (os valores são copiados do imóvel, mas podem ser ajustados).
4. Todo mês, na tela de **Pagamentos**, clique em "Gerar cobranças" para criar os lançamentos de aluguel e de água/esgoto de todos os contratos ativos — cada um aparece na sua própria aba.
5. Quando o inquilino pagar (o aluguel e a água/esgoto podem ser pagos em datas diferentes), clique em "Marcar como pago" — o recibo em PDF daquele tipo é gerado automaticamente e fica disponível na tela de **Recibos**.
6. Para cobrar ou avisar o inquilino, clique no ícone do WhatsApp (na tela de Pagamentos ou de Recibos) — ele abre o WhatsApp com a mensagem pronta, só falta enviar. Requer o telefone do inquilino cadastrado.
7. Na tela de **Inquilinos**, clique no ícone de chave para criar o login daquele inquilino e mandar os dados de acesso por WhatsApp — a partir daí ele mesmo acompanha o prazo do contrato e baixa seus recibos, sem precisar te pedir.

## Estrutura do projeto

```
client/               Aplicativo React + Vite + TypeScript + Tailwind CSS
supabase/schema.sql   Schema do banco, políticas de RLS e bucket de recibos
supabase/migrations/  Migrações incrementais para projetos já existentes
supabase/functions/   Edge Functions calendar-feed (calendário) e manage-tenant-login (login dos inquilinos)
vercel.json            Configuração de build para hospedar na Vercel (opcional)
```
