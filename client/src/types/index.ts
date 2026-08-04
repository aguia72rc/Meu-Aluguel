export interface Property {
  id: string;
  nome: string;
  endereco: string;
  cidade: string | null;
  valor_aluguel: number;
  valor_agua_esgoto: number;
  ativo: boolean;
  observacoes: string | null;
}

export interface Tenant {
  id: string;
  nome: string;
  cpf: string | null;
  email: string | null;
  telefone: string | null;
  observacoes: string | null;
}

export interface Contract {
  id: string;
  property_id: string;
  tenant_id: string;
  data_inicio: string;
  data_fim: string | null;
  dia_vencimento: number;
  dia_vencimento_agua_esgoto: number;
  valor_aluguel: number;
  valor_agua_esgoto: number;
  status: "ativo" | "encerrado";
  observacoes: string | null;
  property_nome: string;
  property_endereco: string;
  tenant_nome: string;
}

export type PaymentStatus = "pendente" | "pago" | "atrasado" | "cancelado";
export type PaymentType = "aluguel" | "agua_esgoto";

export interface Payment {
  id: string;
  contract_id: string;
  tipo: PaymentType;
  mes_referencia: string;
  data_vencimento: string;
  valor: number;
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

export interface Receipt {
  id: string;
  payment_id: string;
  numero: string;
  data_emissao: string;
  storage_path: string;
  tipo: PaymentType;
  mes_referencia: string;
  valor_total: number;
  property_nome: string;
  tenant_nome: string;
}

export interface PaymentSummary {
  mesAtual: string;
  recebidoMes: number;
  totalPendente: number;
  totalAtrasado: number;
  quantidadePendente: number;
  quantidadeAtrasado: number;
}
