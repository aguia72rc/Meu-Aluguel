-- Usuário administrador do sistema (uso pessoal, single-user)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT 'Administrador',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Imóveis
CREATE TABLE IF NOT EXISTS properties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  cidade TEXT,
  valor_aluguel REAL NOT NULL DEFAULT 0,
  valor_agua_esgoto REAL NOT NULL DEFAULT 0,
  ativo INTEGER NOT NULL DEFAULT 1,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Inquilinos
CREATE TABLE IF NOT EXISTS tenants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT NOT NULL,
  cpf TEXT,
  email TEXT,
  telefone TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Contratos de aluguel (vincula imóvel + inquilino)
CREATE TABLE IF NOT EXISTS contracts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
  tenant_id INTEGER NOT NULL REFERENCES tenants(id) ON DELETE RESTRICT,
  data_inicio TEXT NOT NULL,
  data_fim TEXT,
  dia_vencimento INTEGER NOT NULL DEFAULT 5,
  valor_aluguel REAL NOT NULL,
  valor_agua_esgoto REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo', 'encerrado')),
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Pagamentos (uma linha por mês de referência por contrato)
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contract_id INTEGER NOT NULL REFERENCES contracts(id) ON DELETE RESTRICT,
  mes_referencia TEXT NOT NULL, -- formato YYYY-MM
  data_vencimento TEXT NOT NULL,
  valor_aluguel REAL NOT NULL,
  valor_agua_esgoto REAL NOT NULL DEFAULT 0,
  valor_outros REAL NOT NULL DEFAULT 0,
  descricao_outros TEXT,
  valor_total REAL NOT NULL,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado')),
  data_pagamento TEXT,
  forma_pagamento TEXT,
  observacoes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (contract_id, mes_referencia)
);

-- Recibos emitidos referentes a um pagamento
CREATE TABLE IF NOT EXISTS receipts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  payment_id INTEGER NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
  numero TEXT NOT NULL UNIQUE,
  data_emissao TEXT NOT NULL DEFAULT (datetime('now')),
  arquivo TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payments_contract ON payments(contract_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
CREATE INDEX IF NOT EXISTS idx_contracts_property ON contracts(property_id);
CREATE INDEX IF NOT EXISTS idx_contracts_tenant ON contracts(tenant_id);
