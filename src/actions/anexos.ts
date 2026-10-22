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

    const ehDono =
      Boolean(user?.clienteId && ag.cliente_id === user.clienteId) ||
      Boolean(user?.id && ag.cliente_id === user.id) ||
      Boolean(user?.cliente?.whatsapp && ag.cliente?.whatsapp === user.cliente.whatsapp);

    return { permitido: ehDono, isAdmin: false, clienteId: ag.cliente_id };
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

  const ehDono =
    Boolean(user?.clienteId && ag.cliente_id === user.clienteId) ||
    Boolean(user?.id && (ag.cliente_id === user.id || (ag.cliente as any)?.user_id === user.id)) ||
    Boolean(user?.cliente?.whatsapp && (ag.cliente as any)?.whatsapp === user.cliente.whatsapp);

  return { permitido: ehDono, isAdmin: false, clienteId: ag.cliente_id };
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
      const { mockGetAnexosAgendamento } = await import("@/lib/mock-store");
      const registros = mockGetAnexosAgendamento(agendamentoId);
      const visualizacoes: AnexoVisualizacao[] = registros.map((r) => ({
        id: r.id,
        nome_original: r.nome_original,
        mime_type: r.mime_type,
        tamanho_bytes: r.tamanho_bytes,
        criado_em: r.criado_em,
        url: r.storage_path, // no mock guarda dataURL ou caminho relativo
      }));
      return { success: true, anexos: visualizacoes };
    }

    // Modo Supabase Conectado
    const supabase = createAdminClient();
    const { data: registros, error } = await supabase
      .from("agendamento_anexos")
      .select("*")
      .eq("agendamento_id", agendamentoId)
      .eq("status", "enviado")
      .order("criado_em", { ascending: true });

    if (error) {
      console.error("Erro ao buscar anexos no Supabase:", error);
      return { success: false, anexos: [], error: "Falha ao carregar imagens anexadas." };
    }

    if (!registros || registros.length === 0) {
      return { success: true, anexos: [] };
    }

    // Gera URL assinada de curta duração para cada imagem protegida
    const visualizacoes: AnexoVisualizacao[] = [];
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
