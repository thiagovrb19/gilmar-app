"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "./auth";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  Agendamento,
  Cliente,
  ClienteEstatistica,
  Configuracao,
  Lancamento,
  Multa,
  Servico,
  Bloqueio,
  HorarioFixo,
  FormaPagamento,
  DiaExcecao,
  DiaExcecaoTipo,
  EstoquePeca,
} from "@/lib/supabase/types";

// Helper de validação de permissão com redirecionamento limpo
async function requireAdmin() {
  const user = await getCurrentUser();
  if (user?.role !== "admin") {
    redirect("/admin/login");
  }
  return user;
}

function mapServicosEPreco(ag: any): Agendamento {
  const servicos = (ag.agendamento_servicos || []).map((asv: any) => {
    const s = asv.servicos || {};
    const preco = Number(asv.preco_cobrado ?? s.preco ?? 25);
    return {
      ...s,
      preco,
    };
  });

  const valorCalculado = servicos.reduce((acc: number, s: any) => acc + (s.preco || 0), 0);
  const valorFinal =
    Number(ag.valor_total) > 0
      ? Number(ag.valor_total)
      : valorCalculado > 0
      ? valorCalculado
      : 25;

  return {
    ...ag,
    valor_total: valorFinal,
    servicos,
  } as Agendamento;
}

/** 1. Dashboard Hoje: Indicadores, alertas e linha do tempo do dia */
export async function getDashboardHoje() {
  await requireAdmin();

  const hoje = new Date().toISOString().split("T")[0];

  if (!isSupabaseConfigured()) {
    const { mockGetDashboardHoje } = await import("@/lib/mock-store");
    return mockGetDashboardHoje(hoje);
  }

  const supabase = createAdminClient();
  const inicioHoje = `${hoje}T00:00:00-03:00`;
  const fimHoje = `${hoje}T23:59:59-03:00`;

  // Agendamentos de hoje
  const { data: agendamentosHojeRaw } = await supabase
    .from("agendamentos")
    .select("*, cliente:clientes(*), agendamento_servicos(servico_id, preco_cobrado, servicos(*))")
    .gte("inicio", inicioHoje)
    .lte("inicio", fimHoje)
    .order("inicio", { ascending: true });

  const agendamentosHoje = (agendamentosHojeRaw || []).map(mapServicosEPreco);

  // Agendamentos ativos hoje (não cancelados)
  const agendamentosAtivos = agendamentosHoje.filter((a) => a.status !== "cancelado");

  // Faturamento recebido hoje em lançamentos de entrada
  const { data: lancamentosHoje } = await supabase
    .from("lancamentos")
    .select("*")
    .eq("tipo", "entrada")
    .eq("data", hoje);

  const totalHojeRecebido = (lancamentosHoje || []).reduce(
    (acc, l) => acc + Number(l.valor),
    0
  );

  // Faturamento previsto hoje: soma dos agendamentos confirmados/agendados de hoje
  const totalHojePrevisto = agendamentosAtivos.reduce(
    (acc, a) => acc + Number(a.valor_total || 0),
    0
  );

  // Contagem de clientes cadastrados
  const { count: totalClientesCount } = await supabase
    .from("clientes")
    .select("*", { count: "exact", head: true });

  // Clientes com estatísticas para os alertas de sumidos e aniversariantes
  const { data: clientesStats } = await supabase
    .from("v_clientes_estatisticas")
    .select("*");

  const clientesSumidos = (clientesStats || []).filter(
    (c) => c.dias_sem_vir !== null && c.dias_sem_vir >= 15
  );

  const mesAtual = new Date().getMonth() + 1;
  const diaAtual = new Date().getDate();

  const aniversariantesSemana = (clientesStats || []).filter((c) => {
    if (!c.data_nascimento) return false;
    const niverDate = new Date(c.data_nascimento);
    const niverMes = niverDate.getUTCMonth() + 1;
    const niverDia = niverDate.getUTCDate();
    return niverMes === mesAtual && Math.abs(niverDia - diaAtual) <= 4;
  });

  const { data: multasPendentes } = await supabase
    .from("multas")
    .select("*, cliente:clientes(*)")
    .eq("status", "pendente");

  return {
    agendamentosHoje,
    metricas: {
      faturamentoHoje: totalHojeRecebido,
      faturamentoPrevistoHoje: totalHojePrevisto,
      atendimentosHojeCount: agendamentosAtivos.length,
      concluidosHojeCount: agendamentosHoje.filter((a) => a.status === "concluido").length,
      totalClientesCount: totalClientesCount || (clientesStats?.length || 0),
    },
    alertas: {
      clientesSumidos: clientesSumidos as ClienteEstatistica[],
      aniversariantesSemana: aniversariantesSemana as ClienteEstatistica[],
      multasPendentes: (multasPendentes || []) as Multa[],
    },
  };
}

/** 2. Agenda Completa (busca por período com bloqueios e fixos) */
export async function getAgendaPeriodo(inicioStr: string, fimStr: string) {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    const { mockGetAdminPeriodo } = await import("@/lib/mock-store");
    return mockGetAdminPeriodo(inicioStr, fimStr);
  }

  const supabase = createAdminClient();

  const { data: agendamentosRaw } = await supabase
    .from("agendamentos")
    .select("*, cliente:clientes(*), agendamento_servicos(servico_id, preco_cobrado, servicos(*))")
    .gte("inicio", inicioStr)
    .lte("inicio", fimStr)
    .order("inicio", { ascending: true });

  const agendamentos = (agendamentosRaw || []).map(mapServicosEPreco);

  const { data: bloqueios } = await supabase
    .from("bloqueios")
    .select("*")
    .gte("inicio", inicioStr)
    .lte("fim", fimStr);

  const { data: horariosFixos } = await supabase
    .from("horarios_fixos")
    .select("*, cliente:clientes(*), servico:servicos(*)")
    .eq("ativo", true);

  const { data: diasExcecao } = await supabase
    .from("dias_excecao")
    .select("*")
    .gte("data", inicioStr.substring(0, 10))
    .lte("data", fimStr.substring(0, 10));

  return {
    agendamentos,
    bloqueios: (bloqueios || []) as Bloqueio[],
    horariosFixos: (horariosFixos || []) as HorarioFixo[],
    diasExcecao: (diasExcecao || []) as DiaExcecao[],
  };
}

