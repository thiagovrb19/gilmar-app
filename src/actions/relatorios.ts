"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "./auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  RelatorioFoto,
  RelatorioFotoTipo,
  RelatorioServico,
  RelatorioServicoDetalhe,
  RelatorioServicoResumo,
} from "@/lib/supabase/types";
import { RELATORIO_TITULO_PADRAO } from "@/lib/relatorios/config";
import {
  repoAssinarFotos,
  repoAtualizar,
  repoCriar,
  repoExcluir,
  repoListar,
  repoObter,
  repoObterPorAgendamento,
  repoRemoverArquivos,
} from "@/lib/relatorios/repo";

const SEM_PERMISSAO = "Apenas o administrador pode acessar os relatórios.";

async function ehAdmin(): Promise<boolean> {
  const user = await getCurrentUser();
  return user?.role === "admin";
}

function mensagem(err: unknown, padrao: string): string {
  return err instanceof Error && err.message ? err.message : padrao;
}

function limpar(v: unknown, max: number): string {
  return String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

function ehUuid(v?: string | null): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

/** No Supabase as colunas de vínculo são UUID; no modo demonstração os ids são livres */
function idVinculo(v?: string | null): string | null {
  if (!v) return null;
  if (!isSupabaseConfigured()) return v;
  return ehUuid(v) ? v : null;
}

function dataValida(v?: string | null): string {
  const s = (v || "").slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(new Date(`${s}T12:00:00`).getTime())) return s;
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

async function detalhar(r: RelatorioServico): Promise<RelatorioServicoDetalhe> {
  const { fotos, ...resto } = r;
  return { ...resto, fotos: await repoAssinarFotos(fotos) };
}

/** Lista os relatórios (sem as fotos, só as quantidades) */
export async function listarRelatoriosAction(): Promise<{
  success: boolean;
  relatorios: RelatorioServicoResumo[];
  error?: string;
}> {
  try {
    if (!(await ehAdmin())) return { success: false, relatorios: [], error: SEM_PERMISSAO };
    const lista = await repoListar();
    return {
      success: true,
      relatorios: lista.map(({ fotos, ...resto }) => ({
        ...resto,
        qtd_antes: fotos.filter((f) => f.tipo === "antes").length,
        qtd_depois: fotos.filter((f) => f.tipo === "depois").length,
      })),
    };
  } catch (err) {
    return { success: false, relatorios: [], error: mensagem(err, "Erro ao listar os relatórios.") };
  }
}

/** Abre um relatório pelo id, com as fotos prontas para exibição */
export async function obterRelatorioAction(
  id: string
): Promise<{ success: boolean; relatorio?: RelatorioServicoDetalhe; error?: string }> {
  try {
    if (!(await ehAdmin())) return { success: false, error: SEM_PERMISSAO };
    const r = await repoObter(id);
    if (!r) return { success: false, error: "Relatório não encontrado." };
    return { success: true, relatorio: await detalhar(r) };
  } catch (err) {
    return { success: false, error: mensagem(err, "Erro ao abrir o relatório.") };
  }
}

/** Procura o relatório já criado para um orçamento (relatorio = null quando ainda não existe) */
export async function obterRelatorioPorAgendamentoAction(
  agendamentoId: string
): Promise<{ success: boolean; relatorio: RelatorioServicoDetalhe | null; error?: string }> {
  try {
    if (!(await ehAdmin())) return { success: false, relatorio: null, error: SEM_PERMISSAO };
    const vinculo = idVinculo(agendamentoId);
    if (!vinculo) return { success: true, relatorio: null };
    const r = await repoObterPorAgendamento(vinculo);
    return { success: true, relatorio: r ? await detalhar(r) : null };
  } catch (err) {
    return { success: false, relatorio: null, error: mensagem(err, "Erro ao abrir o relatório.") };
  }
}

/**
 * Cria ou atualiza os textos do relatório e a situação das fotos JÁ enviadas
 * (ordem, legenda, antes/depois; as que não vierem na lista são apagadas).
 * As fotos novas são enviadas depois, uma a uma, pela rota /api/admin/relatorios/fotos.
 */
export async function salvarRelatorioAction(params: {
  id?: string | null;
  agendamentoId?: string | null;
  clienteId?: string | null;
  clienteNome: string;
  clienteWhatsapp?: string | null;
  clienteLocalidade?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  observacoes?: string | null;
  dataServico?: string | null;
  fotos?: { id: string; tipo: RelatorioFotoTipo; legenda?: string | null }[];
}): Promise<{ success: boolean; id?: string; error?: string }> {
  try {
    if (!(await ehAdmin())) return { success: false, error: SEM_PERMISSAO };

    const clienteNome = limpar(params.clienteNome, 120);
    if (clienteNome.length < 2) return { success: false, error: "Informe o nome do cliente." };

    const textos = {
      cliente_nome: clienteNome,
      cliente_whatsapp: (params.clienteWhatsapp || "").replace(/\D/g, "").slice(0, 20) || null,
      cliente_localidade: limpar(params.clienteLocalidade, 200) || null,
      titulo: limpar(params.titulo, 200) || RELATORIO_TITULO_PADRAO,
      descricao: limpar(params.descricao, 4000) || null,
      observacoes: limpar(params.observacoes, 2000) || null,
      data_servico: dataValida(params.dataServico),
    };

    let id = params.id || null;

    if (!id) {
      id = crypto.randomUUID();
      await repoCriar(id, {
        ...textos,
        agendamento_id: idVinculo(params.agendamentoId),
        cliente_id: idVinculo(params.clienteId),
        fotos: [],
      });
    } else {
      const atual = await repoObter(id);
      if (!atual) return { success: false, error: "Relatório não encontrado." };

      // Reordena/edita as fotos existentes conforme a lista recebida; o `path` nunca vem do navegador
      const porId = new Map(atual.fotos.map((f) => [f.id, f]));
      const mantidas: RelatorioFoto[] = [];
      for (const f of params.fotos || []) {
        const original = porId.get(f.id);
        if (!original || mantidas.some((m) => m.id === f.id)) continue;
        mantidas.push({
          id: original.id,
          path: original.path,
          tipo: f.tipo === "depois" ? "depois" : "antes",
          legenda: limpar(f.legenda, 200),
        });
      }
      const removidas = atual.fotos.filter((f) => !mantidas.some((m) => m.id === f.id));

      await repoAtualizar(id, { ...textos, fotos: mantidas });
      await repoRemoverArquivos(removidas.map((f) => f.path));
    }

    revalidatePath("/admin/relatorios");
    return { success: true, id };
  } catch (err) {
    return { success: false, error: mensagem(err, "Erro ao salvar o relatório.") };
  }
}

/** Exclui o relatório e todas as fotos dele */
export async function excluirRelatorioAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!(await ehAdmin())) return { success: false, error: SEM_PERMISSAO };
    const atual = await repoObter(id);
    if (!atual) return { success: true };
    await repoExcluir(id);
    await repoRemoverArquivos(atual.fotos.map((f) => f.path));
    revalidatePath("/admin/relatorios");
    return { success: true };
  } catch (err) {
    return { success: false, error: mensagem(err, "Erro ao excluir o relatório.") };
  }
}
