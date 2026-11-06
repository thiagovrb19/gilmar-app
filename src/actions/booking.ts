"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";
import { Servico, Configuracao, Agendamento, Multa } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const DEFAULT_CONFIG: Configuracao = {
  id: 1,
  nome_barbearia: "GS Elétrica e Manutenção",
  whatsapp_contato: "32988714986",
  endereco: "Atendimento em Visconde do Rio Branco - MG e região",
  link_maps: "https://www.google.com/maps/search/?api=1&query=Visconde+do+Rio+Branco+MG",
  instagram: "@gseletricaemanutencao",
  pix_chave: "32988714986",
  pix_nome: "GILMAR SALES",
  pix_cidade: "Visconde do Rio Branco",
  duracao_horario_min: 60,
  antecedencia_minima_horas: 1,
  janela_dias: 30,
  horas_cancelamento_gratis: 3,
  multa_percentual: 50.0,
  bloquear_se_multa_pendente: false,
  desconto_aniversario_ativo: false,
  desconto_aniversario_percentual: 10.0,
  desconto_aniversario_regra: "semana",
  dias_cliente_sumido: 30,
  fidelidade_ativo: false,
  fidelidade_a_cada_visitas: 10,
  fidelidade_servico_premio_id: null,
  atualizado_em: "2026-01-01T00:00:00Z",
};

const DEFAULT_HORARIOS: import("@/lib/supabase/types").HorarioFuncionamento[] = [
  { dia_semana: 0, abre: "08:00:00", fecha: "12:00:00", ativo: false }, // Domingo fechado
  { dia_semana: 1, abre: "07:00:00", fecha: "18:00:00", ativo: true },  // Segunda (07h às 18h)
  { dia_semana: 2, abre: "07:00:00", fecha: "18:00:00", ativo: true },  // Terça (07h às 18h)
  { dia_semana: 3, abre: "07:00:00", fecha: "18:00:00", ativo: true },  // Quarta (07h às 18h)
  { dia_semana: 4, abre: "07:00:00", fecha: "18:00:00", ativo: true },  // Quinta (07h às 18h)
  { dia_semana: 5, abre: "07:00:00", fecha: "18:00:00", ativo: true },  // Sexta (07h às 18h)
  { dia_semana: 6, abre: "07:00:00", fecha: "13:00:00", ativo: true },  // Sábado (07h às 13h)
];

/** Busca serviços ativos e combos ordenados diretamente do banco de dados */
export async function getServicos(apenasAtivos: boolean = true): Promise<Servico[]> {
  if (!isSupabaseConfigured()) {
    const { loadStore, DEMO_SERVICOS_STATIC } = await import("@/lib/mock-store");
    const store = loadStore();
    const servicos = store.servicos && store.servicos.length > 0 ? store.servicos : DEMO_SERVICOS_STATIC;
    return apenasAtivos ? servicos.filter((s) => s.ativo) : servicos;
  }

  const supabase = await createClient();

  let query = supabase
    .from("servicos")
    .select("*")
    .order("ordem", { ascending: true });

  if (apenasAtivos) {
    query = query.eq("ativo", true);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Erro ao buscar serviços no Supabase:", error);
    return [];
  }

  return (data || []) as Servico[];
}

/** Busca configurações do app */
export async function getConfiguracoes(): Promise<Configuracao> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_CONFIG;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("configuracoes")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return DEFAULT_CONFIG;
  }

  return data as Configuracao;
}

export interface HorarioSlot {
  inicio: string;
  fim: string;
  hora_formatada: string;
}