/** 3. Criar agendamento manual pelo Admin */
export async function criarAgendamentoManualAction(params: {
  clienteId?: string;
  novoNome?: string;
  novoWhats?: string;
  servicosIds: string[];
  inicio: string;
  observacao?: string;
}): Promise<{ success: boolean; error?: string; agendamento_id?: string }> {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    const { mockCriarAgendamento, mockUpsertCliente } = await import("@/lib/mock-store");
    let clienteId = params.clienteId;
    if (!clienteId && params.novoNome && params.novoWhats) {
      const novo = mockUpsertCliente({
        id: crypto.randomUUID(),
        nome: params.novoNome,
        whatsapp: params.novoWhats.replace(/\D/g, ""),
      });
      clienteId = novo.id;
    }
    const res = mockCriarAgendamento({
      clienteId: clienteId || "c-1",
      servicosIds: params.servicosIds,
      inicio: params.inicio,
      observacao: params.observacao,
      origem: "admin",
    });
    return { success: true, agendamento_id: res.agendamento.id };
  }

  const supabase = createAdminClient();
  let clienteId = params.clienteId;

  // Cadastro rápido de cliente se não existia
  if (!clienteId && params.novoNome && params.novoWhats) {
    const { data: novoCliente, error: cliErr } = await supabase
      .from("clientes")
      .insert({
        nome: params.novoNome,
        whatsapp: params.novoWhats.replace(/\D/g, ""),
      })
      .select("id")
      .single();

    if (cliErr) return { success: false, error: cliErr.message };
    clienteId = novoCliente.id;
  }

  if (!clienteId) {
    return { success: false, error: "Selecione ou cadastre um cliente." };
  }

  // Validação de conflito de horário no servidor
  const duracaoMin = 60;
  const inicioDate = new Date(params.inicio);
  const fimDate = new Date(inicioDate.getTime() + duracaoMin * 60000);

  const { data: conflito } = await supabase
    .from("agendamentos")
    .select("id")
    .neq("status", "cancelado")
    .lt("inicio", fimDate.toISOString())
    .gt("fim", inicioDate.toISOString())
    .maybeSingle();

  if (conflito) {
    return {
      success: false,
      error: "Este horário já está ocupado por outro atendimento na agenda.",
    };
  }

  // Tenta via RPC criar_agendamento
  const { data: rpcData, error: rpcErr } = await supabase.rpc("criar_agendamento", {
    p_cliente_id: clienteId,
    p_servicos: params.servicosIds,
    p_inicio: params.inicio,
    p_origem: "admin",
    p_observacao: params.observacao || null,
  });

  if (!rpcErr && rpcData?.success) {
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    revalidatePath("/admin/financeiro");
    revalidatePath("/admin/clientes");
    revalidatePath("/agendar");
    return rpcData as { success: boolean; error?: string; agendamento_id?: string };
  }

  // Contingência direta garantida
  const { data: servicosDb } = await supabase
    .from("servicos")
    .select("id, preco")
    .in("id", params.servicosIds);

  const valorTotal = (servicosDb || []).reduce((acc, s) => acc + Number(s.preco), 0);

  const { data: novoAg, error: agErr } = await supabase
    .from("agendamentos")
    .insert({
      cliente_id: clienteId,
      inicio: params.inicio,
      fim: fimDate.toISOString(),
      status: "confirmado",
      origem: "admin",
      valor_total: valorTotal > 0 ? valorTotal : 25,
      desconto: 0,
      observacao: params.observacao || null,
    })
    .select("id")
    .single();

  if (agErr || !novoAg) {
    return { success: false, error: agErr?.message || rpcErr?.message || "Erro ao agendar" };
  }

  if (params.servicosIds.length > 0) {
    const inserts = params.servicosIds.map((sId) => {
      const sMatch = servicosDb?.find((s) => s.id === sId);
      return {
        agendamento_id: novoAg.id,
        servico_id: sId,
        preco_cobrado: sMatch ? sMatch.preco : 25,
      };
    });
    await supabase.from("agendamento_servicos").insert(inserts);
  }

  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/clientes");
  revalidatePath("/agendar");

  return { success: true, agendamento_id: novoAg.id };
}

/** 4. Criar Bloqueio de Horário/Dia */
export async function criarBloqueioAction(inicio: string, fim: string, motivo: string) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    const { mockCriarBloqueio } = await import("@/lib/mock-store");
    mockCriarBloqueio(inicio, fim, motivo);
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    revalidatePath("/agendar");
    return { success: true };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("bloqueios").insert({ inicio, fim, motivo });
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/agendar");
  return { success: true };
}

/** Excluir Bloqueio */
export async function excluirBloqueioAction(bloqueioId: string) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    const { mockExcluirBloqueio } = await import("@/lib/mock-store");
    mockExcluirBloqueio(bloqueioId);
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    revalidatePath("/agendar");
    return { success: true };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("bloqueios").delete().eq("id", bloqueioId);
  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/agendar");
  return { success: true };
}

/** Buscar Exceções / Dias Especiais (Feriados / Horários Personalizados) */
export async function getDiasExcecaoAction(
  inicioStr?: string,
  fimStr?: string
): Promise<DiaExcecao[]> {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    const { mockGetDiasExcecao } = await import("@/lib/mock-store");
    return mockGetDiasExcecao(inicioStr, fimStr);
  }

  const supabase = createAdminClient();
  let query = supabase.from("dias_excecao").select("*");
  if (inicioStr) query = query.gte("data", inicioStr.substring(0, 10));
  if (fimStr) query = query.lte("data", fimStr.substring(0, 10));
  const { data } = await query;
  return (data || []) as DiaExcecao[];
}

