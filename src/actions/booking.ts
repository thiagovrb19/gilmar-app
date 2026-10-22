"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "./auth";
import { Servico, Configuracao, Agendamento, Multa } from "@/lib/supabase/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

const DEFAULT_SERVICOS: Servico[] = [
  {
    id: "c0000000-0000-0000-0000-000000000001",
    nome: "Troca de lâmpadas e luminárias",
    descricao: "Troca de lâmpadas, luminárias simples e spots.",
    preco: 50.0,
    duracao_min: 45,
    icone: "lampada",
    tipo: "avulso",
    ativo: true,
    ordem: 1,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000002",
    nome: "Troca de chuveiro",
    descricao: "Desinstalação do chuveiro antigo e instalação do novo.",
    preco: 120.0,
    duracao_min: 60,
    icone: "chuveiro",
    tipo: "avulso",
    ativo: true,
    ordem: 2,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000003",
    nome: "Troca de tomadas e interruptores",
    descricao: "Troca de tomadas ou interruptores simples.",
    preco: 40.0,
    duracao_min: 30,
    icone: "tomada",
    tipo: "avulso",
    ativo: true,
    ordem: 3,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000004",
    nome: "Troca de disjuntor",
    descricao: "Substituição de disjuntor no quadro de distribuição.",
    preco: 60.0,
    duracao_min: 45,
    icone: "quadro",
    tipo: "avulso",
    ativo: true,
    ordem: 4,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000005",
    nome: "Instalação de tomadas e interruptores",
    descricao: "Instalação de novos pontos de tomadas ou interruptores.",
    preco: 90.0,
    duracao_min: 60,
    icone: "tomada",
    tipo: "avulso",
    ativo: true,
    ordem: 5,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000006",
    nome: "Instalação de ventiladores e luminárias",
    descricao: "Instalação completa de ventiladores ou luminárias.",
    preco: 120.0,
    duracao_min: 90,
    icone: "lampada",
    tipo: "avulso",
    ativo: true,
    ordem: 6,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000007",
    nome: "Ligação de padrão (monofásico)",
    descricao: "Instalação do padrão de entrada monofásico.",
    preco: 450.0,
    duracao_min: 180,
    icone: "padrao",
    tipo: "avulso",
    ativo: true,
    ordem: 7,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000008",
    nome: "Ligação de padrão (trifásico)",
    descricao: "Instalação do padrão de entrada trifásico.",
    preco: 750.0,
    duracao_min: 240,
    icone: "padrao",
    tipo: "avulso",
    ativo: true,
    ordem: 8,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000009",
    nome: "Montagem de quadro de distribuição",
    descricao: "Montagem completa de quadro de distribuição.",
    preco: 600.0,
    duracao_min: 180,
    icone: "quadro",
    tipo: "avulso",
    ativo: true,
    ordem: 9,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000010",
    nome: "Manutenção elétrica industrial",
    descricao: "Manutenção preventiva e corretiva em máquinas e painéis industriais (R$ 60,00/h).",
    preco: 60.0,
    duracao_min: 60,
    icone: "industrial",
    tipo: "avulso",
    ativo: true,
    ordem: 10,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000011",
    nome: "Instalação de motores elétricos",
    descricao: "Instalação e ligação de motores monofásicos ou trifásicos.",
    preco: 250.0,
    duracao_min: 120,
    icone: "industrial",
    tipo: "avulso",
    ativo: true,
    ordem: 11,
    criado_em: "2026-01-01T00:00:00Z",
  },
  {
    id: "c0000000-0000-0000-0000-000000000012",
    nome: "Instalação de inversores de frequência",
    descricao: "Instalação e parametrização básica de inversores de frequência.",
    preco: 400.0,
    duracao_min: 120,
    icone: "industrial",
    tipo: "avulso",
    ativo: true,
    ordem: 12,
    criado_em: "2026-01-01T00:00:00Z",
  },
];

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
  { dia_semana: 0, abre: "09:00:00", fecha: "18:00:00", ativo: false }, // Domingo fechado
  { dia_semana: 1, abre: "17:00:00", fecha: "21:00:00", ativo: true },  // Segunda
  { dia_semana: 2, abre: "17:00:00", fecha: "21:00:00", ativo: true },  // Terça
  { dia_semana: 3, abre: "17:00:00", fecha: "21:00:00", ativo: true },  // Quarta
  { dia_semana: 4, abre: "17:00:00", fecha: "21:00:00", ativo: true },  // Quinta
  { dia_semana: 5, abre: "17:00:00", fecha: "21:00:00", ativo: true },  // Sexta
  { dia_semana: 6, abre: "12:00:00", fecha: "18:00:00", ativo: true },  // Sábado (12:00 às 18:00)
];