/** Busca os horários de funcionamento configurados para cada dia da semana */
export async function getHorariosFuncionamento(): Promise<import("@/lib/supabase/types").HorarioFuncionamento[]> {
  if (!isSupabaseConfigured()) {
    return DEFAULT_HORARIOS;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("horario_funcionamento")
    .select("*")
    .order("dia_semana", { ascending: true });

  if (error || !data || data.length === 0) {
    return DEFAULT_HORARIOS;
  }

  return data as import("@/lib/supabase/types").HorarioFuncionamento[];
}

/** Busca lista de exceções de dias (feriados, dias fechados, horários especiais) */
export async function getDiasExcecoesAction(
  inicioStr?: string,
  fimStr?: string
): Promise<import("@/lib/supabase/types").DiaExcecao[]> {
  if (!isSupabaseConfigured()) {
    const { mockGetDiasExcecao } = await import("@/lib/mock-store");
    return mockGetDiasExcecao(inicioStr, fimStr);
  }

  const supabase = await createClient();
  let query = supabase.from("dias_excecao").select("*");
  if (inicioStr) query = query.gte("data", inicioStr.substring(0, 10));
  if (fimStr) query = query.lte("data", fimStr.substring(0, 10));
  const { data } = await query;
  return (data || []) as import("@/lib/supabase/types").DiaExcecao[];
}

/** Helper para gerar slots de 1 hora entre dois horários "HH:MM" */
function gerarHorasEntre(abreStr: string, fechaStr: string): string[] {
  const result: string[] = [];
  const startH = parseInt(abreStr.split(":")[0], 10);
  const endH = parseInt(fechaStr.split(":")[0], 10);
  for (let h = startH; h < endH; h++) {
    result.push(`${h.toString().padStart(2, "0")}:00`);
  }
  return result;
}

/** Consulta horários livres para uma data */
export async function getHorariosDisponiveis(dataStr: string): Promise<HorarioSlot[]> {
  const cleanDate = dataStr.substring(0, 10);
  const dayOfWeek = new Date(`${cleanDate}T12:00:00`).getDay();

  // 1. MODO LOCAL / MOCK STORE
  if (!isSupabaseConfigured()) {
    const { mockGetHorasOcupadas, mockGetDiaExcecao } = await import("@/lib/mock-store");
    const excecao = mockGetDiaExcecao(cleanDate);

    // Se o dia foi marcado pelo Luiz como FECHADO (Feriado, imprevisto ou folga)
    if (excecao?.tipo === "fechado") {
      return [];
    }

    let horas: string[] = [];

    // Se o Luiz definiu horários especiais para esta data específica
    if (excecao?.tipo === "personalizado") {
      if (excecao.horarios_especificos && excecao.horarios_especificos.length > 0) {
        horas = [...excecao.horarios_especificos].sort();
      } else if (excecao.abre && excecao.fecha) {
        horas = gerarHorasEntre(excecao.abre, excecao.fecha);
      }
    }

    // Se não há exceção personalizada, usa a grade padrão da semana (07:00 às 18:00 Seg-Sex, 07:00 às 13:00 Sáb)
    if (horas.length === 0 && !excecao) {
      if (dayOfWeek === 0) {
        // Domingo fechado por padrão
        return [];
      }
      horas =
        dayOfWeek === 6
          ? gerarHorasEntre("07:00", "13:00")
          : gerarHorasEntre("07:00", "18:00");
    }

    const horasOcupadas = mockGetHorasOcupadas(cleanDate);

    return horas
      .filter((hora) => !horasOcupadas.has(hora))
      .map((hora) => {
        const inicio = `${cleanDate}T${hora}:00-03:00`;
        const hourNum = parseInt(hora.split(":")[0]);
        const fim = `${cleanDate}T${(hourNum + 1).toString().padStart(2, "0")}:00:00-03:00`;
        return {
          inicio,
          fim,
          hora_formatada: hora,
        };
      });
  }

  // 2. MODO SUPABASE CONECTADO - Usa admin client para ler agendamentos e bloqueios reais sem bloqueio de RLS
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  // Verificar se há dia de exceção registrado
  const { data: excecaoDb } = await supabase
    .from("dias_excecao")
    .select("*")
    .eq("data", cleanDate)
    .maybeSingle();

  if (excecaoDb) {
    if (excecaoDb.tipo === "fechado") {
      return [];
    }
  }

  // Chamar RPC horarios_disponiveis
  const { data, error } = await supabase.rpc("horarios_disponiveis", {
    p_data: cleanDate,
  });

  if (error || !data || (Array.isArray(data) && data.length === 0)) {
    let horas: string[] = [];

    if (excecaoDb?.tipo === "personalizado") {
      if (excecaoDb.horarios_especificos && excecaoDb.horarios_especificos.length > 0) {
        horas = excecaoDb.horarios_especificos;
      } else if (excecaoDb.abre && excecaoDb.fecha) {
        horas = gerarHorasEntre(excecaoDb.abre, excecaoDb.fecha);
      }
    }

    if (horas.length === 0) {
      if (dayOfWeek === 0) return [];
      horas =
        dayOfWeek === 6
          ? gerarHorasEntre("07:00", "13:00")
          : gerarHorasEntre("07:00", "18:00");
    }

    // Consulta agendamentos, fixos e bloqueios do dia
    const [agRes, fixosRes, blqRes] = await Promise.all([
      supabase
        .from("agendamentos")
        .select("inicio, status")
        .gte("inicio", `${cleanDate}T00:00:00-03:00`)
        .lte("inicio", `${cleanDate}T23:59:59-03:00`)
        .neq("status", "cancelado"),
      supabase
        .from("horarios_fixos")
        .select("hora, ativo")
        .eq("dia_semana", dayOfWeek)
        .eq("ativo", true),
      supabase
        .from("bloqueios")
        .select("inicio, fim")
        .gte("fim", `${cleanDate}T00:00:00-03:00`)
        .lte("inicio", `${cleanDate}T23:59:59-03:00`),
    ]);

    const horasOcupadas = new Set<string>();

    (agRes.data || []).forEach((ag: { inicio: string }) => {
      try {
        const horaStr = new Date(ag.inicio).toLocaleTimeString("pt-BR", {
          timeZone: "America/Sao_Paulo",
          hour: "2-digit",
          minute: "2-digit",
        });
        horasOcupadas.add(horaStr);
      } catch {
        // ignora
      }
    });

    (fixosRes.data || []).forEach((fx: { hora: string }) => {
      if (fx.hora) horasOcupadas.add(fx.hora.substring(0, 5));
    });

    (blqRes.data || []).forEach((b: { inicio: string; fim: string }) => {
      try {
        const bStart = parseInt(b.inicio.substring(11, 13));
        const bEnd = parseInt(b.fim.substring(11, 13));
        for (let h = bStart; h < (bEnd || bStart + 1); h++) {
          horasOcupadas.add(`${h.toString().padStart(2, "0")}:00`);
        }
      } catch {
        // ignora
      }
    });

    return horas
      .filter((hora) => !horasOcupadas.has(hora))
      .map((hora) => {
        const inicio = `${cleanDate}T${hora}:00-03:00`;
        const hourNum = parseInt(hora.split(":")[0]);
        const fim = `${cleanDate}T${(hourNum + 1).toString().padStart(2, "0")}:00:00-03:00`;
        return {
          inicio,
          fim,
          hora_formatada: hora,
        };
      });
  }

  return data as HorarioSlot[];
}

function isValidUuid(id?: string | null): boolean {
  if (!id || typeof id !== "string") return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
}

/** Criação ou atualização de orçamento/agendamento sem necessidade de login */
export async function criarAgendamentoAction(params: {
  servicosIds: string[];
  inicio: string;
  observacao?: string;
  clienteId?: string;
  clienteNome?: string;
  clienteWhatsapp?: string;
  agendamentoIdExistente?: string;
  propostaSubtitulo?: string;
  propostaObjetivo?: string;
  propostaCondicoesPagamento?: string;
  clienteLocalidade?: string;
  propostaItensJson?: import("@/lib/supabase/types").PropostaItemDetalhe[];
  valorTotalOverride?: number;
}): Promise<{
  success: boolean;
  agendamento_id?: string;
  cliente_id?: string;
  valor_total?: number;
  desconto?: number;
  error?: string;
}> {
  try {
    let finalClienteId = params.clienteId;
    const nomeInformado = (params.clienteNome || "").trim();
    const whatsappInformado = (params.clienteWhatsapp || "").replace(/\D/g, "");

    if (!finalClienteId) {
      const user = await getCurrentUser();
      if (user?.clienteId) {
        finalClienteId = user.clienteId;
      }
    }

    if (!isSupabaseConfigured()) {
      const { mockCriarAgendamento } = await import("@/lib/mock-store");
      const res = mockCriarAgendamento({
        clienteId: finalClienteId,
        clienteNome: nomeInformado || undefined,
        clienteWhatsapp: whatsappInformado || undefined,
        agendamentoIdExistente: params.agendamentoIdExistente,
        servicosIds: params.servicosIds,
        inicio: params.inicio,
        observacao: params.observacao,
        origem: "app",
        propostaSubtitulo: params.propostaSubtitulo,
        propostaObjetivo: params.propostaObjetivo,
        propostaCondicoesPagamento: params.propostaCondicoesPagamento,
        clienteLocalidade: params.clienteLocalidade,
        propostaItensJson: params.propostaItensJson,
        valorTotalOverride: params.valorTotalOverride,
      });

      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        cookieStore.set(
          "barbearia_cliente_session",
          JSON.stringify({
            id: res.agendamento.cliente_id,
            nome: res.agendamento.cliente?.nome || nomeInformado || "Cliente",
            whatsapp: res.agendamento.cliente?.whatsapp || whatsappInformado || "",
            data_nascimento: null,
          }),
          {
            httpOnly: true,
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
          }
        );
      } catch {
        // Ignora erro de cookie em contextos não suportados
      }

      revalidatePath("/admin/agenda");
      revalidatePath("/admin");
      revalidatePath("/admin/clientes");
      revalidatePath("/admin/financeiro");
      revalidatePath("/meus-agendamentos");
      revalidatePath("/agendar");

      return {
        success: true,
        agendamento_id: res.agendamento.id,
        cliente_id: res.agendamento.cliente_id,
        valor_total: res.agendamento.valor_total,
      };
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();

    // 1. Resolve o ID real do cliente na tabela public.clientes (sem exigir login)
    let clienteIdReal: string | null = null;
    let clienteNomeFinal = nomeInformado || "Cliente";
    let clienteWhatsappFinal = whatsappInformado;

    if (finalClienteId && isValidUuid(finalClienteId)) {
      try {
        // 1.1 Tenta achar cliente por id direto
        const { data: cById } = await adminSupabase
          .from("clientes")
          .select("id, nome, whatsapp")
          .eq("id", finalClienteId)
          .maybeSingle();

        if (cById?.id) {
          clienteIdReal = cById.id;
          if (!nomeInformado && cById.nome) clienteNomeFinal = cById.nome;
          if (!whatsappInformado && cById.whatsapp) clienteWhatsappFinal = cById.whatsapp;
        } else {
          // 1.2 Tenta achar cliente por user_id (caso finalClienteId seja o id do auth.users)
          const { data: cByUser } = await adminSupabase
            .from("clientes")
            .select("id, nome, whatsapp")
            .eq("user_id", finalClienteId)
            .maybeSingle();

          if (cByUser?.id) {
            clienteIdReal = cByUser.id;
            if (!nomeInformado && cByUser.nome) clienteNomeFinal = cByUser.nome;
            if (!whatsappInformado && cByUser.whatsapp) clienteWhatsappFinal = cByUser.whatsapp;
          } else {
            // 1.3 Tenta achar por profiles
            const { data: pRow } = await adminSupabase
              .from("profiles")
              .select("cliente_id")
              .eq("id", finalClienteId)
              .maybeSingle();

            if (pRow?.cliente_id && isValidUuid(pRow.cliente_id)) {
              clienteIdReal = pRow.cliente_id;
            }
          }
        }
      } catch {
        // continua para busca por telefone/nome
      }
    }

    // 1.4 Se não achou por UUID, busca pelo WhatsApp ou Nome informado no orçamento, ou cadastra automaticamente
    if (!clienteIdReal) {
      const user = await getCurrentUser();
      const userPhone = whatsappInformado || user?.cliente?.whatsapp || "";
      const userName = nomeInformado || user?.cliente?.nome || "Cliente";
      clienteNomeFinal = userName;
      clienteWhatsappFinal = userPhone;

      if (userPhone && userPhone.replace(/\D/g, "").length >= 8) {
        const cleanPhone = userPhone.replace(/\D/g, "");
        const { data: cByPhone } = await adminSupabase
          .from("clientes")
          .select("id, nome, whatsapp")
          .or(`whatsapp.eq.${cleanPhone},whatsapp.ilike.%${cleanPhone.slice(-8)}%`)
          .limit(1)
          .maybeSingle();

        if (cByPhone?.id) {
          clienteIdReal = cByPhone.id;
        }
      }

      // Se não informou telefone mas informou nome, tenta encontrar cliente existente com mesmo nome
      if (!clienteIdReal && nomeInformado.length >= 3) {
        const { data: cByName } = await adminSupabase
          .from("clientes")
          .select("id, nome, whatsapp")
          .ilike("nome", nomeInformado)
          .limit(1)
          .maybeSingle();

        if (cByName?.id) {
          clienteIdReal = cByName.id;
          if (!clienteWhatsappFinal && cByName.whatsapp) {
            clienteWhatsappFinal = cByName.whatsapp;
          }
        }
      }

      if (!clienteIdReal) {
        // Gera um telefone único caso o cliente não tenha preenchido o WhatsApp (para respeitar UNIQUE(whatsapp))
        const safeWhatsapp =
          userPhone && userPhone.replace(/\D/g, "").length >= 8
            ? userPhone.replace(/\D/g, "")
            : "55329" + Math.floor(10000000 + Math.random() * 89999999).toString();

        const idToInsert = finalClienteId && isValidUuid(finalClienteId) ? finalClienteId : crypto.randomUUID();

        const { data: newCli, error: newCliErr } = await adminSupabase
          .from("clientes")
          .insert({
            id: idToInsert,
            nome: userName || "Cliente",
            whatsapp: safeWhatsapp,
            data_nascimento: user?.cliente?.data_nascimento || null,
            observacoes: params.clienteLocalidade ? `Localidade: ${params.clienteLocalidade}` : null,
          })
          .select("id, nome, whatsapp")
          .maybeSingle();

        if (newCli?.id) {
          clienteIdReal = newCli.id;
          clienteWhatsappFinal = newCli.whatsapp;
        } else if (newCliErr) {
          console.warn("Aviso ao inserir cliente no Supabase:", newCliErr.message);
          // Se já existe um cliente com este telefone (conflito de chave única), busca-o
          const { data: existingCli } = await adminSupabase
            .from("clientes")
            .select("id, nome, whatsapp")
            .or(`whatsapp.eq.${safeWhatsapp},whatsapp.ilike.%${safeWhatsapp.slice(-8)}%`)
            .limit(1)
            .maybeSingle();

          if (existingCli?.id) {
            clienteIdReal = existingCli.id;
            clienteWhatsappFinal = existingCli.whatsapp;
          } else {
            // Tenta inserir com WhatsApp único gerado com timestamp
            const fallbackId = crypto.randomUUID();
            const retryWhatsapp = "55329" + Date.now().toString().slice(-8);
            const { data: retryCli, error: retryErr } = await adminSupabase
              .from("clientes")
              .insert({
                id: fallbackId,
                nome: userName || "Cliente",
                whatsapp: retryWhatsapp,
                observacoes: params.clienteLocalidade ? `Localidade: ${params.clienteLocalidade}` : null,
              })
              .select("id, nome, whatsapp")
              .maybeSingle();

            if (retryCli?.id) {
              clienteIdReal = retryCli.id;
              clienteWhatsappFinal = retryCli.whatsapp;
            } else if (!retryErr) {
              clienteIdReal = fallbackId;
              clienteWhatsappFinal = retryWhatsapp;
            }
          }
        } else {
          clienteIdReal = idToInsert;
          clienteWhatsappFinal = safeWhatsapp;
        }
      }
    }

    // Se ainda assim o ID não foi resolvido, cria o registro de emergência antes de prosseguir com o agendamento
    if (!clienteIdReal || !isValidUuid(clienteIdReal)) {
      try {
        const emergencyId = crypto.randomUUID();
        const emergencyWhats = `553299${Date.now().toString().slice(-7)}`;
        await adminSupabase.from("clientes").insert({
          id: emergencyId,
          nome: nomeInformado || "Cliente",
          whatsapp: emergencyWhats,
          observacoes: "Cadastro automático criado pelo fluxo de agendamento",
        });
        clienteIdReal = emergencyId;
        clienteWhatsappFinal = emergencyWhats;
      } catch (emErr) {
        console.error("Falha na criação de emergência do cliente:", emErr);
      }
    }

    // Se o cliente já existia e o usuário digitou Nome ou WhatsApp no orçamento, atualiza os dados do cliente
    if (clienteIdReal && isValidUuid(clienteIdReal)) {
      const updateCliPayload: Record<string, string> = {};
      if (nomeInformado && nomeInformado.length >= 2) {
        updateCliPayload.nome = nomeInformado;
      }
      if (whatsappInformado && whatsappInformado.length >= 8) {
        updateCliPayload.whatsapp = whatsappInformado;
      }
      if (Object.keys(updateCliPayload).length > 0) {
        try {
          await adminSupabase
            .from("clientes")
            .update(updateCliPayload)
            .eq("id", clienteIdReal);
        } catch {
          // Ignora se whatsapp colidir com outro registro
        }
      }

      // Salva cookie de sessão silenciosa para que o cliente veja seus orçamentos sem precisar de login
      try {
        const { cookies } = await import("next/headers");
        const cookieStore = await cookies();
        cookieStore.set(
          "barbearia_cliente_session",
          JSON.stringify({
            id: clienteIdReal,
            nome: clienteNomeFinal || "Cliente",
            whatsapp: clienteWhatsappFinal || "",
            data_nascimento: null,
          }),
          {
            httpOnly: true,
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
          }
        );
      } catch {
        // Ignora erro de cookie se chamado fora de Server Action
      }
    }

    if (!clienteIdReal || !isValidUuid(clienteIdReal)) {
      return {
        success: false,
        error: "Não foi possível registrar os dados do cliente para o orçamento.",
      };
    }

    const duracaoMin = 60;
    const inicioDate = new Date(params.inicio);
    const fimDate = new Date(inicioDate.getTime() + duracaoMin * 60000);

    // Se já existe um agendamento salvo nesta mesma sessão (ex: cliente clicou em Gerar PDF e depois Confirmar), atualiza-o!
    if (params.agendamentoIdExistente && isValidUuid(params.agendamentoIdExistente)) {
      const { data: agExistente } = await adminSupabase
        .from("agendamentos")
        .select("id, valor_total")
        .eq("id", params.agendamentoIdExistente)
        .maybeSingle();

      if (agExistente?.id) {
        const valorTotalUpd =
          params.valorTotalOverride && params.valorTotalOverride > 0
            ? params.valorTotalOverride
            : Number(agExistente.valor_total || 0);

        await adminSupabase
          .from("agendamentos")
          .update({
            cliente_id: clienteIdReal,
            inicio: params.inicio,
            fim: fimDate.toISOString(),
            valor_total: valorTotalUpd,
            observacao: params.observacao || null,
          })
          .eq("id", agExistente.id);

        try {
          await adminSupabase
            .from("agendamentos")
            .update({
              proposta_subtitulo: params.propostaSubtitulo || null,
              proposta_objetivo: params.propostaObjetivo || null,
              proposta_condicoes_pagamento: params.propostaCondicoesPagamento || null,
              cliente_localidade: params.clienteLocalidade || null,
              proposta_itens_json: params.propostaItensJson || null,
            })
            .eq("id", agExistente.id);
        } catch {
          // Colunas opcionais ainda não criadas
        }

        revalidatePath("/admin/agenda");
        revalidatePath("/admin");
        revalidatePath("/admin/financeiro");
        revalidatePath("/admin/clientes");
        revalidatePath(`/admin/clientes/${clienteIdReal}`);
        revalidatePath("/meus-agendamentos");
        revalidatePath("/agendar");

        return {
          success: true,
          agendamento_id: agExistente.id,
          cliente_id: clienteIdReal,
          valor_total: valorTotalUpd,
          desconto: 0,
        };
      }
    }

    // 2. Validação estrita de conflito no servidor antes de confirmar
    const { data: conflitoAg } = await adminSupabase
      .from("agendamentos")
      .select("id")
      .neq("status", "cancelado")
      .lt("inicio", fimDate.toISOString())
      .gt("fim", inicioDate.toISOString())
      .maybeSingle();

    if (conflitoAg) {
      return {
        success: false,
        error: "Este horário acabou de ser reservado por outro cliente. Por favor, escolha outro horário disponível.",
      };
    }

    const { data: conflitoBlq } = await adminSupabase
      .from("bloqueios")
      .select("id, motivo")
      .lt("inicio", fimDate.toISOString())
      .gt("fim", inicioDate.toISOString())
      .maybeSingle();

    if (conflitoBlq) {
      return {
        success: false,
        error: `Este horário está bloqueado pelo Gilmar (${conflitoBlq.motivo || "Indisponível"}).`,
      };
    }

    // 3. Tenta invocar a RPC criar_agendamento via Admin Client
    const { data: rpcData, error: rpcError } = await adminSupabase.rpc("criar_agendamento", {
      p_cliente_id: clienteIdReal,
      p_servicos: params.servicosIds,
      p_inicio: params.inicio,
      p_origem: "app",
      p_observacao: params.observacao || null,
    });

    if (!rpcError && rpcData?.success) {
      if (rpcData.agendamento_id) {
        try {
          await adminSupabase
            .from("agendamentos")
            .update({
              ...(params.valorTotalOverride && params.valorTotalOverride > 0
                ? { valor_total: params.valorTotalOverride }
                : {}),
              proposta_subtitulo: params.propostaSubtitulo || null,
              proposta_objetivo: params.propostaObjetivo || null,
              proposta_condicoes_pagamento: params.propostaCondicoesPagamento || null,
              cliente_localidade: params.clienteLocalidade || null,
              proposta_itens_json: params.propostaItensJson || null,
            })
            .eq("id", rpcData.agendamento_id);
        } catch {
          // Colunas opcionais ainda não criadas no banco; segue normalmente
        }
      }

      revalidatePath("/admin/agenda");
      revalidatePath("/admin");
      revalidatePath("/admin/financeiro");
      revalidatePath("/admin/clientes");
      revalidatePath(`/admin/clientes/${clienteIdReal}`);
      revalidatePath("/meus-agendamentos");
      revalidatePath("/agendar");

      return {
        ...(rpcData as {
          success: boolean;
          agendamento_id?: string;
          valor_total?: number;
          desconto?: number;
          error?: string;
        }),
        cliente_id: clienteIdReal,
        valor_total:
          params.valorTotalOverride && params.valorTotalOverride > 0
            ? params.valorTotalOverride
            : rpcData.valor_total,
      };
    }

    // 4. Inserção direta de contingência via Admin Client
    const { data: servicosDb } = await adminSupabase
      .from("servicos")
      .select("id, preco")
      .in("id", params.servicosIds);

    const valorCalculado = (servicosDb || []).reduce((acc, s) => acc + Number(s.preco), 0);
    const valorTotal =
      params.valorTotalOverride && params.valorTotalOverride > 0
        ? params.valorTotalOverride
        : valorCalculado > 0
        ? valorCalculado
        : 25;

    const { data: novoAg, error: agErr } = await adminSupabase
      .from("agendamentos")
      .insert({
        cliente_id: clienteIdReal,
        inicio: params.inicio,
        fim: fimDate.toISOString(),
        status: "agendado",
        origem: "app",
        valor_total: valorTotal,
        desconto: 0,
        observacao: params.observacao || null,
      })
      .select("id")
      .single();

    if (agErr || !novoAg) {
      return { success: false, error: agErr?.message || rpcError?.message || "Erro ao agendar" };
    }

    try {
      await adminSupabase
        .from("agendamentos")
        .update({
          proposta_subtitulo: params.propostaSubtitulo || null,
          proposta_objetivo: params.propostaObjetivo || null,
          proposta_condicoes_pagamento: params.propostaCondicoesPagamento || null,
          cliente_localidade: params.clienteLocalidade || null,
          proposta_itens_json: params.propostaItensJson || null,
        })
        .eq("id", novoAg.id);
    } catch {
      // ignora se a migration 006 ainda não foi rodada
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
      await adminSupabase.from("agendamento_servicos").insert(inserts);
    }

    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    revalidatePath("/admin/financeiro");
    revalidatePath("/admin/clientes");
    revalidatePath(`/admin/clientes/${clienteIdReal}`);
    revalidatePath("/meus-agendamentos");
    revalidatePath("/agendar");

    return {
      success: true,
      agendamento_id: novoAg.id,
      cliente_id: clienteIdReal,
      valor_total: valorTotal > 0 ? valorTotal : 25,
      desconto: 0,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao agendar";
    return { success: false, error: msg };
  }
}

/** Meus agendamentos para o cliente logado */
export async function getMeusAgendamentos(): Promise<{
  proximos: Agendamento[];
  historico: Agendamento[];
}> {
  const user = await getCurrentUser();
  if (!user) {
    return { proximos: [], historico: [] };
  }

  if (!isSupabaseConfigured()) {
    const { mockGetAgendamentosCliente } = await import("@/lib/mock-store");
    return mockGetAgendamentosCliente(user.clienteId || user.id);
  }

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminSupabase = createAdminClient();

  // Coleta todos os identificadores possíveis do cliente logado para garantir busca completa
  const candidateIds = new Set<string>();
  if (user.clienteId && isValidUuid(user.clienteId)) {
    candidateIds.add(user.clienteId);
  }
  if (user.cliente?.id && isValidUuid(user.cliente.id)) {
    candidateIds.add(user.cliente.id);
  }
  if (user.id && isValidUuid(user.id)) {
    candidateIds.add(user.id);
  }

  // Se o cliente tem telefone cadastrado no perfil/sessão, busca seu id na tabela clientes
  const userPhone = user.cliente?.whatsapp;
  if (userPhone) {
    const cleanPhone = userPhone.replace(/\D/g, "");
    const { data: matchingClis } = await adminSupabase
      .from("clientes")
      .select("id")
      .or(`whatsapp.eq.${userPhone},whatsapp.ilike.%${cleanPhone.slice(-8)}%`);

    (matchingClis || []).forEach((c) => {
      if (isValidUuid(c.id)) candidateIds.add(c.id);
    });
  }

  if (candidateIds.size === 0) {
    return { proximos: [], historico: [] };
  }

  const { data, error } = await adminSupabase
    .from("agendamentos")
    .select("*, agendamento_servicos(servico_id, preco_cobrado, servicos(*))")
    .in("cliente_id", Array.from(candidateIds))
    .order("inicio", { ascending: false });

  if (error || !data) {
    return { proximos: [], historico: [] };
  }

  const proximos: Agendamento[] = [];
  const historico: Agendamento[] = [];

  for (const item of data) {
    const servicos = (item.agendamento_servicos || []).map((asv: any) => {
      const s = asv.servicos || {};
      const preco = Number(asv.preco_cobrado ?? s.preco ?? 25);
      return {
        ...s,
        preco,
      };
    });

    const valorCalculado = servicos.reduce((acc: number, s: any) => acc + (s.preco || 0), 0);
    const valorFinal =
      Number(item.valor_total) > 0
        ? Number(item.valor_total)
        : valorCalculado > 0
        ? valorCalculado
        : 25;

    const ag: Agendamento = {
      ...item,
      valor_total: valorFinal,
      servicos,
    };

    if (ag.status === "agendado" || ag.status === "confirmado") {
      // Se ainda é futuro ou do dia atual (margem de 2 horas)
      if (new Date(ag.inicio).getTime() >= Date.now() - 7200000) {
        proximos.push(ag);
        continue;
      }
    }
    historico.push(ag);
  }

  proximos.sort((a, b) => (a.inicio > b.inicio ? 1 : -1));

  return { proximos, historico };
}

/** Cancelamento pelo cliente com verificação de multa de 50% */
export async function cancelarMeuAgendamentoAction(
  agendamentoId: string,
  motivo?: string
) {
  try {
    if (!isSupabaseConfigured()) {
      revalidatePath("/meus-agendamentos");
      revalidatePath("/admin/agenda");
      revalidatePath("/admin");
      return { success: true };
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();

    const { data, error } = await adminSupabase.rpc("cancelar_agendamento", {
      p_id: agendamentoId,
      p_motivo: motivo || "Cancelado pelo cliente",
      p_cancelado_por: "cliente",
    });

    if (error) {
      // Contingência direta caso a RPC falhe
      await adminSupabase
        .from("agendamentos")
        .update({
          status: "cancelado",
          cancelado_em: new Date().toISOString(),
          cancelado_por: "cliente",
          motivo_cancelamento: motivo || "Cancelado pelo cliente",
        })
        .eq("id", agendamentoId);
    }

    revalidatePath("/meus-agendamentos");
    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    revalidatePath("/admin/financeiro");
    revalidatePath("/admin/clientes");
    revalidatePath("/agendar");

    return (data || { success: true }) as {
      success: boolean;
      gerou_multa?: boolean;
      valor_multa?: number;
      error?: string;
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao cancelar agendamento";
    return { success: false, error: msg };
  }
}

/** Minhas multas pendentes */
export async function getMinhasMultas(): Promise<Multa[]> {
  const user = await getCurrentUser();
  if (!user) return [];

  if (!isSupabaseConfigured()) return [];

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const adminSupabase = createAdminClient();

  const candidateIds = new Set<string>();
  if (user.clienteId && isValidUuid(user.clienteId)) candidateIds.add(user.clienteId);
  if (user.cliente?.id && isValidUuid(user.cliente.id)) candidateIds.add(user.cliente.id);
  if (user.id && isValidUuid(user.id)) candidateIds.add(user.id);

  if (candidateIds.size === 0) return [];

  const { data } = await adminSupabase
    .from("multas")
    .select("*, agendamento:agendamentos(*)")
    .in("cliente_id", Array.from(candidateIds))
    .eq("status", "pendente")
    .order("criado_em", { ascending: false });

  return (data || []) as Multa[];
}

/** Enviar avaliação do cliente (1 a 5 estrelas) */
export async function enviarAvaliacaoAction(
  agendamentoId: string,
  nota: number,
  comentario?: string
) {
  try {
    const user = await getCurrentUser();
    if (!user?.clienteId) {
      return { success: false, error: "Usuário não autenticado" };
    }

    if (!isSupabaseConfigured()) {
      return { success: true };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("avaliacoes").upsert({
      agendamento_id: agendamentoId,
      cliente_id: user.clienteId,
      nota,
      comentario: comentario || null,
    });

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Erro ao enviar avaliação";
    return { success: false, error: msg };
  }
}

/** Consulta dados consolidados de um agendamento para resumo de orçamento e WhatsApp */
export async function getAgendamentoResumoAction(agendamentoId: string): Promise<{
  id: string;
  clienteNome: string;
  clienteLocalidade?: string | null;
  inicio: string | null;
  valorTotal: number;
  desconto: number;
  observacao: string | null;
  propostaSubtitulo?: string | null;
  propostaObjetivo?: string | null;
  propostaCondicoesPagamento?: string | null;
  propostaItensJson?: import("@/lib/supabase/types").PropostaItemDetalhe[] | null;
  servicos: { nome: string; preco: number; descricao?: string | null; icone?: string }[];
  anexosCount: number;
  anexosUrls?: string[];
} | null> {
  if (!agendamentoId) return null;

  try {
    if (!isSupabaseConfigured()) {
      const { loadStore, mockGetAnexosAgendamento } = await import("@/lib/mock-store");
      const store = loadStore();
      const ag = store.agendamentos.find((a) => a.id === agendamentoId);
      if (!ag) return null;

      const anexos = mockGetAnexosAgendamento(agendamentoId);

      return {
        id: ag.id,
        clienteNome: ag.cliente?.nome || "Cliente",
        clienteLocalidade: ag.cliente_localidade || null,
        inicio: ag.inicio || null,
        valorTotal: Number(ag.valor_total) || 0,
        desconto: Number(ag.desconto) || 0,
        observacao: ag.observacao || null,
        propostaSubtitulo: ag.proposta_subtitulo || null,
        propostaObjetivo: ag.proposta_objetivo || null,
        propostaCondicoesPagamento: ag.proposta_condicoes_pagamento || null,
        propostaItensJson: ag.proposta_itens_json || null,
        servicos: (ag.servicos || []).map((s) => ({
          nome: s.nome,
          preco: Number(s.preco) || 0,
          descricao: s.descricao || null,
          icone: s.icone,
        })),
        anexosCount: anexos.length,
        anexosUrls: anexos.map((a) => a.storage_path),
      };
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();
    const { ANEXOS_BUCKET, ANEXO_SIGNED_URL_TTL } = await import("@/lib/anexos/config");

    const [agRes, anexosRes] = await Promise.all([
      supabase
        .from("agendamentos")
        .select("*, cliente:clientes(nome), agendamento_servicos(preco_cobrado, servicos(nome, preco, descricao, icone))")
        .eq("id", agendamentoId)
        .maybeSingle(),
      supabase
        .from("agendamento_anexos")
        .select("id, storage_path")
        .eq("agendamento_id", agendamentoId)
        .eq("status", "enviado")
        .order("criado_em", { ascending: true }),
    ]);

    if (!agRes.data) return null;
    const ag = agRes.data;

    const servicos = (ag.agendamento_servicos || []).map((asv: any) => ({
      nome: asv.servicos?.nome || "Serviço",
      preco: Number(asv.preco_cobrado ?? asv.servicos?.preco ?? 0),
      descricao: asv.servicos?.descricao || null,
      icone: asv.servicos?.icone,
    }));

    const anexosRows = anexosRes.data || [];
    const anexosUrls: string[] = [];
    for (const row of anexosRows) {
      try {
        const { data: signed } = await supabase.storage
          .from(ANEXOS_BUCKET)
          .createSignedUrl(row.storage_path, ANEXO_SIGNED_URL_TTL);
        if (signed?.signedUrl) {
          anexosUrls.push(signed.signedUrl);
        }
      } catch {
        // ignora erro de assinatura individual
      }
    }

    return {
      id: ag.id,
      clienteNome: (ag.cliente as any)?.nome || "Cliente",
      clienteLocalidade: ag.cliente_localidade || null,
      inicio: ag.inicio || null,
      valorTotal: Number(ag.valor_total) || 0,
      desconto: Number(ag.desconto) || 0,
      observacao: ag.observacao || null,
      propostaSubtitulo: ag.proposta_subtitulo || null,
      propostaObjetivo: ag.proposta_objetivo || null,
      propostaCondicoesPagamento: ag.proposta_condicoes_pagamento || null,
      propostaItensJson: ag.proposta_itens_json || null,
      servicos,
      anexosCount: anexosRows.length,
      anexosUrls,
    };
  } catch (err) {
    console.error("Erro ao buscar resumo do agendamento:", err);
    return null;
  }
}


/** Item enviado pelo editor de proposta. A foto NÃO trafega: é resolvida no servidor por `fotoDe`. */
export interface PropostaItemEditado {
  numero: string;
  identificacao: string;
  servicoNome: string;
  escopo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  icone?: string;
  /** índice do item original cuja foto deve ser mantida (null = sem foto) */
  fotoDe?: number | null;
}

function limpar(v: unknown, max: number): string {
  return String(v ?? "").replace(/\u0000/g, "").trim().slice(0, max);
}

/**
 * Salva a proposta editada (textos, quantidades e, só para o admin, valores/itens).
 * - Admin (Gilmar): pode editar tudo, adicionar/remover itens e alterar preços.
 * - Cliente dono do orçamento: edita textos e quantidades; preços e nº de itens ficam travados.
 */
export async function salvarPropostaAction(params: {
  agendamentoId: string;
  clienteNome?: string;
  clienteWhatsapp?: string;
  clienteLocalidade?: string;
  subtitulo?: string;
  objetivo?: string;
  condicoesPagamento?: string;
  itens: PropostaItemEditado[];
}): Promise<{ success: boolean; valor_total?: number; error?: string }> {
  try {
    const user = await getCurrentUser();
    if (!user) return { success: false, error: "Sessão expirada. Abra o orçamento novamente." };
    const isAdmin = user.role === "admin";

    if (!params.agendamentoId || !Array.isArray(params.itens) || params.itens.length === 0) {
      return { success: false, error: "A proposta precisa ter pelo menos 1 item." };
    }
    if (params.itens.length > 50) return { success: false, error: "Máximo de 50 itens por proposta." };

    type Existente = import("@/lib/supabase/types").PropostaItemDetalhe;
    let existentes: Existente[] = [];
    let clienteIdDono: string | null = null;

    const usarMock = !isSupabaseConfigured();
    if (usarMock) {
      const { loadStore } = await import("@/lib/mock-store");
      const ag = loadStore().agendamentos.find((a) => a.id === params.agendamentoId);
      if (!ag) return { success: false, error: "Orçamento não encontrado." };
      existentes = (ag.proposta_itens_json || []) as Existente[];
      clienteIdDono = ag.cliente_id;
    } else {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const { data: ag } = await createAdminClient()
        .from("agendamentos")
        .select("id, cliente_id, proposta_itens_json")
        .eq("id", params.agendamentoId)
        .maybeSingle();
      if (!ag) return { success: false, error: "Orçamento não encontrado." };
      existentes = (ag.proposta_itens_json || []) as Existente[];
      clienteIdDono = ag.cliente_id;
    }

    if (!isAdmin) {
      const ehDono = !!user.clienteId && user.clienteId === clienteIdDono;
      if (!ehDono) return { success: false, error: "Você não tem permissão para editar este orçamento." };
      if (existentes.length === 0 || params.itens.length !== existentes.length) {
        return { success: false, error: "Somente o Gilmar pode adicionar ou remover itens." };
      }
    }

    const itensFinais: Existente[] = params.itens.map((it, idx) => {
      // Cliente: preço sempre vem do que já está salvo; Admin: vale o que ele digitou
      const original = isAdmin
        ? (it.fotoDe != null ? existentes[it.fotoDe] : undefined)
        : existentes[idx];
      const quantidade = Math.min(999, Math.max(1, Math.floor(Number(it.quantidade) || 1)));
      const valorUnitario = isAdmin
        ? Math.min(10_000_000, Math.max(0, Number(it.valorUnitario) || 0))
        : Number(existentes[idx].valorUnitario) || 0;
      return {
        numero: String(idx + 1).padStart(2, "0"),
        identificacao: limpar(it.identificacao, 120) || `Item ${String(idx + 1).padStart(2, "0")}`,
        servicoNome: limpar(it.servicoNome, 200) || "Serviço elétrico",
        escopo: limpar(it.escopo, 1000),
        descricao: limpar(it.descricao, 2000),
        quantidade,
        valorUnitario,
        valorTotal: Math.round(quantidade * valorUnitario * 100) / 100,
        fotoUrl: original?.fotoUrl ?? null,
        icone: it.icone || original?.icone,
      };
    });

    const valorTotal = Math.round(itensFinais.reduce((a, i) => a + i.valorTotal, 0) * 100) / 100;

    const campos = {
      proposta_subtitulo: limpar(params.subtitulo, 300) || null,
      proposta_objetivo: limpar(params.objetivo, 2000) || null,
      proposta_condicoes_pagamento: limpar(params.condicoesPagamento, 1000) || null,
      cliente_localidade: limpar(params.clienteLocalidade, 200) || null,
      proposta_itens_json: itensFinais,
      valor_total: valorTotal,
    };
    const nome = limpar(params.clienteNome, 120);
    const whatsapp = (params.clienteWhatsapp || "").replace(/\D/g, "");

    if (usarMock) {
      const { loadStore, saveStore } = await import("@/lib/mock-store");
      const store = loadStore();
      const ag = store.agendamentos.find((a) => a.id === params.agendamentoId);
      if (ag) {
        Object.assign(ag, campos);
        if (ag.cliente && nome.length >= 2) ag.cliente.nome = nome;
        saveStore(store);
      }
    } else {
      const { createAdminClient } = await import("@/lib/supabase/admin");
      const sb = createAdminClient();
      const { error } = await sb.from("agendamentos").update(campos).eq("id", params.agendamentoId);
      if (error) return { success: false, error: error.message };

      if (clienteIdDono) {
        const upd: Record<string, string> = {};
        if (nome.length >= 2) upd.nome = nome;
        if (isAdmin && whatsapp.length >= 8) upd.whatsapp = whatsapp;
        if (Object.keys(upd).length > 0) {
          // WhatsApp é único: se colidir com outro cliente, ignora só essa parte
          const r = await sb.from("clientes").update(upd).eq("id", clienteIdDono);
          if (r.error && upd.whatsapp) {
            delete upd.whatsapp;
            if (Object.keys(upd).length > 0) await sb.from("clientes").update(upd).eq("id", clienteIdDono);
          }
        }
      }
    }

    revalidatePath("/admin/agenda");
    revalidatePath("/admin");
    revalidatePath("/admin/clientes");
    revalidatePath("/admin/financeiro");
    revalidatePath("/meus-agendamentos");
    revalidatePath("/agendamento/sucesso");

    return { success: true, valor_total: valorTotal };
  } catch (err: unknown) {
    return { success: false, error: err instanceof Error ? err.message : "Erro ao salvar a proposta." };
  }
}