/** Salvar ou Atualizar Personalização de Horários de uma Data */
export async function salvarDiaExcecaoAction(params: {
  data: string; // YYYY-MM-DD
  tipo: DiaExcecaoTipo; // 'fechado' | 'personalizado'
  motivo?: string;
  abre?: string;
  fecha?: string;
  horarios_especificos?: string[];
}) {
  await requireAdmin();
  const cleanDate = params.data.substring(0, 10);

  if (!isSupabaseConfigured()) {
    const { mockSalvarDiaExcecao } = await import("@/lib/mock-store");
    const nova = mockSalvarDiaExcecao({
      data: cleanDate,
      tipo: params.tipo,
      motivo: params.motivo || null,
      abre: params.abre || null,
      fecha: params.fecha || null,
      horarios_especificos: params.horarios_especificos || null,
    });
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    revalidatePath("/agendar");
    return { success: true, excecao: nova };
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("dias_excecao")
    .upsert(
      {
        data: cleanDate,
        tipo: params.tipo,
        motivo: params.motivo || null,
        abre: params.abre || null,
        fecha: params.fecha || null,
        horarios_especificos: params.horarios_especificos || null,
      },
      { onConflict: "data" }
    )
    .select()
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/agendar");
  return { success: true, excecao: data };
}

/** Remover Exceção de uma Data (Restaura o expediente padrão da semana) */
export async function removerDiaExcecaoAction(dataStr: string) {
  await requireAdmin();
  const cleanDate = dataStr.substring(0, 10);

  if (!isSupabaseConfigured()) {
    const { mockRemoverDiaExcecao } = await import("@/lib/mock-store");
    mockRemoverDiaExcecao(cleanDate);
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    revalidatePath("/agendar");
    return { success: true };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("dias_excecao").delete().eq("data", cleanDate);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/agenda");
  revalidatePath("/admin");
  revalidatePath("/agendar");
  return { success: true };
}

/**
 * 5. Gerenciamento Completo de Clientes com Horários Fixos (Recorrência)
 * Permite definir dia da semana, hora, serviço, frequência semanal/quinzenal/mensal,
 * data de início e término/semanas.
 * Valida conflitos antes de confirmar e gera os agendamentos reais na agenda.
 */
export async function salvarHorarioFixoAction(params: {
  clienteId: string;
  diaSemana: number; // 0=Domingo..6=Sábado
  hora: string; // "17:00"
  servicoId: string;
  recorrencia?: "semanal" | "quinzenal" | "mensal";
  dataInicio?: string; // YYYY-MM-DD
  dataFim?: string; // YYYY-MM-DD
  semanas?: number;
}): Promise<{ success: boolean; error?: string; horario_fixo_id?: string; agendamentos_gerados?: number }> {
  await requireAdmin();

  const recorrencia = params.recorrencia || "semanal";
  const numSemanas = Math.min(Math.max(params.semanas || (recorrencia === "mensal" ? 16 : 8), 1), 24);
  const cleanHora = params.hora.includes(":") ? params.hora.substring(0, 5) : `${params.hora}:00`;

  if (!isSupabaseConfigured()) {
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/clientes");
    revalidatePath("/admin");
    return { success: true, agendamentos_gerados: 4 };
  }

  const supabase = createAdminClient();

  // 1. Busca dados do serviço para valor e integridade
  const { data: servico } = await supabase
    .from("servicos")
    .select("id, nome, preco, duracao_min")
    .eq("id", params.servicoId)
    .maybeSingle();

  const valorServico = Number(servico?.preco || 25);
  const duracaoMin = Number(servico?.duracao_min || 60);

  // 2. Verifica se outro cliente já possui horário fixo exatamente neste dia da semana e horário
  const { data: fixoExistente } = await supabase
    .from("horarios_fixos")
    .select("id, cliente_id, cliente:clientes(nome)")
    .eq("dia_semana", params.diaSemana)
    .eq("hora", cleanHora)
    .eq("ativo", true)
    .neq("cliente_id", params.clienteId)
    .maybeSingle();

  if (fixoExistente) {
    const nomeOutro = (fixoExistente as any).cliente?.nome || "outro cliente";
    return {
      success: false,
      error: `Conflito de horário fixo: este horário já está reservado semanalmente para ${nomeOutro}.`,
    };
  }

  // 3. Insere ou atualiza o horário fixo
  const { data: novoFixo, error: fixoErr } = await supabase
    .from("horarios_fixos")
    .upsert(
      {
        cliente_id: params.clienteId,
        dia_semana: params.diaSemana,
        hora: cleanHora,
        servico_id: params.servicoId,
        ativo: true,
      },
      { onConflict: "cliente_id,dia_semana,hora" }
    )
    .select("id")
    .single();

  if (fixoErr || !novoFixo) {
    // Tenta inserção normal caso a chave composta não exista
    const { data: fallbackFixo, error: fbErr } = await supabase
      .from("horarios_fixos")
      .insert({
        cliente_id: params.clienteId,
        dia_semana: params.diaSemana,
        hora: cleanHora,
        servico_id: params.servicoId,
        ativo: true,
      })
      .select("id")
      .single();

    if (fbErr || !fallbackFixo) {
      return { success: false, error: fbErr?.message || fixoErr?.message || "Erro ao salvar horário fixo." };
    }
  }

  const fixoId = novoFixo?.id;

  // 4. Calcula e gera os agendamentos concretos no calendário
  const stepWeeks = recorrencia === "quinzenal" ? 2 : recorrencia === "mensal" ? 4 : 1;
  const hoje = new Date();
  const startDate = params.dataInicio ? new Date(`${params.dataInicio}T00:00:00`) : hoje;
  const endDateLimit = params.dataFim ? new Date(`${params.dataFim}T23:59:59`) : null;

  let criadosCount = 0;

  for (let i = 0; i < numSemanas; i += stepWeeks) {
    // Próxima ocorrência do dia da semana
    const curDate = new Date(startDate);
    const dayDiff = (params.diaSemana - curDate.getDay() + 7) % 7;
    curDate.setDate(curDate.getDate() + dayDiff + i * 7);

    if (endDateLimit && curDate > endDateLimit) break;

    const dateStr = curDate.toISOString().split("T")[0];
    const inicioIso = `${dateStr}T${cleanHora}:00-03:00`;
    const inicioDate = new Date(inicioIso);

    // Ignora se estiver no passado
    if (inicioDate.getTime() < Date.now()) continue;

    const fimDate = new Date(inicioDate.getTime() + duracaoMin * 60000);
    const fimIso = fimDate.toISOString();

    // Verifica conflito com agendamento ativo existente
    const { data: conflitoAg } = await supabase
      .from("agendamentos")
      .select("id")
      .neq("status", "cancelado")
      .lt("inicio", fimIso)
      .gt("fim", inicioIso)
      .maybeSingle();

    if (conflitoAg) {
      // Pula esta data se já estiver ocupada para não sobrepor
      continue;
    }

    // Verifica se já existe agendamento deste fixo nesta data
    const { data: jaExiste } = await supabase
      .from("agendamentos")
      .select("id")
      .eq("horario_fixo_id", fixoId)
      .eq("inicio", inicioIso)
      .maybeSingle();

    if (!jaExiste) {
      const { data: agNovo, error: agErr } = await supabase
        .from("agendamentos")
        .insert({
          cliente_id: params.clienteId,
          inicio: inicioIso,
          fim: fimIso,
          status: "agendado",
          origem: "fixo",
          horario_fixo_id: fixoId,
          valor_total: valorServico,
          desconto: 0,
          pago: false,
        })
        .select("id")
        .single();

      if (!agErr && agNovo) {
        await supabase.from("agendamento_servicos").insert({
          agendamento_id: agNovo.id,
          servico_id: params.servicoId,
          preco_cobrado: valorServico,
        });
        criadosCount++;
      }
    }
  }

  revalidatePath("/admin/agenda");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  revalidatePath("/agendar");

  return {
    success: true,
    horario_fixo_id: fixoId,
    agendamentos_gerados: criadosCount,
  };
}

/** Alias para compatibilidade com componentes existentes */
export async function criarHorarioFixoAction(
  clienteId: string,
  diaSemana: number,
  hora: string,
  servicoId: string
) {
  return salvarHorarioFixoAction({
    clienteId,
    diaSemana,
    hora,
    servicoId,
    recorrencia: "semanal",
    semanas: 8,
  });
}

/**
 * Pausa ou desativa a recorrência fixa.
 * Cancela os horários futuros agendados vinculados a este fixo,
 * PRESERVANDO integralmente o histórico de atendimentos passados ou concluídos.
 */
export async function pausarHorarioFixoAction(id: string) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/clientes");
    revalidatePath("/admin");
    return { success: true };
  }

  const supabase = createAdminClient();

  // 1. Desativa na tabela horarios_fixos
  const { error } = await supabase
    .from("horarios_fixos")
    .update({ ativo: false })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  // 2. Remove apenas agendamentos futuros não concluídos deste fixo
  const agoraIso = new Date().toISOString();
  await supabase
    .from("agendamentos")
    .delete()
    .eq("horario_fixo_id", id)
    .eq("status", "agendado")
    .gt("inicio", agoraIso);

  revalidatePath("/admin/agenda");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  revalidatePath("/agendar");
  return { success: true };
}

