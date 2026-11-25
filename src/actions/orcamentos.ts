"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCurrentUser } from "./auth";
import {
  ModoValoresOrcamento,
  OrcamentoAdmin,
  OrcamentoAdminResumo,
  PropostaItemDetalhe,
  StatusOrcamentoAdmin,
} from "@/lib/supabase/types";

const TABELA = "orcamentos_admin";

const MSG_SEM_SUPABASE =
  "Os orçamentos do painel só funcionam com o Supabase conectado (variáveis de ambiente configuradas).";
const MSG_MIGRATION =
  "A área de Orçamentos ainda não foi ativada no banco. Rode o arquivo supabase/migrations/013_orcamentos_admin.sql no SQL Editor do Supabase e tente novamente.";

type Resultado<T = object> = ({ success: true } & T) | { success: false; error: string };

const MODOS: ModoValoresOrcamento[] = ["por_item", "total_unico", "a_combinar"];
const STATUS: StatusOrcamentoAdmin[] = ["rascunho", "enviado", "aprovado", "recusado"];

const COLUNAS_RESUMO =
  "id, numero, cliente_id, cliente_nome, cliente_whatsapp, cliente_localidade, modo_valores, valor_total, mostrar_sem_foto, validade_dias, status, criado_em, atualizado_em";

function erroAmigavel(err: { code?: string; message?: string } | null | undefined): string {
  const code = err?.code || "";
  const msg = err?.message || "";
  if (code === "PGRST205" || code === "42P01" || (/orcamentos_admin/.test(msg) && /schema cache|does not exist/i.test(msg))) {
    return MSG_MIGRATION;
  }
  return msg || "Erro ao acessar os orçamentos.";
}

async function exigirAdmin(): Promise<string | null> {
  const user = await getCurrentUser();
  if (user?.role !== "admin") return "Sessão expirada. Entre novamente no painel.";
  if (!isSupabaseConfigured()) return MSG_SEM_SUPABASE;
  return null;
}

function limpar(v: unknown, max: number): string {
  return String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

/** Tamanho máximo (em caracteres do data URL) de uma foto de item */
const FOTO_ITEM_MAX_CHARS = 700_000;

function fotoValida(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const u = v.trim();
  if (u.length === 0 || u.length > FOTO_ITEM_MAX_CHARS) return null;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(u) ? u : null;
}

function revalidar() {
  revalidatePath("/admin/orcamentos");
}

function dinheiro(v: unknown, max = 100_000_000): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(0, n)) * 100) / 100;
}

/** Lista resumida (sem itens/fotos) */
export async function listarOrcamentosAdminAction(): Promise<Resultado<{ orcamentos: OrcamentoAdminResumo[] }>> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const { data, error } = await createAdminClient()
    .from(TABELA)
    .select(COLUNAS_RESUMO)
    .order("criado_em", { ascending: false })
    .limit(300);
  if (error) return { success: false, error: erroAmigavel(error) };
  return { success: true, orcamentos: (data || []) as OrcamentoAdminResumo[] };
}

/** Orçamento completo (com itens e fotos) para abrir no editor */
export async function obterOrcamentoAdminAction(id: string): Promise<Resultado<{ orcamento: OrcamentoAdmin }>> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const { data, error } = await createAdminClient().from(TABELA).select("*").eq("id", id).maybeSingle();
  if (error) return { success: false, error: erroAmigavel(error) };
  if (!data) return { success: false, error: "Orçamento não encontrado." };
  return { success: true, orcamento: data as OrcamentoAdmin };
}

/** Clientes cadastrados, para escolher no orçamento */
export async function listarClientesParaOrcamentoAction(): Promise<
  Resultado<{ clientes: { id: string; nome: string; whatsapp: string }[] }>
> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const { data, error } = await createAdminClient()
    .from("clientes")
    .select("id, nome, whatsapp")
    .order("nome", { ascending: true })
    .limit(1000);
  if (error) return { success: false, error: error.message };
  return { success: true, clientes: (data || []) as { id: string; nome: string; whatsapp: string }[] };
}

export interface OrcamentoAdminItemEntrada {
  identificacao: string;
  servicoNome: string;
  escopo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  icone?: string;
  /** índice do item salvo cuja foto deve ser mantida (null = sem foto) */
  fotoDe?: number | null;
  /** foto nova (JPEG/PNG/WebP comprimido, data URL); tem prioridade sobre `fotoDe` */
  fotoNova?: string | null;
}

export interface OrcamentoAdminEntrada {
  id?: string;
  clienteId?: string | null;
  clienteNome: string;
  clienteWhatsapp?: string;
  clienteLocalidade?: string;
  subtitulo?: string;
  objetivo?: string;
  condicoesPagamento?: string;
  observacoes?: string;
  modoValores: ModoValoresOrcamento;
  /** valor final: obrigatório em "total_unico"; opcional em "por_item" (ajuste); ignorado em "a_combinar" */
  valorTotal?: number | null;
  mostrarSemFoto?: boolean;
  validadeDias?: number;
  itens: OrcamentoAdminItemEntrada[];
}