/** Busca serviços ativos e combos ordenados */
export async function getServicos(apenasAtivos: boolean = true): Promise<Servico[]> {
  if (!isSupabaseConfigured()) {
    return apenasAtivos ? DEFAULT_SERVICOS.filter((s) => s.ativo) : DEFAULT_SERVICOS;
  }

  let supabase: any;
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    supabase = createAdminClient();
  } catch {
    supabase = await createClient();
  }

  let query = supabase
    .from("servicos")
    .select("*")
    .order("ordem", { ascending: true });

  if (apenasAtivos) {
    query = query.eq("ativo", true);
  }

  const { data, error } = await query;

  if (error || !data || data.length === 0) {
    if (error) {
      console.error("Erro ao buscar serviços no Supabase:", error);
    }

    // Se a tabela existe mas está vazia no banco, insere os serviços padrão automaticamente
    if (!error && data && data.length === 0) {
      try {
        const { data: seeded } = await supabase
          .from("servicos")
          .upsert(DEFAULT_SERVICOS)
          .select("*")
          .order("ordem", { ascending: true });

        if (seeded && seeded.length > 0) {
          return apenasAtivos ? (seeded as Servico[]).filter((s) => s.ativo) : (seeded as Servico[]);
        }
      } catch (seedErr) {
        console.error("Erro ao fazer seed de serviços no Supabase:", seedErr);
      }
    }

    return apenasAtivos ? DEFAULT_SERVICOS.filter((s) => s.ativo) : DEFAULT_SERVICOS;
  }

  return data as Servico[];
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

    // Se não há exceção personalizada, usa a grade padrão da semana
    if (horas.length === 0 && !excecao) {
      if (dayOfWeek === 0) {
        // Domingo fechado por padrão
        return [];
      }
      horas =
        dayOfWeek === 6
          ? ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
          : ["17:00", "18:00", "19:00", "20:00"];
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

  if (error || !data) {
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
          ? ["12:00", "13:00", "14:00", "15:00", "16:00", "17:00"]
          : ["17:00", "18:00", "19:00", "20:00"];
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

/** Criação de agendamento validado no servidor */
export async function criarAgendamentoAction(params: {
  servicosIds: string[];
  inicio: string;
  observacao?: string;
  clienteId?: string;
}): Promise<{
  success: boolean;
  agendamento_id?: string;
  valor_total?: number;
  desconto?: number;
  error?: string;
}> {
  try {
    let finalClienteId = params.clienteId;

    if (!finalClienteId) {
      const user = await getCurrentUser();
      if (!user?.clienteId) {
        return {
          success: false,
          error: "Você precisa estar conectado para confirmar o agendamento.",
        };
      }
      finalClienteId = user.clienteId;
    }

    if (!isSupabaseConfigured()) {
      const { mockCriarAgendamento } = await import("@/lib/mock-store");
      const res = mockCriarAgendamento({
        clienteId: finalClienteId!,
        servicosIds: params.servicosIds,
        inicio: params.inicio,
        observacao: params.observacao,
        origem: "app",
      });
      revalidatePath("/admin/agenda");
      revalidatePath("/admin");
      revalidatePath("/meus-agendamentos");
      revalidatePath("/agendar");

      return {
        success: true,
        agendamento_id: res.agendamento.id,
        valor_total: res.agendamento.valor_total,
      };
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const adminSupabase = createAdminClient();

    // 1. Resolve o ID real do cliente na tabela public.clientes (caso venha o user_id do auth)
    let clienteIdReal: string | null = null;

    if (finalClienteId && isValidUuid(finalClienteId)) {
      try {
        // 1.1 Tenta achar cliente por id direto
        const { data: cById } = await adminSupabase
          .from("clientes")
          .select("id")
          .eq("id", finalClienteId)
          .maybeSingle();

        if (cById?.id) {
          clienteIdReal = cById.id;
        } else {
          // 1.2 Tenta achar cliente por user_id (caso finalClienteId seja o id do auth.users)
          const { data: cByUser } = await adminSupabase
            .from("clientes")
            .select("id")
            .eq("user_id", finalClienteId)
            .maybeSingle();

          if (cByUser?.id) {
            clienteIdReal = cByUser.id;
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
        // continua para busca por telefone
      }
    }

    // 1.4 Se não achou por UUID (ou se finalClienteId era inválido), busca por telefone ou cadastra novo
    if (!clienteIdReal) {
      const user = await getCurrentUser();
      const userPhone = user?.cliente?.whatsapp;
      const userName = user?.cliente?.nome || "Cliente";

      if (userPhone) {
        const cleanPhone = userPhone.replace(/\D/g, "");
        const { data: cByPhone } = await adminSupabase
          .from("clientes")
          .select("id")
          .or(`whatsapp.eq.${userPhone},whatsapp.ilike.%${cleanPhone.slice(-8)}%`)
          .maybeSingle();

        if (cByPhone?.id) {
          clienteIdReal = cByPhone.id;
        }
      }

      if (!clienteIdReal) {
        const { data: newCli } = await adminSupabase
          .from("clientes")
          .insert({
            nome: userName,
            whatsapp: userPhone || "32999999999",
            data_nascimento: user?.cliente?.data_nascimento || null,
          })
          .select("id")
          .single();

        if (newCli?.id) {
          clienteIdReal = newCli.id;
        }
      }
    }

    if (!clienteIdReal || !isValidUuid(clienteIdReal)) {
      return {
        success: false,
        error: "Não foi possível identificar sua conta de cliente. Por favor, entre novamente no aplicativo.",
      };
    }

    // 2. Validação estrita de conflito no servidor antes de confirmar
    const duracaoMin = 60;
    const inicioDate = new Date(params.inicio);
    const fimDate = new Date(inicioDate.getTime() + duracaoMin * 60000);

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
        error: `Este horário está bloqueado pelo barbeiro (${conflitoBlq.motivo || "Indisponível"}).`,
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
      revalidatePath("/admin/agenda");
      revalidatePath("/admin");
      revalidatePath("/admin/financeiro");
      revalidatePath("/admin/clientes");
      revalidatePath("/meus-agendamentos");
      revalidatePath("/agendar");

      return rpcData as {
        success: boolean;
        agendamento_id?: string;
        valor_total?: number;
        desconto?: number;
        error?: string;
      };
    }

    // 4. Inserção direta de contingência via Admin Client
    const { data: servicosDb } = await adminSupabase
      .from("servicos")
      .select("id, preco")
      .in("id", params.servicosIds);

    const valorTotal = (servicosDb || []).reduce((acc, s) => acc + Number(s.preco), 0);

    const { data: novoAg, error: agErr } = await adminSupabase
      .from("agendamentos")
      .insert({
        cliente_id: clienteIdReal,
        inicio: params.inicio,
        fim: fimDate.toISOString(),
        status: "agendado",
        origem: "app",
        valor_total: valorTotal > 0 ? valorTotal : 25,
        desconto: 0,
        observacao: params.observacao || null,
      })
      .select("id")
      .single();

    if (agErr || !novoAg) {
      return { success: false, error: agErr?.message || rpcError?.message || "Erro ao agendar" };
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
    revalidatePath("/meus-agendamentos");
    revalidatePath("/agendar");

    return {
      success: true,
      agendamento_id: novoAg.id,
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
  inicio: string | null;
  valorTotal: number;
  desconto: number;
  observacao: string | null;
  servicos: { nome: string; preco: number }[];
  anexosCount: number;
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
        inicio: ag.inicio || null,
        valorTotal: Number(ag.valor_total) || 0,
        desconto: Number(ag.desconto) || 0,
        observacao: ag.observacao || null,
        servicos: (ag.servicos || []).map((s) => ({
          nome: s.nome,
          preco: Number(s.preco) || 0,
        })),
        anexosCount: anexos.length,
      };
    }

    const { createAdminClient } = await import("@/lib/supabase/admin");
    const supabase = createAdminClient();

    const [agRes, anexosRes] = await Promise.all([
      supabase
        .from("agendamentos")
        .select("*, cliente:clientes(nome), agendamento_servicos(preco_cobrado, servicos(nome, preco))")
        .eq("id", agendamentoId)
        .maybeSingle(),
      supabase
        .from("agendamento_anexos")
        .select("id", { count: "exact", head: true })
        .eq("agendamento_id", agendamentoId)
        .eq("status", "enviado"),
    ]);

    if (!agRes.data) return null;
    const ag = agRes.data;

    const servicos = (ag.agendamento_servicos || []).map((asv: any) => ({
      nome: asv.servicos?.nome || "Serviço",
      preco: Number(asv.preco_cobrado ?? asv.servicos?.preco ?? 0),
    }));

    return {
      id: ag.id,
      clienteNome: (ag.cliente as any)?.nome || "Cliente",
      inicio: ag.inicio || null,
      valorTotal: Number(ag.valor_total) || 0,
      desconto: Number(ag.desconto) || 0,
      observacao: ag.observacao || null,
      servicos,
      anexosCount: anexosRes.count || 0,
    };
  } catch (err) {
    console.error("Erro ao buscar resumo do agendamento:", err);
    return null;
  }
}

