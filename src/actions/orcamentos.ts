"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { normalizePhone } from "@/lib/formatters";
import { getCurrentUser } from "./auth";
import {
  AgendamentoStatus,
  ModoValoresOrcamento,
  OrcamentoAdmin,
  OrcamentoAdminCompleto,
  OrcamentoAdminResumo,
  PropostaItemDetalhe,
  StatusOrcamentoAdmin,
} from "@/lib/supabase/types";

const TABELA = "orcamentos_admin";
const DURACAO_MIN = 60;

const MSG_SEM_SUPABASE =
  "Os orçamentos do painel só funcionam com o Supabase conectado (variáveis de ambiente configuradas).";
const MSG_MIGRATION =
  "A área de Orçamentos ainda não foi ativada no banco. Rode o arquivo supabase/migrations/013_orcamentos_admin.sql no SQL Editor do Supabase e tente novamente.";
const MSG_HORARIO_OCUPADO =
  "Este horário já está ocupado por outro atendimento na agenda. Escolha outro horário.";

type Resultado<T = object> = ({ success: true } & T) | { success: false; error: string };

// "a_combinar" não é mais uma opção na tela: o orçamento sai "a combinar" sozinho quando não há valor.
// O valor continua aceito aqui só para orçamentos antigos.
const MODOS: ModoValoresOrcamento[] = ["por_item", "total_unico", "a_combinar"];
const STATUS: StatusOrcamentoAdmin[] = ["rascunho", "enviado", "aprovado", "recusado"];

const COLUNAS_RESUMO =
  "id, numero, cliente_id, cliente_nome, cliente_whatsapp, cliente_localidade, modo_valores, valor_total, mostrar_sem_foto, validade_dias, agendamento_id, status, criado_em, atualizado_em";

function erroAmigavel(err: { code?: string; message?: string } | null | undefined): string {
  const code = err?.code || "";
  const msg = err?.message || "";
  if (
    code === "PGRST205" ||
    code === "42P01" ||
    code === "42703" ||
    (/orcamentos_admin|orcamento_admin_id|agendamento_id/.test(msg) && /schema cache|does not exist|column/i.test(msg))
  ) {
    return MSG_MIGRATION;
  }
  if (code === "23P01" || /agendamentos_sem_conflito_horario/.test(msg)) return MSG_HORARIO_OCUPADO;
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
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/clientes");
}

function dinheiro(v: unknown, max = 100_000_000): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Math.min(max, Math.max(0, n)) * 100) / 100;
}

function rotulo(numero: number): string {
  return `ORC-${String(numero).padStart(4, "0")}`;
}

type Supabase = ReturnType<typeof createAdminClient>;

/**
 * O Gilmar só digita nome e telefone. Aqui achamos o cliente pelo telefone (ou criamos),
 * porque a agenda e o financeiro precisam de um cadastro de cliente por trás.
 */
async function resolverCliente(supabase: Supabase, nome: string, whatsappDigitos: string): Promise<{ id?: string; error?: string }> {
  if (whatsappDigitos.length >= 8) {
    const ultimos8 = whatsappDigitos.slice(-8);
    const { data: achado } = await supabase
      .from("clientes")
      .select("id")
      .or(`whatsapp.eq.${whatsappDigitos},whatsapp.ilike.%${ultimos8}%`)
      .limit(1);
    if (achado && achado.length > 0) return { id: achado[0].id as string };
  } else {
    // sem telefone: reaproveita um cliente com exatamente o mesmo nome
    const nomeLike = nome.replace(/[\\%_]/g, (c) => `\\${c}`);
    const { data: achado } = await supabase.from("clientes").select("id").ilike("nome", nomeLike).limit(1);
    if (achado && achado.length > 0) return { id: achado[0].id as string };
  }

  const whatsappFinal =
    whatsappDigitos.length >= 8
      ? normalizePhone(whatsappDigitos)
      : `55329${Math.floor(10000000 + Math.random() * 89999999)}`; // WhatsApp é único: telefone provisório

  const { data: novo, error } = await supabase
    .from("clientes")
    .insert({ nome, whatsapp: whatsappFinal })
    .select("id")
    .single();
  if (error || !novo) {
    // pode ter colidido com um telefone já existente em outro formato: tenta achar de novo
    const { data: tentativa } = await supabase.from("clientes").select("id").eq("whatsapp", whatsappFinal).limit(1);
    if (tentativa && tentativa.length > 0) return { id: tentativa[0].id as string };
    return { error: error?.message || "Não foi possível registrar o cliente." };
  }
  return { id: novo.id as string };
}

