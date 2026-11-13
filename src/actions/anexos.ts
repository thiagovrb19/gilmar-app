"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "./auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import {
  ANEXOS_BUCKET,
  ANEXO_SIGNED_URL_TTL,
  detectarMimePorAssinatura,
  sanitizarNomeArquivo,
  ANEXO_MAX_BYTES,
  ANEXO_MAX_POR_PEDIDO,
  extensaoDoMime,
} from "@/lib/anexos/config";
import { AgendamentoAnexo, AnexoVisualizacao } from "@/lib/supabase/types";
import { revalidatePath } from "next/cache";

/**
 * Valida se o usuário atual (admin ou cliente dono) tem permissão de acessar
 * os anexos do agendamento informado.
 */
async function validarAcessoAgendamento(
  agendamentoId: string
): Promise<{ permitido: boolean; isAdmin: boolean; clienteId?: string; error?: string }> {
  const user = await getCurrentUser();

  if (user?.role === "admin") {
    return { permitido: true, isAdmin: true };
  }

  if (!isSupabaseConfigured()) {
    const { loadStore } = await import("@/lib/mock-store");
    const store = loadStore();
    const ag = store.agendamentos.find((a) => a.id === agendamentoId);
    if (!ag) return { permitido: false, isAdmin: false, error: "Agendamento não encontrado." };

    return { permitido: true, isAdmin: false, clienteId: ag.cliente_id };
  }

  const supabase = createAdminClient();
  const { data: ag, error } = await supabase
    .from("agendamentos")
    .select("id, cliente_id, cliente:clientes(user_id, whatsapp)")
    .eq("id", agendamentoId)
    .maybeSingle();

  if (error || !ag) {
    return { permitido: false, isAdmin: false, error: "Agendamento não encontrado." };
  }

  return { permitido: true, isAdmin: false, clienteId: ag.cliente_id };
}

/**
 * Consulta e gera URLs assinadas temporárias para exibição das imagens
 * anexadas a um orçamento/agendamento.
 */
