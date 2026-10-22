import { Servico } from "./supabase/types";

export interface ComboOptimizationResult {
  appliedCombos: Array<{
    combo: Servico;
    replacedServices: Servico[];
    saving: number;
  }>;
  residualServices: Servico[];
  originalTotal: number;
  finalTotal: number;
  totalSavings: number;
}

/**
 * Mapeamento padrão dos IDs/nomes de combos e seus itens componentes
 */
export interface ComboMapping {
  comboName: string;
  itemNames: string[]; // ex: ['Corte', 'Barba']
}

export const DEFAULT_COMBO_MAPPINGS: ComboMapping[] = [
  {
    comboName: "Cabelo, Sobrancelha e Cavanhaque",
    itemNames: ["Corte", "Sobrancelha", "Cavanhaque"],
  },
  {
    comboName: "Combo: Cabelo + Barba",
    itemNames: ["Corte", "Barba"],
  },
];

/**
 * Normaliza o nome do serviço para comparação flexível
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/**
 * Algoritmo de identificação e substituição automática de combos
 */
export function optimizeServicesWithCombos(
  selectedServices: Servico[],
  allServices: Servico[]
): ComboOptimizationResult {
  const originalTotal = selectedServices.reduce((acc, s) => acc + Number(s.preco), 0);
  
  // Se o usuário já selecionou um combo diretamente, manter sem redundância
  const existingCombos = selectedServices.filter((s) => s.tipo === "combo");
  let remainingSingles = selectedServices.filter((s) => s.tipo === "avulso");

  const combosDisponiveis = allServices.filter((s) => s.tipo === "combo" && s.ativo);
  const appliedCombos: ComboOptimizationResult["appliedCombos"] = [];

  // Ordenar combos pelos maiores ou mais específicos primeiro
  // Ex: 3 itens antes de 2 itens
  const sortedComboDefs = [...DEFAULT_COMBO_MAPPINGS].sort(
    (a, b) => b.itemNames.length - a.itemNames.length
  );

  for (const mapping of sortedComboDefs) {
    const matchingComboServico = combosDisponiveis.find((c) => {
      const normC = normalizeName(c.nome);
      const normM = normalizeName(mapping.comboName);
      return (
        normC.includes(normM) ||
        normM.includes(normC) ||
        (normM.includes("sobrancelha") && normC.includes("sobrancelha") && normC.includes("cavanhaque")) ||
        (normM.includes("barba") && normC.includes("barba") && !normC.includes("sobrancelha"))
      );
    });

    if (!matchingComboServico) continue;

    // Verificar se todos os itens componentes do combo estão nos singles selecionados
    const matchingSingles: Servico[] = [];
    let allFound = true;

    for (const requiredName of mapping.itemNames) {
      const foundIndex = remainingSingles.findIndex(
        (s) =>
          normalizeName(s.nome).includes(normalizeName(requiredName)) &&
          !matchingSingles.some((m) => m.id === s.id)
      );

      if (foundIndex !== -1) {
        matchingSingles.push(remainingSingles[foundIndex]);
      } else {
        allFound = false;
        break;
      }
    }

    if (allFound && matchingSingles.length === mapping.itemNames.length) {
      // Remover os itens individuais usados
      const singleIdsToRemove = new Set(matchingSingles.map((m) => m.id));
      remainingSingles = remainingSingles.filter((s) => !singleIdsToRemove.has(s.id));

      const itemsSum = matchingSingles.reduce((acc, s) => acc + Number(s.preco), 0);
      const saving = Math.max(0, itemsSum - Number(matchingComboServico.preco));

      appliedCombos.push({
        combo: matchingComboServico,
        replacedServices: matchingSingles,
        saving,
      });
    }
  }

  // Combina combos já selecionados pelo usuário + combos aplicados automaticamente
  const allFinalCombos = [
    ...existingCombos.map((c) => ({
      combo: c,
      replacedServices: [],
      saving: 0,
    })),
    ...appliedCombos,
  ];

  const finalTotal =
    allFinalCombos.reduce((acc, item) => acc + Number(item.combo.preco), 0) +
    remainingSingles.reduce((acc, s) => acc + Number(s.preco), 0);

  const totalSavings = appliedCombos.reduce((acc, item) => acc + item.saving, 0);

  return {
    appliedCombos,
    residualServices: remainingSingles,
    originalTotal,
    finalTotal,
    totalSavings,
  };
}