async function horarioOcupado(supabase: Supabase, inicioISO: string, fimISO: string, ignorarAgendamentoId?: string | null) {
  let q = supabase
    .from("agendamentos")
    .select("id")
    .neq("status", "cancelado")
    .lt("inicio", fimISO)
    .gt("fim", inicioISO);
  if (ignorarAgendamentoId) q = q.neq("id", ignorarAgendamentoId);
  const { data } = await q.limit(1);
  return !!(data && data.length > 0);
}

/** Lista resumida (sem itens/fotos), já com o horário da agenda de cada orçamento */
export async function listarOrcamentosAdminAction(): Promise<Resultado<{ orcamentos: OrcamentoAdminResumo[] }>> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from(TABELA)
    .select(COLUNAS_RESUMO)
    .order("criado_em", { ascending: false })
    .limit(300);
  if (error) return { success: false, error: erroAmigavel(error) };

  const orcamentos = (data || []) as OrcamentoAdminResumo[];
  const ids = orcamentos.map((o) => o.agendamento_id).filter((x): x is string => !!x);
  if (ids.length > 0) {
    const { data: ags } = await supabase.from("agendamentos").select("id, inicio, status").in("id", ids);
    const mapa = new Map((ags || []).map((a) => [a.id as string, a as { inicio: string; status: AgendamentoStatus }]));
    for (const o of orcamentos) {
      const ag = o.agendamento_id ? mapa.get(o.agendamento_id) : undefined;
      o.agendamento_inicio = ag?.inicio ?? null;
      o.agendamento_status = ag?.status ?? null;
    }
  }
  return { success: true, orcamentos };
}

/** Orçamento completo (com itens, fotos e horário da agenda) para abrir no editor */
export async function obterOrcamentoAdminAction(id: string): Promise<Resultado<{ orcamento: OrcamentoAdminCompleto }>> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const supabase = createAdminClient();
  const { data, error } = await supabase.from(TABELA).select("*").eq("id", id).maybeSingle();
  if (error) return { success: false, error: erroAmigavel(error) };
  if (!data) return { success: false, error: "Orçamento não encontrado." };

  const base = data as OrcamentoAdmin;
  let agendamento: OrcamentoAdminCompleto["agendamento"] = null;
  if (base.agendamento_id) {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, inicio, status")
      .eq("id", base.agendamento_id)
      .maybeSingle();
    if (ag) agendamento = ag as OrcamentoAdminCompleto["agendamento"];
  }
  return { success: true, orcamento: { ...base, agendamento } };
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
  clienteNome: string;
  clienteWhatsapp?: string;
  clienteLocalidade?: string;
  subtitulo?: string;
  objetivo?: string;
  condicoesPagamento?: string;
  observacoes?: string;
  /** "por_item" (preço em cada serviço) ou "total_unico" (um valor só no final) */
  modoValores: ModoValoresOrcamento;
  /** valor final: em "total_unico" é o valor do orçamento; em "por_item" é um ajuste opcional da soma */
  valorTotal?: number | null;
  mostrarSemFoto?: boolean;
  validadeDias?: number;
  /** dia e hora do atendimento na agenda */
  data: string; // YYYY-MM-DD
  hora: string; // HH:MM
  itens: OrcamentoAdminItemEntrada[];
}