export async function getAnexosAgendamentoAction(
  agendamentoId: string
): Promise<{ success: boolean; anexos: AnexoVisualizacao[]; error?: string }> {
  try {
    if (!agendamentoId) {
      return { success: false, anexos: [], error: "ID do agendamento inválido." };
    }

    const acesso = await validarAcessoAgendamento(agendamentoId);
    if (!acesso.permitido) {
      return {
        success: false,
        anexos: [],
        error: "Você não tem permissão para visualizar os anexos desta solicitação.",
      };
    }

    // Modo Mock / Local
    if (!isSupabaseConfigured()) {
      const { mockGetAnexosAgendamento, loadStore } = await import("@/lib/mock-store");
      const registros = mockGetAnexosAgendamento(agendamentoId);
      const visualizacoes: AnexoVisualizacao[] = registros.map((r) => ({
        id: r.id,
        nome_original: r.nome_original,
        mime_type: r.mime_type,
        tamanho_bytes: r.tamanho_bytes,
        criado_em: r.criado_em,
        url: r.storage_path, // no mock guarda dataURL ou caminho relativo
      }));

      // Inclui também as fotos anexadas diretamente nos itens da Proposta Comercial
      const store = loadStore();
      const ag = store.agendamentos.find((a) => a.id === agendamentoId);
      if (ag?.proposta_itens_json && Array.isArray(ag.proposta_itens_json)) {
        ag.proposta_itens_json.forEach((item, idx) => {
          if (item.fotoUrl) {
            visualizacoes.push({
              id: `proposta-item-${agendamentoId}-${idx}`,
              nome_original: `${item.identificacao || `Item ${item.numero}`} — ${item.servicoNome}`,
              mime_type: "image/jpeg",
              tamanho_bytes: Math.round((item.fotoUrl.length * 3) / 4),
              criado_em: ag.criado_em,
              url: item.fotoUrl,
            });
          }
        });
      }

      return { success: true, anexos: visualizacoes };
    }

    // Modo Supabase Conectado
    const supabase = createAdminClient();
    const [anexosRes, agRes] = await Promise.all([
      supabase
        .from("agendamento_anexos")
        .select("*")
        .eq("agendamento_id", agendamentoId)
        .eq("status", "enviado")
        .order("criado_em", { ascending: true }),
      supabase
        .from("agendamentos")
        .select("id, criado_em, proposta_itens_json")
        .eq("id", agendamentoId)
        .maybeSingle(),
    ]);

    const registros = anexosRes.data || [];
    const visualizacoes: AnexoVisualizacao[] = [];

    // 1. Inclui fotos anexadas diretamente nos itens da Proposta Comercial (proposta_itens_json)
    const itensProposta = (agRes.data as any)?.proposta_itens_json;
    if ( Array.isArray(itensProposta)) {
      itensProposta.forEach((item: any, idx: number) => {
        if (item?.fotoUrl) {
          visualizacoes.push({
            id: `proposta-item-${agendamentoId}-${idx}`,
            nome_original: `${item.identificacao || `Item ${item.numero || idx + 1}`} — ${item.servicoNome || "Serviço"}`,
            mime_type: "image/jpeg",
            tamanho_bytes: Math.round((String(item.fotoUrl).length * 3) / 4),
            criado_em: (agRes.data as any)?.criado_em || new Date().toISOString(),
            url: item.fotoUrl,
          });
        }
      });
    }

    // 2. Gera URL assinada de curta duração para cada imagem do bucket Storage
    for (const reg of registros as AgendamentoAnexo[]) {
      const { data: signedData, error: signError } = await supabase.storage
        .from(ANEXOS_BUCKET)
        .createSignedUrl(reg.storage_path, ANEXO_SIGNED_URL_TTL);

      if (signError || !signedData?.signedUrl) {
        console.error("Erro ao assinar URL para", reg.storage_path, signError);
        continue;
      }

      visualizacoes.push({
        id: reg.id,
        nome_original: reg.nome_original,
        mime_type: reg.mime_type,
        tamanho_bytes: reg.tamanho_bytes,
        criado_em: reg.criado_em,
        url: signedData.signedUrl,
      });
    }

    return { success: true, anexos: visualizacoes };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido ao carregar anexos";
    return { success: false, anexos: [], error: msg };
  }
}

/**
 * Exclui uma imagem anexada (apenas administrador).
 */
export async function excluirAnexoAction(
  anexoId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (user?.role !== "admin") {
      return { success: false, error: "Apenas administradores podem remover anexos." };
    }

    // Fotos que vivem dentro dos itens da proposta têm id "proposta-item-<agendamento>-<índice>"
    const fotoDeItem = /^proposta-item-(.+)-(\d+)$/.exec(anexoId || "");
    if (fotoDeItem) {
      const { definirFotoItemPropostaAction } = await import("./booking");
      return definirFotoItemPropostaAction({
        agendamentoId: fotoDeItem[1],
        indice: Number(fotoDeItem[2]),
        foto: null,
      });
    }

    if (!isSupabaseConfigured()) {
      const { mockExcluirAnexo } = await import("@/lib/mock-store");
      mockExcluirAnexo(anexoId);
      revalidatePath("/admin");
      revalidatePath("/admin/agenda");
      return { success: true };
    }

    const supabase = createAdminClient();
    const { data: anexo, error: buscaErr } = await supabase
      .from("agendamento_anexos")
      .select("*")
      .eq("id", anexoId)
      .maybeSingle();

    if (buscaErr || !anexo) {
      return { success: false, error: "Anexo não encontrado." };
    }

    // Remove do Storage
    await supabase.storage.from(ANEXOS_BUCKET).remove([anexo.storage_path]);

    // Remove do banco
    const { error: delErr } = await supabase
      .from("agendamento_anexos")
      .delete()
      .eq("id", anexoId);

    if (delErr) {
      return { success: false, error: delErr.message };
    }

    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao excluir anexo";
    return { success: false, error: msg };
  }
}
