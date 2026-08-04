# Meu Aluguel

Sistema web para gestão de imóveis alugados: cadastro de imóveis e inquilinos, contratos, controle de pagamentos mensais (aluguel + taxa de água e esgoto) e emissão automática de recibos em PDF.

**Arquitetura:** aplicativo 100% estático (React + Vite), hospedado gratuitamente no **GitHub Pages**, falando diretamente com um projeto **Supabase** (banco Postgres + autenticação + armazenamento de arquivos). Não há backend próprio — o Supabase cobre login, banco de dados e o storage dos PDFs dos recibos.

## Funcionalidades

- **Imóveis**: cadastro com endereço, valor do aluguel e valor fixo da taxa de água e esgoto.
- **Inquilinos**: cadastro com CPF, e-mail e telefone.
- **Contratos**: vincula imóvel + inquilino, define dia de vencimento e valores (herdados do imóvel, editáveis por contrato).
- **Pagamentos**: geração mensal automática das cobranças (aluguel + água/esgoto) para todos os contratos ativos; permite ajustar valores pontuais (ex: conta de água variou naquele mês) ou lançar valores extras (ex: IPTU); marca como pago e calcula atraso automaticamente.
- **Recibos**: ao marcar um pagamento como pago, um recibo em PDF é gerado no navegador e enviado para o Supabase Storage, disponível para download a qualquer momento na tela de Recibos.
- **Painel**: resumo do mês (recebido, pendente, atrasado), gráfico de receita dos últimos 6 meses e próximos vencimentos.
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

## 3. Publicar no GitHub Pages

O repositório já vem com um workflow (`.github/workflows/deploy-pages.yml`) que builda e publica o site a cada push.

1. No repositório do GitHub, vá em **Settings > Pages** e em "Build and deployment" escolha **Source: GitHub Actions**.
2. Em **Settings > Secrets and variables > Actions > New repository secret**, cadastre:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Dê um push na branch monitorada pelo workflow (por padrão `main`) — o Actions builda o app e publica em `https://<seu-usuário>.github.io/Meu-Aluguel/`.

> A `anon key` do Supabase é uma chave pública (protegida pelas políticas de RLS do banco), então não há problema em ela ficar embutida no site publicado.

## Fluxo de uso

1. Cadastre seus **imóveis**, informando o valor do aluguel e da taxa de água e esgoto.
2. Cadastre os **inquilinos**.
3. Crie um **contrato** vinculando imóvel e inquilino (os valores são copiados do imóvel, mas podem ser ajustados).
4. Todo mês, na tela de **Pagamentos**, clique em "Gerar cobranças" para criar os lançamentos de todos os contratos ativos.
5. Quando o inquilino pagar, clique em "Marcar como pago" — o recibo em PDF é gerado automaticamente e fica disponível na tela de **Recibos**.

## Estrutura do projeto

```
client/     Aplicativo React + Vite + TypeScript + Tailwind CSS
supabase/   schema.sql — schema do banco, políticas de RLS e bucket de recibos
```