/**
 * Cria ou atualiza um orçamento do admin:
 *  - acha/cria o cliente pelo telefone;
 *  - reserva (ou move) o horário na agenda;
 *  - o valor do orçamento vai para o agendamento, que alimenta o Financeiro.
 */
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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(entrada.data || "") || !/^\d{2}:\d{2}$/.test(entrada.hora || "")) {
    return { success: false, error: "Escolha o dia e o horário do atendimento." };
  }
  const inicio = new Date(`${entrada.data}T${entrada.hora}:00-03:00`);
  if (Number.isNaN(inicio.getTime())) return { success: false, error: "Dia ou horário inválido." };
  const fim = new Date(inicio.getTime() + DURACAO_MIN * 60000);

  const supabase = createAdminClient();

  // Dados já salvos (fotos a manter e agendamento ligado)
  let existentes: PropostaItemDetalhe[] = [];
  let agendamentoAtualId: string | null = null;
  if (entrada.id) {
    const { data: atual, error } = await supabase
      .from(TABELA)
      .select("itens, agendamento_id")
      .eq("id", entrada.id)
      .maybeSingle();
    if (error) return { success: false, error: erroAmigavel(error) };
    if (!atual) return { success: false, error: "Orçamento não encontrado." };
    existentes = (atual.itens || []) as PropostaItemDetalhe[];
    agendamentoAtualId = (atual.agendamento_id as string | null) ?? null;
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

  // Valor do orçamento: o digitado (ou a soma dos itens); sem valor => "a combinar" (null)
  const soma = Math.round(itens.reduce((a, i) => a + i.valorTotal, 0) * 100) / 100;
  const digitado =
    entrada.valorTotal != null && Number.isFinite(Number(entrada.valorTotal)) ? dinheiro(entrada.valorTotal) : null;
  let valorFinal: number | null;
  if (entrada.modoValores === "por_item") valorFinal = digitado != null && digitado > 0 ? digitado : soma;
  else if (entrada.modoValores === "total_unico") valorFinal = digitado;
  else valorFinal = null;
  const valorTotal = valorFinal != null && valorFinal > 0 ? valorFinal : null;
  const modo: ModoValoresOrcamento = entrada.modoValores === "a_combinar" ? "total_unico" : entrada.modoValores;

  // Horário livre? (ignora o próprio agendamento deste orçamento)
  if (await horarioOcupado(supabase, inicio.toISOString(), fim.toISOString(), agendamentoAtualId)) {
    return { success: false, error: MSG_HORARIO_OCUPADO };
  }

  // Cliente (nome + telefone)
  const cliente = await resolverCliente(supabase, nome, (entrada.clienteWhatsapp || "").replace(/\D/g, ""));
  if (!cliente.id) return { success: false, error: cliente.error || "Não foi possível registrar o cliente." };

  const campos = {
    cliente_id: cliente.id,
    cliente_nome: nome,
    cliente_whatsapp: limpar((entrada.clienteWhatsapp || "").replace(/\D/g, ""), 20) || null,
    cliente_localidade: limpar(entrada.clienteLocalidade, 200) || null,
    subtitulo: limpar(entrada.subtitulo, 300) || null,
    objetivo: limpar(entrada.objetivo, 2000) || null,
    condicoes_pagamento: limpar(entrada.condicoesPagamento, 1000) || null,
    observacoes: limpar(entrada.observacoes, 1000) || null,
    modo_valores: modo,
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
  const orcamento = data as OrcamentoAdminResumo;

  // ---- Agenda + Financeiro: o agendamento carrega o valor do orçamento
  const valorAgenda = valorTotal ?? 0;
  const observacao = [`Orçamento ${rotulo(orcamento.numero)} (painel)`, campos.observacoes].filter(Boolean).join(" — ");

  let agendamentoAtual: { id: string; status: AgendamentoStatus } | null = null;
  if (agendamentoAtualId) {
    const { data: ag } = await supabase.from("agendamentos").select("id, status").eq("id", agendamentoAtualId).maybeSingle();
    if (ag) agendamentoAtual = ag as { id: string; status: AgendamentoStatus };
  }

  let falhaAgenda: string | null = null;
  if (agendamentoAtual && (agendamentoAtual.status === "agendado" || agendamentoAtual.status === "confirmado")) {
    const { error: e } = await supabase
      .from("agendamentos")
      .update({
        cliente_id: cliente.id,
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
        valor_total: valorAgenda,
        observacao,
        orcamento_admin_id: orcamento.id,
      })
      .eq("id", agendamentoAtual.id);
    if (e) falhaAgenda = erroAmigavel(e);
  } else if (agendamentoAtual) {
    // concluído / não compareceu: não mexe em horário nem valor (já virou financeiro)
  } else {
    // sem agendamento ainda (ou o anterior foi cancelado/apagado): reserva um novo
    const { data: novo, error: e } = await supabase
      .from("agendamentos")
      .insert({
        cliente_id: cliente.id,
        inicio: inicio.toISOString(),
        fim: fim.toISOString(),
        status: "confirmado",
        origem: "admin",
        valor_total: valorAgenda,
        desconto: 0,
        observacao,
        orcamento_admin_id: orcamento.id,
      })
      .select("id")
      .single();
    if (e || !novo) falhaAgenda = erroAmigavel(e);
    else {
      await supabase.from(TABELA).update({ agendamento_id: novo.id }).eq("id", orcamento.id);
      orcamento.agendamento_id = novo.id as string;
    }
  }

  if (falhaAgenda) {
    // orçamento novo sem agenda não deve ficar "pela metade": desfaz
    if (!entrada.id) await supabase.from(TABELA).delete().eq("id", orcamento.id);
    return { success: false, error: falhaAgenda };
  }

  orcamento.agendamento_inicio = inicio.toISOString();
  orcamento.agendamento_status = agendamentoAtual?.status ?? "confirmado";
  revalidar();
  return { success: true, orcamento };
}

/**
 * Muda o status do orçamento. "Recusado" libera o horário da agenda (cancela sem multa);
 * sair de "Recusado" tenta reocupar o horário.
 */
export async function alterarStatusOrcamentoAdminAction(id: string, status: StatusOrcamentoAdmin): Promise<Resultado> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };
  if (!STATUS.includes(status)) return { success: false, error: "Status inválido." };

  const supabase = createAdminClient();
  const { data: orc, error: eOrc } = await supabase.from(TABELA).select("agendamento_id").eq("id", id).maybeSingle();
  if (eOrc) return { success: false, error: erroAmigavel(eOrc) };
  if (!orc) return { success: false, error: "Orçamento não encontrado." };

  if (orc.agendamento_id) {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, status, inicio, fim")
      .eq("id", orc.agendamento_id as string)
      .maybeSingle();

    if (ag) {
      if (status === "recusado" && (ag.status === "agendado" || ag.status === "confirmado")) {
        await supabase
          .from("agendamentos")
          .update({
            status: "cancelado",
            cancelado_em: new Date().toISOString(),
            cancelado_por: "admin",
            motivo_cancelamento: "Orçamento recusado",
          })
          .eq("id", ag.id);
      } else if (status !== "recusado" && ag.status === "cancelado") {
        if (await horarioOcupado(supabase, ag.inicio as string, ag.fim as string, ag.id as string)) {
          return {
            success: false,
            error: "O horário deste orçamento foi ocupado por outro atendimento. Abra o orçamento e escolha um novo horário.",
          };
        }
        const { error: eReativar } = await supabase
          .from("agendamentos")
          .update({ status: "confirmado", cancelado_em: null, cancelado_por: null, motivo_cancelamento: null })
          .eq("id", ag.id);
        if (eReativar) return { success: false, error: erroAmigavel(eReativar) };
      } else if (status === "aprovado" && ag.status === "agendado") {
        await supabase.from("agendamentos").update({ status: "confirmado" }).eq("id", ag.id);
      }
    }
  }

  const { error } = await supabase
    .from(TABELA)
    .update({ status, atualizado_em: new Date().toISOString() })
    .eq("id", id);
  if (error) return { success: false, error: erroAmigavel(error) };
  revalidar();
  return { success: true };
}

/** Exclui o orçamento e libera o horário da agenda (se o atendimento ainda não foi concluído). */
export async function excluirOrcamentoAdminAction(id: string): Promise<Resultado> {
  const negado = await exigirAdmin();
  if (negado) return { success: false, error: negado };

  const supabase = createAdminClient();
  const { data: orc } = await supabase.from(TABELA).select("agendamento_id").eq("id", id).maybeSingle();

  if (orc?.agendamento_id) {
    const { data: ag } = await supabase
      .from("agendamentos")
      .select("id, status")
      .eq("id", orc.agendamento_id as string)
      .maybeSingle();
    // só apaga o agendamento se ainda não gerou financeiro/multa (concluído e não compareceu ficam)
    if (ag && (ag.status === "agendado" || ag.status === "confirmado" || ag.status === "cancelado")) {
      await supabase.from("agendamentos").delete().eq("id", ag.id);
    }
  }

  const { error } = await supabase.from(TABELA).delete().eq("id", id);
  if (error) return { success: false, error: erroAmigavel(error) };
  revalidar();
  return { success: true };
}