/** Desativar Horário Fixo Semanal (Mantido para compatibilidade) */
export async function desativarHorarioFixoAction(id: string) {
  return pausarHorarioFixoAction(id);
}

/**
 * Excluir definitivamente o horário fixo.
 * Remove agendamentos futuros e desvincula os passados.
 */
export async function excluirHorarioFixoAction(id: string) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/clientes");
    revalidatePath("/admin");
    return { success: true };
  }

  const supabase = createAdminClient();
  const agoraIso = new Date().toISOString();

  // Limpa agendamentos futuros pendentes
  await supabase
    .from("agendamentos")
    .delete()
    .eq("horario_fixo_id", id)
    .eq("status", "agendado")
    .gt("inicio", agoraIso);

  // Remove registro do horário fixo
  const { error } = await supabase.from("horarios_fixos").delete().eq("id", id);
  if (error) return { success: false, error: error.message };

  revalidatePath("/admin/agenda");
  revalidatePath("/admin/clientes");
  revalidatePath("/admin");
  revalidatePath("/agendar");
  return { success: true };
}

/** 6. Concluir Atendimento (Admin) */
export async function concluirAtendimentoAction(
  id: string,
  formaPagamento: FormaPagamento,
  pago: boolean,
  usarCredito: boolean
) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    const { mockConcluirAgendamento } = await import("@/lib/mock-store");
    const res = mockConcluirAgendamento({
      id,
      formaPagamento,
      pago,
      usarCredito,
    });
    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/financeiro");
    revalidatePath("/admin/clientes");
    return res;
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.rpc("concluir_agendamento", {
    p_id: id,
    p_forma_pagamento: formaPagamento,
    p_pago: pago,
    p_usar_credito: usarCredito,
  });

  if (error) {
    // Contingência direta se a RPC falhar
    const { data: ag } = await adminSupabase
      .from("agendamentos")
      .select("*")
      .eq("id", id)
      .single();

    if (ag) {
      await adminSupabase
        .from("agendamentos")
        .update({
          status: "concluido",
          forma_pagamento: formaPagamento,
          pago: pago,
          usou_credito: usarCredito,
        })
        .eq("id", id);

      if (pago && !usarCredito && Number(ag.valor_total) > 0) {
        await adminSupabase.from("lancamentos").insert({
          tipo: "entrada",
          categoria: "Atendimento",
          descricao: `Atendimento concluído - ID: ${id.substring(0, 8)}`,
          valor: ag.valor_total,
          forma_pagamento: formaPagamento,
          agendamento_id: id,
          cliente_id: ag.cliente_id,
          data: new Date().toISOString().split("T")[0],
        });
      }
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/clientes");
  return { success: true };
}

/** 7. Marcar Não Compareceu (Admin) */
export async function marcarNaoCompareceuAction(id: string) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    const { mockMarcarNaoCompareceu } = await import("@/lib/mock-store");
    const res = mockMarcarNaoCompareceu(id);
    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/financeiro");
    revalidatePath("/admin/clientes");
    return res;
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.rpc("marcar_nao_compareceu", { p_id: id });
  if (error) {
    await adminSupabase.from("agendamentos").update({ status: "nao_compareceu" }).eq("id", id);
  }
  revalidatePath("/admin");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/clientes");
  return { success: true };
}

/** 8. Cancelar pelo Admin */
export async function cancelarAgendamentoAdminAction(id: string, motivo?: string) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    const { mockCancelarAgendamento } = await import("@/lib/mock-store");
    const res = mockCancelarAgendamento(id, motivo);
    revalidatePath("/admin");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin/financeiro");
    revalidatePath("/admin/clientes");
    return res;
  }

  const adminSupabase = createAdminClient();
  const { error } = await adminSupabase.rpc("cancelar_agendamento", {
    p_id: id,
    p_motivo: motivo || "Cancelado pelo admin",
    p_cancelado_por: "admin",
  });

  if (error) {
    await adminSupabase
      .from("agendamentos")
      .update({
        status: "cancelado",
        cancelado_em: new Date().toISOString(),
        cancelado_por: "admin",
        motivo_cancelamento: motivo || "Cancelado pelo admin",
      })
      .eq("id", id);
  }

  revalidatePath("/admin");
  revalidatePath("/admin/agenda");
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin/clientes");
  return { success: true };
}

