export type UserRole = "cliente" | "admin";

export interface Profile {
  id: string;
  role: UserRole;
  cliente_id: string | null;
  criado_em: string;
}

export interface Cliente {
  id: string;
  nome: string;
  whatsapp: string;
  data_nascimento: string | null;
  user_id: string | null;
  observacoes: string | null;
  aceite_lgpd_em: string | null;
  criado_em: string;
}

export type ServicoTipo = "avulso" | "combo";

export interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number;
  duracao_min: number;
  icone: string;
  tipo: ServicoTipo;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  itens_combo?: Servico[]; // quando combo, itens que o compõem
}

export interface ComboItem {
  combo_id: string;
  servico_id: string;
}

export type AgendamentoStatus =
  | "agendado"
  | "confirmado"
  | "concluido"
  | "cancelado"
  | "nao_compareceu";

export type AgendamentoOrigem = "app" | "admin" | "fixo";

export type FormaPagamento =
  | "pix"
  | "dinheiro"
  | "debito"
  | "credito"
  | "credito_pre_pago"
  | "outro";

export interface Agendamento {
  id: string;
  cliente_id: string;
  inicio: string;
  fim: string;
  status: AgendamentoStatus;
  origem: AgendamentoOrigem;
  horario_fixo_id: string | null;
  valor_total: number;
  desconto: number;
  pago: boolean;
  forma_pagamento: FormaPagamento | null;
  usou_credito: boolean;
  cancelado_em: string | null;
  cancelado_por: string | null;
  motivo_cancelamento: string | null;
  observacao: string | null;
  proposta_subtitulo?: string | null;
  proposta_objetivo?: string | null;
  proposta_condicoes_pagamento?: string | null;
  cliente_localidade?: string | null;
  proposta_itens_json?: PropostaItemDetalhe[] | null;
  criado_em: string;
  cliente?: Cliente;
  servicos?: Servico[];
  anexos?: AnexoVisualizacao[];
}

export interface PropostaItemDetalhe {
  numero: string; // "01", "02", etc.
  identificacao: string; // ex: "Máquina 01" ou "Ambiente / Ponto 01"
  servicoNome: string; // ex: "Painel completo com botão de emergência"
  escopo: string; // ex: "Instalação de painel completo com botão de emergência na Máquina 01."
  descricao: string; // ex: "Fornecimento e instalação de painel completo com botão de emergência. Materiais e mão de obra inclusos."
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  fotoUrl?: string | null;
  icone?: string;
}

export interface EstoquePeca {
  id: string;
  nome: string;
  categoria: string;
  valor_unitario: number;
  quantidade: number;
  estoque_minimo: number;
  unidade: string;
  observacao: string | null;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

export interface AgendamentoServico {
  agendamento_id: string;
  servico_id: string;
  preco_cobrado: number;
}

export type AnexoStatus = "pendente" | "enviado";

/** Referência de uma imagem anexada a um pedido (o arquivo fica no Storage) */
export interface AgendamentoAnexo {
  id: string;
  agendamento_id: string;
  cliente_id: string;
  bucket: string;
  storage_path: string;
  nome_original: string;
  mime_type: string;
  tamanho_bytes: number;
  status: AnexoStatus;
  criado_em: string;
  enviado_em: string | null;
}

/** Anexo pronto para exibição no painel, com URL temporária */
export interface AnexoVisualizacao {
  id: string;
  nome_original: string;
  mime_type: string;
  tamanho_bytes: number;
  criado_em: string;
  url: string;
}

export interface HorarioFuncionamento {
  dia_semana: number; // 0=Domingo, 1=Segunda, etc.
  abre: string; // "17:00:00"
  fecha: string; // "21:00:00"
  ativo: boolean;
}

export interface Bloqueio {
  id: string;
  inicio: string;
  fim: string;
  motivo: string;
  criado_em: string;
}

export type DiaExcecaoTipo = "fechado" | "personalizado";

export interface DiaExcecao {
  id: string;
  data: string; // YYYY-MM-DD
  tipo: DiaExcecaoTipo;
  motivo?: string | null;
  abre?: string | null; // ex: "17:00"
  fecha?: string | null; // ex: "18:00"
  horarios_especificos?: string[] | null; // ex: ["17:00"] ou ["08:00", "09:00", "10:00"]
  criado_em: string;
}

export interface HorarioFixo {
  id: string;
  cliente_id: string;
  dia_semana: number;
  hora: string;
  servico_id: string;
  ativo: boolean;
  criado_em: string;
  recorrencia?: "semanal" | "quinzenal" | "mensal";
  data_inicio?: string;
  data_fim?: string | null;
  cliente?: Cliente;
  servico?: Servico;
}

export type MultaStatus = "pendente" | "paga" | "perdoada";

export interface Multa {
  id: string;
  cliente_id: string;
  agendamento_id: string;
  valor: number;
  status: MultaStatus;
  criado_em: string;
  pago_em: string | null;
  cliente?: Cliente;
  agendamento?: Agendamento;
}

export type LancamentoTipo = "entrada" | "saida";

export interface Lancamento {
  id: string;
  tipo: LancamentoTipo;
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  forma_pagamento: FormaPagamento | null;
  agendamento_id: string | null;
  multa_id: string | null;
  cliente_id: string | null;
  criado_em: string;
  cliente?: Cliente;
}

export interface Credito {
  id: string;
  cliente_id: string;
  servico_id: string;
  quantidade: number;
  saldo: number;
  valor_pago: number;
  data: string;
  criado_em: string;
  servico?: Servico;
}

export interface Avaliacao {
  id: string;
  agendamento_id: string;
  cliente_id: string;
  nota: number;
  comentario: string | null;
  criado_em: string;
}

export interface Configuracao {
  id: number;
  nome_barbearia: string;
  whatsapp_contato: string;
  endereco: string | null;
  link_maps: string | null;
  instagram: string | null;
  pix_chave: string;
  pix_nome: string;
  pix_cidade: string;
  duracao_horario_min: number;
  antecedencia_minima_horas: number;
  janela_dias: number;
  horas_cancelamento_gratis: number;
  multa_percentual: number;
  bloquear_se_multa_pendente: boolean;
  desconto_aniversario_ativo: boolean;
  desconto_aniversario_percentual: number;
  desconto_aniversario_regra: "dia" | "semana" | "mes";
  dias_cliente_sumido: number;
  fidelidade_ativo: boolean;
  fidelidade_a_cada_visitas: number;
  fidelidade_servico_premio_id: string | null;
  atualizado_em: string;
}

export interface ClienteEstatistica {
  id: string;
  nome: string;
  whatsapp: string;
  data_nascimento: string | null;
  user_id: string | null;
  observacoes: string | null;
  criado_em: string;
  visitas: number;
  total_gasto: number;
  ultima_visita: string | null;
  dias_sem_vir: number | null;
  multas_pendentes_qtd: number;
  multas_pendentes_valor: number;
  servico_mais_usado?: string | null;
}
