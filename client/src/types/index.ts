export interface Property {
  id: number;
  nome: string;
  endereco: string;
  cidade: string | null;
  valor_aluguel: number;
  valor_agua_esgoto: number;
  ativo: number;
  observacoes: string | null;
}

export interface Tenant {
  id: number;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  observacoes: string | null;
}

export interface Contract {
  id: number;
  property_id: number;
  tenant_id: number;
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number;
  valor_aluguel: number;
  valor_agua_esgoto: number;
  status: "ativo" | "encerrado";
  observacoes: string | null;
  property_nome: string;
  property_endereco: string;
  tenant_nome: string;
}

export type PaymentStatus = "pendente" | "pago" | "atrasado" | "cancelado";

export interface Payment {
  id: number;
  contract_id: number;
  mes_referencia: string;
  data_vencimento: string;
  valor_aluguel: number;
  valor_agua_esgoto: number;
  valor_outros: number;
  descricao_outros: string | null;
  valor_total: number;
  status: PaymentStatus;
  data_pagamento: string | null;
  forma_pagamento: string | null;
  observacoes: string | null;
  property_nome: string;
  property_endereco: string;
  tenant_nome: string;
  tenant_cpf: string | null;
}

export interface PaymentSummary {
  mesAtual: string;
  recebidoMes: number;
  totalPendente: number;
  totalAtrasado: number;
  quantidadePendente: number;
  quantidadeAtrasado: number;
}