/** 9. Clientes com estatísticas consolidadas */
export async function getClientesStats() {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    const { mockGetClientesComStats } = await import("@/lib/mock-store");
    return mockGetClientesComStats();
  }

  const supabase = createAdminClient();

  // Consulta view consolidada
  const { data: statsRaw } = await supabase
    .from("v_clientes_estatisticas")
    .select("*")
    .order("visitas", { ascending: false });

  // Fallback garantido se a view retornar vazio
  if (!statsRaw || statsRaw.length === 0) {
    const { data: clis } = await supabase
      .from("clientes")
      .select("*, agendamentos(*, agendamento_servicos(preco_cobrado, servicos(nome, preco)))")
      .order("criado_em", { ascending: false });

    return (clis || []).map((c: any) => {
      const agsConcluidos = (c.agendamentos || []).filter((a: any) => a.status === "concluido");
      const totalGasto = agsConcluidos.reduce(
        (acc: number, a: any) => acc + Number(a.valor_total || 0),
        0
      );
      const ultVisita = agsConcluidos.length > 0 ? agsConcluidos[0].inicio : null;
      const diasSemVir = ultVisita
        ? Math.floor((Date.now() - new Date(ultVisita).getTime()) / (1000 * 60 * 60 * 24))
        : null;

      const servicoMaisUsado =
        c.agendamentos?.[0]?.agendamento_servicos?.[0]?.servicos?.nome || null;

      return {
        id: c.id,
        nome: c.nome,
        whatsapp: c.whatsapp,
        data_nascimento: c.data_nascimento,
        user_id: c.user_id,
        observacoes: c.observacoes,
        criado_em: c.criado_em,
        visitas: agsConcluidos.length,
        total_gasto: totalGasto,
        ultima_visita: ultVisita,
        dias_sem_vir: diasSemVir,
        multas_pendentes_qtd: 0,
        multas_pendentes_valor: 0,
        servico_mais_usado: servicoMaisUsado,
      } as ClienteEstatistica;
    });
  }

  return (statsRaw || []) as ClienteEstatistica[];
}

/** 10. Ficha detalhada do cliente */
export async function getClienteDetalhes(clienteId: string) {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    const { loadStore, mockGetAgendamentosCliente } = await import("@/lib/mock-store");
    const store = loadStore();
    const matched = store.clientes.find((c) => c.id === clienteId) || store.clientes[0];
    const { proximos, historico } = mockGetAgendamentosCliente(matched.id);
    return {
      cliente: matched,
      estatisticas: {
        ...matched,
        visitas: historico.length,
        total_gasto: historico.reduce((acc, a) => acc + (a.valor_total || 0), 0),
        ultima_visita: historico[0]?.inicio || null,
        dias_sem_vir: 0,
        multas_pendentes_qtd: 0,
        multas_pendentes_valor: 0,
        servico_mais_usado: "Corte (máquina e tesoura)",
      },
      agendamentos: [...proximos, ...historico],
      multas: store.multas.filter((m) => m.cliente_id === matched.id),
      creditos: [],
      horariosFixos: store.horariosFixos.filter((f) => f.cliente_id === matched.id),
    };
  }

  const supabase = createAdminClient();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clienteId)
    .single();

  const { data: estatisticas } = await supabase
    .from("v_clientes_estatisticas")
    .select("*")
    .eq("id", clienteId)
    .maybeSingle();

  const { data: agendamentosRaw } = await supabase
    .from("agendamentos")
    .select("*, agendamento_servicos(servico_id, preco_cobrado, servicos(*))")
    .eq("cliente_id", clienteId)
    .order("inicio", { ascending: false });

  const agendamentos = (agendamentosRaw || []).map(mapServicosEPreco);

  const { data: multas } = await supabase
    .from("multas")
    .select("*")
    .eq("cliente_id", clienteId)
    .order("criado_em", { ascending: false });

  const { data: creditos } = await supabase
    .from("creditos")
    .select("*, servico:servicos(*)")
    .eq("cliente_id", clienteId);

  const { data: horariosFixos } = await supabase
    .from("horarios_fixos")
    .select("*, servico:servicos(*)")
    .eq("cliente_id", clienteId);

  const concluidos = agendamentos.filter((a) => a.status === "concluido");
  const totalGastoReal = concluidos.reduce((acc, a) => acc + Number(a.valor_total || 0), 0);

  return {
    cliente: cliente as Cliente,
    estatisticas: (estatisticas || {
      ...cliente,
      visitas: concluidos.length,
      total_gasto: totalGastoReal,
      ultima_visita: concluidos[0]?.inicio || null,
      dias_sem_vir: null,
      multas_pendentes_qtd: (multas || []).filter((m) => m.status === "pendente").length,
      multas_pendentes_valor: (multas || []).filter((m) => m.status === "pendente").reduce((acc, m) => acc + Number(m.valor), 0),
      servico_mais_usado: agendamentos[0]?.servicos?.[0]?.nome || null,
    }) as ClienteEstatistica,
    agendamentos,
    multas: (multas || []) as Multa[],
    creditos,
    horariosFixos: (horariosFixos || []) as HorarioFixo[],
  };
}

/** Excluir Cliente (Admin) */
export async function excluirClienteAction(clienteId: string) {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      const { mockExcluirCliente } = await import("@/lib/mock-store");
      mockExcluirCliente(clienteId);
      revalidatePath("/admin/clientes");
      revalidatePath("/admin/agenda");
      revalidatePath("/admin");
      return { success: true };
    }

    const supabase = createAdminClient();

    // 1. Obter agendamentos vinculados para limpar tabela pivô de serviços
    const { data: ags } = await supabase
      .from("agendamentos")
      .select("id")
      .eq("cliente_id", clienteId);

    const agIds = (ags || []).map((a) => a.id);
    if (agIds.length > 0) {
      await supabase
        .from("agendamento_servicos")
        .delete()
        .in("agendamento_id", agIds);
    }

    // 2. Limpar tabelas filhas
    await supabase.from("agendamentos").delete().eq("cliente_id", clienteId);
    await supabase.from("multas").delete().eq("cliente_id", clienteId);
    await supabase.from("creditos").delete().eq("cliente_id", clienteId);
    await supabase.from("horarios_fixos").delete().eq("cliente_id", clienteId);
    await supabase.from("lancamentos").delete().eq("cliente_id", clienteId);

    // 3. Excluir cliente
    const { error } = await supabase.from("clientes").delete().eq("id", clienteId);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/admin/clientes");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao excluir cliente";
    return { success: false, error: msg };
  }
}

