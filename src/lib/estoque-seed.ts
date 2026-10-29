import { EstoquePeca } from "./supabase/types";

const BASE_TIMESTAMP = "2026-01-01T00:00:00Z";

function createSeedItem(
  ordem: number,
  nome: string,
  valor_unitario: number,
  quantidade: number,
  categoria: string,
  unidade: string = "un"
): EstoquePeca {
  const numStr = String(ordem).padStart(4, "0");
  return {
    id: `e0000000-0000-0000-0000-00000000${numStr}`,
    nome,
    categoria,
    valor_unitario,
    quantidade,
    estoque_minimo: 2,
    unidade,
    observacao: null,
    ativo: true,
    ordem,
    criado_em: BASE_TIMESTAMP,
    atualizado_em: BASE_TIMESTAMP,
  };
}

/**
 * Planilha Oficial de Estoque do Gilmar Sales (Gilmar.xlsx)
 * 44 itens com Valor (R$), Estoque e Receita (Valor * Estoque)
 */
export const DEFAULT_ESTOQUE_PECAS: EstoquePeca[] = [
  createSeedItem(1, "REFLETOR", 70, 5, "Iluminação"),
  createSeedItem(2, "BARRA DE COBRE", 35, 8, "Quadros e Barramentos"),
  createSeedItem(3, "TOMADA MACHO", 10, 5, "Tomadas e Plugues"),
  createSeedItem(4, "TOMADA FÊMEA", 10, 12, "Tomadas e Plugues"),
  createSeedItem(5, "CAIXA DE BOTÃO EMG.", 25, 2, "Comandos e Botões"),
  createSeedItem(6, "RELE FALTA DE FASE 380V", 170, 2, "Relés e Automação"),
  createSeedItem(7, "RELE TEMPORIZADOR", 90, 3, "Relés e Automação"),
  createSeedItem(8, "RELE SLIM 24V", 50, 1, "Relés e Automação"),
  createSeedItem(9, "RELE ACOPLADOR 24V", 40, 1, "Relés e Automação"),
  createSeedItem(10, "RELE ACOPLADOR 220V", 40, 2, "Relés e Automação"),
  createSeedItem(11, "CONECTOR VAGO", 5, 35, "Conectores e Terminais"),
  createSeedItem(12, "SENSOR DE PRESENÇA (BOCAL)", 35, 2, "Sensores e Controle"),
  createSeedItem(13, "TIMER", 35, 1, "Sensores e Controle"),
  createSeedItem(14, "SENSOR FIM DE CURSO", 50, 1, "Sensores e Controle"),
  createSeedItem(15, "SENSOR BOIA", 30, 3, "Sensores e Controle"),
  createSeedItem(16, "BOTÃO DE PULSO", 25, 2, "Comandos e Botões"),
  createSeedItem(17, "BOTÃO LIGA/DESLIGA", 25, 1, "Comandos e Botões"),
  createSeedItem(18, "CONECTOR VAMPIRO 14 mm", 30, 4, "Conectores e Terminais"),
  createSeedItem(19, "CHAVE LIGA/DELIGA", 10, 3, "Comandos e Botões"),
  createSeedItem(20, "BLOCO DE CONTATO", 15, 4, "Comandos e Botões"),
  createSeedItem(21, "REGULADOR VELOCIDADE", 45, 1, "Sensores e Controle"),
  createSeedItem(22, "CONTATORA 12A 24V", 10, 1, "Contatoras"),
  createSeedItem(23, "CONTATORA 7A 24V", 90, 1, "Contatoras"),
  createSeedItem(24, "CONTATORA 25A 220V", 170, 3, "Contatoras"),
  createSeedItem(25, "CONTATORA 32A 24V", 220, 2, "Contatoras"),
  createSeedItem(26, "CONTATORA 9A 24V", 140, 1, "Contatoras"),
  createSeedItem(27, "CONTATORA 10A 24V", 150, 1, "Contatoras"),
  createSeedItem(28, "RELE TERMICO 8 a 12,5", 130, 1, "Relés e Automação"),
  createSeedItem(29, "DISJUNTOR MOTOR 20 a 25", 150, 1, "Disjuntores e Proteção"),
  createSeedItem(30, "DISJUNTOR MONO 32A", 20, 1, "Disjuntores e Proteção"),
  createSeedItem(31, "DISJUNTOR BIPOLAR 10A", 30, 4, "Disjuntores e Proteção"),
  createSeedItem(32, "DISJUNTOR TRIFASICO 32A", 30, 2, "Disjuntores e Proteção"),
  createSeedItem(33, "DISJUNTOR MONO 30A", 25, 1, "Disjuntores e Proteção"),
  createSeedItem(34, "FONTE 24V 5A", 200, 1, "Fontes e Alimentação"),
  createSeedItem(35, "LAMPADA DE IMBUTIR 12W", 20, 3, "Iluminação"),
  createSeedItem(36, "LAMPADA DE SOBREPOR 25W", 25, 1, "Iluminação"),
  createSeedItem(37, "LAMPADA DE IMBUTIR 18W", 20, 1, "Iluminação"),
  createSeedItem(38, "LAMPADA SOBREPOR 24W", 35, 1, "Iluminação"),
  createSeedItem(39, "ROLO DE CABO 1X 1,5 50m", 35, 2, "Cabos e Fios", "rolo"),
  createSeedItem(40, "ROLO DE CABO 1X 2,5", 70, 1, "Cabos e Fios", "rolo"),
  createSeedItem(41, "CABO PARALELO 2 POR 1,5 5m", 15, 5, "Cabos e Fios", "un"),
  createSeedItem(42, "SILICONE", 20, 1, "Insumos e Acabamento"),
  createSeedItem(43, "ESPUMA EXPANSIVA", 35, 1, "Insumos e Acabamento"),
  createSeedItem(44, "TAMPA P/ TOMADA", 5, 7, "Tomadas e Plugues"),
];

export const ESTOQUE_CATEGORIAS = [
  "Iluminação",
  "Quadros e Barramentos",
  "Tomadas e Plugues",
  "Comandos e Botões",
  "Relés e Automação",
  "Conectores e Terminais",
  "Sensores e Controle",
  "Contatoras",
  "Disjuntores e Proteção",
  "Fontes e Alimentação",
  "Cabos e Fios",
  "Insumos e Acabamento",
  "Outros",
];

