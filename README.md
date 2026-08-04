# Meu Aluguel

Sistema web para gestão de imóveis alugados: cadastro de imóveis e inquilinos, contratos, controle de pagamentos mensais (aluguel + taxa de água e esgoto) e emissão automática de recibos em PDF.

## Funcionalidades

- **Imóveis**: cadastro com endereço, valor do aluguel e valor fixo da taxa de água e esgoto.
- **Inquilinos**: cadastro com CPF, e-mail e telefone.
- **Contratos**: vincula imóvel + inquilino, define dia de vencimento e valores (herdados do imóvel, editáveis por contrato).
- **Pagamentos**: geração mensal automática das cobranças (aluguel + água/esgoto) para todos os contratos ativos; permite ajustar valores pontuais (ex: conta de água variou naquele mês) ou lançar valores extras (ex: IPTU); marca como pago e calcula atraso automaticamente.
- **Recibos**: ao marcar um pagamento como pago, um recibo em PDF é gerado automaticamente, detalhando aluguel e taxa de água e esgoto separadamente, disponível para download.
- **Painel**: resumo do mês (recebido, pendente, atrasado) e próximos vencimentos.
- Sistema de login único (uso pessoal).

## Estrutura do projeto

```
server/   API (Node.js + Express + TypeScript + SQLite)
client/   Interface web (React + Vite + TypeScript + Tailwind CSS)
```

## Como rodar localmente

### 1. Backend

```bash
cd server
cp .env.example .env   # edite o e-mail, senha e nome do administrador
npm install
npm run seed            # cria o usuário administrador
npm run dev              # inicia a API em http://localhost:3001
```

### 2. Frontend

Em outro terminal:

```bash
cd client
npm install
npm run dev              # inicia a interface em http://localhost:5173
```

Acesse `http://localhost:5173` e faça login com o e-mail e senha definidos no `.env` do backend.

## Fluxo de uso

1. Cadastre seus **imóveis**, informando o valor do aluguel e da taxa de água e esgoto.
2. Cadastre os **inquilinos**.
3. Crie um **contrato** vinculando imóvel e inquilino (os valores são copiados do imóvel, mas podem ser ajustados).
4. Todo mês, na tela de **Pagamentos**, clique em "Gerar cobranças do mês" para criar os lançamentos de todos os contratos ativos.
5. Quando o inquilino pagar, clique em "Marcar como pago" — o recibo em PDF é gerado automaticamente e fica disponível para download.

## Build de produção

```bash
cd server && npm run build && npm start
cd client && npm run build   # gera client/dist, pronto para servir por qualquer servidor estático
```

Em produção, configure `VITE_API_URL` (client) apontando para a URL pública da API, e defina um `JWT_SECRET` forte no `.env` do servidor.