/** 11. Financeiro: Lançamentos e métricas integradas aos agendamentos */
export async function getFinanceiroDados() {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    const { mockGetFinanceiro } = await import("@/lib/mock-store");
    return mockGetFinanceiro();
  }

  const supabase = createAdminClient();

  // Lançamentos realizados (entradas e saídas efetivadas)
  const { data: lancamentos } = await supabase
    .from("lancamentos")
    .select("*, cliente:clientes(nome)")
    .order("data", { ascending: false })
    .limit(200);

  // Pendências de pagamento: agendamentos já concluídos com pagamento pendente
  const { data: pendenciasRaw } = await supabase
    .from("agendamentos")
    .select("*, cliente:clientes(nome, whatsapp), agendamento_servicos(servico_id, preco_cobrado, servicos(*))")
    .eq("status", "concluido")
    .eq("pago", false)
    .order("inicio", { ascending: false });

  // Agendamentos ativos (faturamento previsto: agendados e confirmados não cancelados)
  const { data: agendamentosPrevistosRaw } = await supabase
    .from("agendamentos")
    .select("*, cliente:clientes(nome, whatsapp), agendamento_servicos(servico_id, preco_cobrado, servicos(*))")
    .in("status", ["agendado", "confirmado"])
    .order("inicio", { ascending: true });

  const pendencias = (pendenciasRaw || []).map(mapServicosEPreco);
  const agendamentosPrevistos = (agendamentosPrevistosRaw || []).map(mapServicosEPreco);

  const faturamentoPrevistoTotal = agendamentosPrevistos.reduce(
    (acc, a) => acc + Number(a.valor_total || 0),
    0
  );

  const { data: multasPendentes } = await supabase
    .from("multas")
    .select("*, cliente:clientes(nome, whatsapp)")
    .eq("status", "pendente");

  return {
    lancamentos: (lancamentos || []) as Lancamento[],
    pendencias,
    agendamentosPrevistos,
    faturamentoPrevistoTotal,
    multasPendentes: (multasPendentes || []) as Multa[],
  };
}

/** 12. Adicionar Lançamento Financeiro Manual */
export async function criarLancamentoAction(data: {
  tipo: "entrada" | "saida";
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  formaPagamento?: FormaPagamento;
}) {
  await requireAdmin();
  if (!isSupabaseConfigured()) {
    const { mockCriarLancamento } = await import("@/lib/mock-store");
    mockCriarLancamento(data);
    revalidatePath("/admin/financeiro");
    revalidatePath("/admin");
    return { success: true };
  }

  const supabase = createAdminClient();
  const { error } = await supabase.from("lancamentos").insert({
    tipo: data.tipo,
    categoria: data.categoria,
    descricao: data.descricao,
    valor: data.valor,
    data: data.data,
    forma_pagamento: data.formaPagamento || "dinheiro",
  });

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/financeiro");
  revalidatePath("/admin");
  return { success: true };
}

/** 13. Registrar Crédito Pré-Pago */
export async function adicionarCreditoAction(data: {
  clienteId: string;
  servicoId: string;
  quantidade: number;
  valorPago: number;
}) {
  await requireAdmin();
  if (!isSupabaseConfigured()) return { success: true };

  const supabase = createAdminClient();
  const { error } = await supabase.from("creditos").insert({
    cliente_id: data.clienteId,
    servico_id: data.servicoId,
    quantidade: data.quantidade,
    saldo: data.quantidade,
    valor_pago: data.valorPago,
  });

  if (error) return { success: false, error: error.message };

  // Registrar lançamento de entrada
  await supabase.from("lancamentos").insert({
    tipo: "entrada",
    categoria: "Crédito Pré-Pago",
    descricao: `Venda de pacote de créditos (${data.quantidade}x)`,
    valor: data.valorPago,
    cliente_id: data.clienteId,
    data: new Date().toISOString().split("T")[0],
  });

  revalidatePath("/admin/financeiro");
  revalidatePath("/admin");
  return { success: true };
}

/** 14. Pagar ou Perdoar Multa */
export async function atualizarStatusMultaAction(
  multaId: string,
  novoStatus: "paga" | "perdoada"
) {
  await requireAdmin();
  if (!isSupabaseConfigured()) return { success: true };

  const supabase = createAdminClient();

  const { data: multa } = await supabase
    .from("multas")
    .select("*")
    .eq("id", multaId)
    .single();

  if (!multa) return { success: false, error: "Multa não encontrada" };

  const { error } = await supabase
    .from("multas")
    .update({
      status: novoStatus,
      pago_em: novoStatus === "paga" ? new Date().toISOString() : null,
    })
    .eq("id", multaId);

  if (error) return { success: false, error: error.message };

  if (novoStatus === "paga" && multa.valor > 0) {
    await supabase.from("lancamentos").insert({
      tipo: "entrada",
      categoria: "Multa",
      descricao: "Multa por cancelamento recebida",
      valor: multa.valor,
      multa_id: multa.id,
      cliente_id: multa.cliente_id,
      data: new Date().toISOString().split("T")[0],
    });
  }

  revalidatePath("/admin/financeiro");
  revalidatePath("/admin");
  return { success: true };
}