/** Cria ou atualiza um orçamento do admin. O total é sempre conferido no servidor. */
export async function salvarOrcamentoAdminAction(
  entrada: OrcamentoAdminEntrada
): Promise<Resultado<{ orcamento: OrcamentoAdminResumo }>> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const nome = limpar(entrada.clienteNome, 160);
  if (nome.length < 2) return { success: false, error: "Informe o nome do cliente." };
  if (!MODOS.includes(entrada.modoValores)) return { success: false, error: "Modo de valores inválido." };
  if (!Array.isArray(entrada.itens) || entrada.itens.length === 0) {
    return { success: false, error: "Adicione pelo menos 1 serviço ao orçamento." };
  }
  if (entrada.itens.length > 40) return { success: false, error: "Máximo de 40 itens por orçamento." };

  const supabase = createAdminClient();

  // Fotos já salvas (para manter por índice sem reenviar)
  let existentes: PropostaItemDetalhe[] = [];
  if (entrada.id) {
    const { data: atual, error } = await supabase.from(TABELA).select("itens").eq("id", entrada.id).maybeSingle();
    if (error) return { success: false, error: erroAmigavel(error) };
    if (!atual) return { success: false, error: "Orçamento não encontrado." };
    existentes = (atual.itens || []) as PropostaItemDetalhe[];
  }

  if (entrada.itens.some((it) => !!it.fotoNova && !fotoValida(it.fotoNova))) {
    return { success: false, error: "Uma das fotos é inválida ou muito grande. Escolha outra foto." };
  }

  const itens: PropostaItemDetalhe[] = entrada.itens.map((it, idx) => {
    const quantidade = Math.min(999, Math.max(1, Math.floor(Number(it.quantidade) || 1)));
    const comPreco = entrada.modoValores === "por_item";
    const valorUnitario = comPreco ? dinheiro(it.valorUnitario, 10_000_000) : 0;
    const mantida = it.fotoDe != null ? existentes[it.fotoDe]?.fotoUrl ?? null : null;
    return {
      numero: String(idx + 1).padStart(2, "0"),
      identificacao: limpar(it.identificacao, 120) || `Item ${String(idx + 1).padStart(2, "0")}`,
      servicoNome: limpar(it.servicoNome, 200) || "Serviço elétrico",
      escopo: limpar(it.escopo, 1000),
      descricao: limpar(it.descricao, 2000),
      quantidade,
      valorUnitario,
      valorTotal: Math.round(quantidade * valorUnitario * 100) / 100,
      fotoUrl: fotoValida(it.fotoNova) ?? mantida,
      icone: it.icone ? limpar(it.icone, 40) : undefined,
    };
  });

  const soma = Math.round(itens.reduce((a, i) => a + i.valorTotal, 0) * 100) / 100;
  let valorTotal: number | null;
  if (entrada.modoValores === "a_combinar") {
    valorTotal = null;
  } else if (entrada.modoValores === "total_unico") {
    if (entrada.valorTotal == null || !Number.isFinite(Number(entrada.valorTotal))) {
      return { success: false, error: "Informe o valor final do orçamento." };
    }
    valorTotal = dinheiro(entrada.valorTotal);
  } else {
    // por item: usa o ajuste informado; se não houver, a soma dos itens
    valorTotal =
      entrada.valorTotal != null && Number.isFinite(Number(entrada.valorTotal)) ? dinheiro(entrada.valorTotal) : soma;
  }

  const campos = {
    cliente_id: entrada.clienteId || null,
    cliente_nome: nome,
    cliente_whatsapp: limpar((entrada.clienteWhatsapp || "").replace(/\D/g, ""), 20) || null,
    cliente_localidade: limpar(entrada.clienteLocalidade, 200) || null,
    subtitulo: limpar(entrada.subtitulo, 300) || null,
    objetivo: limpar(entrada.objetivo, 2000) || null,
    condicoes_pagamento: limpar(entrada.condicoesPagamento, 1000) || null,
    observacoes: limpar(entrada.observacoes, 1000) || null,
    modo_valores: entrada.modoValores,
    valor_total: valorTotal,
    mostrar_sem_foto: !!entrada.mostrarSemFoto,
    validade_dias: Math.min(365, Math.max(1, Math.floor(Number(entrada.validadeDias) || 10))),
    itens,
    atualizado_em: new Date().toISOString(),
  };

  const consulta = entrada.id
    ? supabase.from(TABELA).update(campos).eq("id", entrada.id).select(COLUNAS_RESUMO).single()
    : supabase.from(TABELA).insert(campos).select(COLUNAS_RESUMO).single();
  const { data, error } = await consulta;
  if (error || !data) return { success: false, error: erroAmigavel(error) };

  revalidar();
  return { success: true, orcamento: data as OrcamentoAdminResumo };
}

export async function alterarStatusOrcamentoAdminAction(id: string, status: StatusOrcamentoAdmin): Promise<Resultado> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };
  if (!STATUS.includes(status)) return { success: false, error: "Status inválido." };

  const { error } = await createAdminClient()
    .from(TABELA)
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: erroAmigavel(error) };
  revalidar();
  return { success: true };
}

export async function excluirOrcamentoAdminAction(id: string): Promise<Resultado> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const { error } = await createAdminClient().from(TABELA).delete().eq("id", id);
  if (error) return { success: false, error: erroAmigavel(error) };
  revalidar();
  return { success: true };
}