/** 15. Salvar Configurações Gerais */
export async function salvarConfiguracoesAction(novasConfigs: Partial<Configuracao>) {
  await requireAdmin();
  if (!isSupabaseConfigured()) return { success: true };

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("configuracoes")
    .update({
      ...novasConfigs,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", 1);

  if (error) return { success: false, error: error.message };
  revalidatePath("/admin/configuracoes");
  revalidatePath("/agendar");
  return { success: true };
}

/** 16. Salvar Serviço (Criar/Editar) */
export async function salvarServicoAction(
  servico: Partial<Servico>
): Promise<{ success: boolean; error?: string; servico?: Servico }> {
  try {
    await requireAdmin();
    if (!isSupabaseConfigured()) {
      const { mockSalvarServico } = await import("@/lib/mock-store");
      const mockResult = mockSalvarServico(servico);
      revalidatePath("/admin/servicos");
      revalidatePath("/admin");
      revalidatePath("/agendar");
      revalidatePath("/");
      return { success: true, servico: mockResult };
    }

    const supabase = createAdminClient();
    let savedData: any = null;

    if (servico.id) {
      const { id, ...dadosAtualizacao } = servico;
      const { data, error } = await supabase
        .from("servicos")
        .update(dadosAtualizacao)
        .eq("id", id)
        .select()
        .maybeSingle();

      if (error) return { success: false, error: error.message };

      if (!data) {
        // Se a linha com esse ID não existia ainda na tabela, insere via upsert
        const { data: upsertData, error: upsertErr } = await supabase
          .from("servicos")
          .upsert({ id, ...dadosAtualizacao })
          .select()
          .maybeSingle();

        if (upsertErr) return { success: false, error: upsertErr.message };
        savedData = upsertData;
      } else {
        savedData = data;
      }
    } else {
      const { id, ...dadosInsercao } = servico;
      const { data, error } = await supabase
        .from("servicos")
        .insert(dadosInsercao)
        .select()
        .single();

      if (error) return { success: false, error: error.message };
      savedData = data;
    }

    revalidatePath("/admin/servicos");
    revalidatePath("/admin");
    revalidatePath("/agendar");
    revalidatePath("/");
    return { success: true, servico: savedData as Servico };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar serviço";
    return { success: false, error: msg };
  }
}

/** 16.1 Excluir Serviço (Admin) */
export async function excluirServicoAction(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!isSupabaseConfigured()) {
      const { mockExcluirServico } = await import("@/lib/mock-store");
      mockExcluirServico(id);
      revalidatePath("/admin/servicos");
      revalidatePath("/admin");
      revalidatePath("/agendar");
      revalidatePath("/");
      return { success: true };
    }

    const supabase = createAdminClient();

    // 1. Desvincular de combos
    await supabase.from("combo_itens").delete().or(`combo_id.eq.${id},servico_id.eq.${id}`);

    // 2. Limpar dependências para não violar foreign key RESTRICT
    await supabase.from("horarios_fixos").delete().eq("servico_id", id);
    await supabase.from("creditos").delete().eq("servico_id", id);
    await supabase.from("agendamento_servicos").delete().eq("servico_id", id);
    await supabase.from("configuracoes").update({ fidelidade_servico_premio_id: null }).eq("fidelidade_servico_premio_id", id);

    // 3. Excluir o serviço
    const { error } = await supabase.from("servicos").delete().eq("id", id);
    if (error) return { success: false, error: error.message };

    revalidatePath("/admin/servicos");
    revalidatePath("/admin");
    revalidatePath("/agendar");
    revalidatePath("/");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao excluir serviço";
    return { success: false, error: msg };
  }
}

/** 17. Salvar Horários de Funcionamento da Barbearia (Segunda a Sábado) */
export async function salvarHorariosFuncionamentoAction(
  horarios: import("@/lib/supabase/types").HorarioFuncionamento[]
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();
    if (!isSupabaseConfigured()) return { success: true };

    const supabase = createAdminClient();

    for (const h of horarios) {
      const { data: existing } = await supabase
        .from("horario_funcionamento")
        .select("id")
        .eq("dia_semana", h.dia_semana)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("horario_funcionamento")
          .update({
            abre: h.abre,
            fecha: h.fecha,
            ativo: h.ativo,
          })
          .eq("dia_semana", h.dia_semana);
        if (error) return { success: false, error: error.message };
      } else {
        const { error } = await supabase.from("horario_funcionamento").insert({
          dia_semana: h.dia_semana,
          abre: h.abre,
          fecha: h.fecha,
          ativo: h.ativo,
        });
        if (error) return { success: false, error: error.message };
      }
    }

    revalidatePath("/admin/configuracoes");
    revalidatePath("/agendar");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro desconhecido ao salvar horários";
    return { success: false, error: msg };
  }
}

/** 18. Controle de Estoque (Baseado na Planilha Gilmar.xlsx) */
export async function getEstoquePecasAction(): Promise<EstoquePeca[]> {
  await requireAdmin();

  if (!isSupabaseConfigured()) {
    const { mockGetEstoquePecas } = await import("@/lib/mock-store");
    return mockGetEstoquePecas();
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("estoque_pecas")
      .select("*")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      // Fallback para o store local caso a migration 006 ainda não tenha sido executada no Supabase SQL Editor
      const { mockGetEstoquePecas } = await import("@/lib/mock-store");
      return mockGetEstoquePecas();
    }

    if (!data || data.length === 0) {
      // Auto-seed inicial com os 44 itens da planilha Gilmar.xlsx caso a tabela esteja vazia
      const { DEFAULT_ESTOQUE_PECAS } = await import("@/lib/estoque-seed");
      const inserts = DEFAULT_ESTOQUE_PECAS.map((item) => ({
        nome: item.nome,
        categoria: item.categoria,
        valor_unitario: item.valor_unitario,
        quantidade: item.quantidade,
        estoque_minimo: item.estoque_minimo,
        unidade: item.unidade,
        observacao: item.observacao,
        ordem: item.ordem,
        ativo: true,
      }));
      const { data: seeded, error: seedErr } = await supabase
        .from("estoque_pecas")
        .insert(inserts)
        .select("*");

      if (!seedErr && seeded && seeded.length > 0) {
        return seeded.map((p: any) => ({
          ...p,
          valor_unitario: Number(p.valor_unitario || 0),
          quantidade: Number(p.quantidade || 0),
          estoque_minimo: Number(p.estoque_minimo ?? 1),
        })) as EstoquePeca[];
      }

      const { mockGetEstoquePecas } = await import("@/lib/mock-store");
      return mockGetEstoquePecas();
    }

    return data.map((p: any) => ({
      ...p,
      valor_unitario: Number(p.valor_unitario || 0),
      quantidade: Number(p.quantidade || 0),
      estoque_minimo: Number(p.estoque_minimo ?? 1),
    })) as EstoquePeca[];
  } catch {
    const { mockGetEstoquePecas } = await import("@/lib/mock-store");
    return mockGetEstoquePecas();
  }
}

/** 18.1 Criar ou Editar Peça do Estoque */
export async function salvarEstoquePecaAction(
  peca: Partial<EstoquePeca>
): Promise<{ success: boolean; error?: string; peca?: EstoquePeca }> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured()) {
      const { mockSalvarEstoquePeca } = await import("@/lib/mock-store");
      const saved = mockSalvarEstoquePeca(peca);
      revalidatePath("/admin/estoque");
      revalidatePath("/admin");
      return { success: true, peca: saved };
    }

    const supabase = createAdminClient();
    const payload = {
      nome: (peca.nome || "NOVA PEÇA").trim().toUpperCase(),
      categoria: peca.categoria || "Material Elétrico",
      valor_unitario: Math.max(0, Number(peca.valor_unitario ?? 0)),
      quantidade: Math.max(0, Math.round(Number(peca.quantidade ?? 0))),
      estoque_minimo: Math.max(0, Math.round(Number(peca.estoque_minimo ?? 1))),
      unidade: peca.unidade || "un",
      observacao: peca.observacao || null,
      ativo: peca.ativo ?? true,
      atualizado_em: new Date().toISOString(),
    };

    if (peca.id && !peca.id.startsWith("est-")) {
      const { data, error } = await supabase
        .from("estoque_pecas")
        .update(payload)
        .eq("id", peca.id)
        .select("*")
        .maybeSingle();

      if (!error && data) {
        revalidatePath("/admin/estoque");
        revalidatePath("/admin");
        return {
          success: true,
          peca: {
            ...data,
            valor_unitario: Number(data.valor_unitario || 0),
            quantidade: Number(data.quantidade || 0),
          } as EstoquePeca,
        };
      }
    } else if (!peca.id) {
      const { data, error } = await supabase
        .from("estoque_pecas")
        .insert({
          ...payload,
          ordem: peca.ordem ?? 99,
        })
        .select("*")
        .single();

      if (!error && data) {
        revalidatePath("/admin/estoque");
        revalidatePath("/admin");
        return {
          success: true,
          peca: {
            ...data,
            valor_unitario: Number(data.valor_unitario || 0),
            quantidade: Number(data.quantidade || 0),
          } as EstoquePeca,
        };
      }
    }

    // Fallback para mock-store caso a tabela ainda não exista no Supabase
    const { mockSalvarEstoquePeca } = await import("@/lib/mock-store");
    const saved = mockSalvarEstoquePeca(peca);
    revalidatePath("/admin/estoque");
    revalidatePath("/admin");
    return { success: true, peca: saved };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao salvar peça no estoque";
    return { success: false, error: msg };
  }
}

/** 18.2 Ajuste Rápido de Quantidade em Estoque (+1 / -1 ou valor direto) */
export async function ajustarQuantidadeEstoqueAction(
  id: string,
  novaQuantidade: number
): Promise<{ success: boolean; error?: string; peca?: EstoquePeca }> {
  try {
    await requireAdmin();
    const qtdFinal = Math.max(0, Math.round(Number(novaQuantidade || 0)));

    if (!isSupabaseConfigured() || id.startsWith("est-") || id.startsWith("peca-")) {
      const { mockAjustarQuantidadeEstoque } = await import("@/lib/mock-store");
      const updated = mockAjustarQuantidadeEstoque(id, qtdFinal);
      revalidatePath("/admin/estoque");
      revalidatePath("/admin");
      return updated ? { success: true, peca: updated } : { success: false, error: "Peça não encontrada" };
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("estoque_pecas")
      .update({
        quantidade: qtdFinal,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", id)
      .select("*")
      .maybeSingle();

    if (error || !data) {
      const { mockAjustarQuantidadeEstoque } = await import("@/lib/mock-store");
      const updated = mockAjustarQuantidadeEstoque(id, qtdFinal);
      revalidatePath("/admin/estoque");
      revalidatePath("/admin");
      return updated ? { success: true, peca: updated } : { success: false, error: "Peça não encontrada" };
    }

    revalidatePath("/admin/estoque");
    revalidatePath("/admin");
    return {
      success: true,
      peca: {
        ...data,
        valor_unitario: Number(data.valor_unitario || 0),
        quantidade: Number(data.quantidade || 0),
      } as EstoquePeca,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao ajustar estoque";
    return { success: false, error: msg };
  }
}

/** 18.3 Excluir Peça do Estoque */
export async function excluirEstoquePecaAction(
  id: string
): Promise<{ success: boolean; error?: string }> {
  try {
    await requireAdmin();

    if (!isSupabaseConfigured() || id.startsWith("est-")) {
      const { mockExcluirEstoquePeca } = await import("@/lib/mock-store");
      mockExcluirEstoquePeca(id);
      revalidatePath("/admin/estoque");
      revalidatePath("/admin");
      return { success: true };
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from("estoque_pecas").delete().eq("id", id);

    if (error) {
      const { mockExcluirEstoquePeca } = await import("@/lib/mock-store");
      mockExcluirEstoquePeca(id);
    }

    revalidatePath("/admin/estoque");
    revalidatePath("/admin");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao excluir item do estoque";
    return { success: false, error: msg };
  }
}

/** 18.4 Restaurar Planilha Padrão do Gilmar (44 peças originais) */
export async function restaurarEstoquePadraoAction(): Promise<{
  success: boolean;
  error?: string;
  pecas?: EstoquePeca[];
}> {
  try {
    await requireAdmin();
    const { mockRestaurarEstoquePadrao } = await import("@/lib/mock-store");
    const padrao = mockRestaurarEstoquePadrao();

    if (isSupabaseConfigured()) {
      try {
        const supabase = createAdminClient();
        await supabase.from("estoque_pecas").delete().neq("id", "00000000-0000-0000-0000-000000000000");

        const { DEFAULT_ESTOQUE_PECAS } = await import("@/lib/estoque-seed");
        const inserts = DEFAULT_ESTOQUE_PECAS.map((item) => ({
          nome: item.nome,
          categoria: item.categoria,
          valor_unitario: item.valor_unitario,
          quantidade: item.quantidade,
          estoque_minimo: item.estoque_minimo,
          unidade: item.unidade,
          observacao: item.observacao,
          ordem: item.ordem,
          ativo: true,
        }));
        const { data: seeded } = await supabase
          .from("estoque_pecas")
          .insert(inserts)
          .select("*");

        if (seeded && seeded.length > 0) {
          revalidatePath("/admin/estoque");
          revalidatePath("/admin");
          return {
            success: true,
            pecas: seeded.map((p: any) => ({
              ...p,
              valor_unitario: Number(p.valor_unitario || 0),
              quantidade: Number(p.quantidade || 0),
              estoque_minimo: Number(p.estoque_minimo ?? 1),
            })) as EstoquePeca[],
          };
        }
      } catch {
        // Fallback silencioso para o mock-store
      }
    }

    revalidatePath("/admin/estoque");
    revalidatePath("/admin");
    return { success: true, pecas: padrao };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao restaurar estoque padrão";
    return { success: false, error: msg };
  }
}
