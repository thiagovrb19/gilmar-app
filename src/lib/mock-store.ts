import fs from "fs";
import path from "path";
import { Agendamento, Cliente, HorarioFixo, Bloqueio, Multa, Servico, ClienteEstatistica, AgendamentoOrigem, Lancamento } from "./supabase/types";

export const DEMO_SERVICOS_STATIC: Servico[] = [
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
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
    criado_em: new Date().toISOString(),
  },
];

interface MockDataStore {
  clientes: Cliente[];
  agendamentos: Agendamento[];
  horariosFixos: HorarioFixo[];
  bloqueios: Bloqueio[];
  multas: Multa[];
  diasExcecao?: import("./supabase/types").DiaExcecao[];
  lancamentos?: Lancamento[];
  servicos?: Servico[];
  anexos?: import("./supabase/types").AgendamentoAnexo[];
}

const STORE_PATH = path.join(process.cwd(), ".local-data", "mock-db.json");

function getInitialData(): MockDataStore {
  const hoje = new Date().toISOString().split("T")[0];
  return {
    clientes: [
      {
        id: "c-1",
        nome: "Pedro Silva",
        whatsapp: "32999112233",
        data_nascimento: "1995-05-10",
        user_id: null,
        observacoes: null,
        aceite_lgpd_em: `${hoje}T08:00:00Z`,
        criado_em: "2026-01-01T00:00:00Z",
      },
      {
        id: "c-2",
        nome: "Carlos Oliveira",
        whatsapp: "32988445566",
        data_nascimento: null,
        user_id: null,
        observacoes: null,
        aceite_lgpd_em: `${hoje}T08:00:00Z`,
        criado_em: "2026-01-01T00:00:00Z",
      },
      {
        id: "c-3",
        nome: "Marcos Lima",
        whatsapp: "32991234567",
        data_nascimento: null,
        user_id: null,
        observacoes: null,
        aceite_lgpd_em: `${hoje}T08:00:00Z`,
        criado_em: "2026-01-01T00:00:00Z",
      },
    ],
    agendamentos: [
      {
        id: "demo-ag-1",
        cliente_id: "c-1",
        inicio: `${hoje}T17:00:00-03:00`,
        fim: `${hoje}T18:00:00-03:00`,
        status: "agendado",
        origem: "app",
        horario_fixo_id: null,
        valor_total: 180.0,
        desconto: 0,
        pago: false,
        forma_pagamento: "pix",
        usou_credito: false,
        cancelado_em: null,
        cancelado_por: null,
        motivo_cancelamento: null,
        observacao: "Quadro com desarmes repentinos ao ligar o chuveiro.",
        criado_em: `${hoje}T10:00:00Z`,
        cliente: {
          id: "c-1",
          nome: "Pedro Silva",
          whatsapp: "32999112233",
          data_nascimento: "1995-05-10",
          user_id: null,
          observacoes: null,
          aceite_lgpd_em: `${hoje}T08:00:00Z`,
          criado_em: "2026-01-01T00:00:00Z",
        },
        servicos: [DEMO_SERVICOS_STATIC[1]],
      },
    ],
    horariosFixos: [],
    bloqueios: [],
    multas: [],
    diasExcecao: [],
    anexos: [],
    lancamentos: [
      {
        id: "l-1",
        tipo: "entrada",
        categoria: "Serviço Elétrico",
        descricao: "Adequação de Quadro de Distribuição - Pedro Silva",
        valor: 180.0,
        data: hoje,
        forma_pagamento: "pix",
        agendamento_id: "demo-ag-1",
        multa_id: null,
        cliente_id: "c-1",
        criado_em: `${hoje}T10:00:00Z`,
      },
      {
        id: "l-2",
        tipo: "entrada",
        categoria: "Serviço Elétrico",
        descricao: "Instalação de Chuveiro Elétrico - Carlos Oliveira",
        valor: 60.0,
        data: hoje,
        forma_pagamento: "pix",
        agendamento_id: "demo-ag-2",
        multa_id: null,
        cliente_id: "c-2",
        criado_em: `${hoje}T11:00:00Z`,
      },
    ],
  };
}

let memoryStore: MockDataStore | null = null;

export function loadStore(): MockDataStore {
  if (memoryStore) {
    if (!memoryStore.diasExcecao) memoryStore.diasExcecao = [];
    if (!memoryStore.bloqueios) memoryStore.bloqueios = [];
    if (!memoryStore.lancamentos) memoryStore.lancamentos = [];
    if (!memoryStore.anexos) memoryStore.anexos = [];
    return memoryStore;
  }

  try {
    if (fs.existsSync(STORE_PATH)) {
      const content = fs.readFileSync(STORE_PATH, "utf-8");
      memoryStore = JSON.parse(content);
      if (memoryStore) {
        if (!memoryStore.diasExcecao) memoryStore.diasExcecao = [];
        if (!memoryStore.bloqueios) memoryStore.bloqueios = [];
        if (!memoryStore.horariosFixos) memoryStore.horariosFixos = [];
        if (!memoryStore.lancamentos) memoryStore.lancamentos = [];
        if (!memoryStore.anexos) memoryStore.anexos = [];
      }
      return memoryStore!;
    }
  } catch (e) {
    console.error("Falha ao ler mock-db.json, usando padrão:", e);
  }

  memoryStore = getInitialData();
  saveStore(memoryStore);
  return memoryStore;
}

export function saveStore(data: MockDataStore) {
  memoryStore = data;
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  } catch (e) {
    console.error("Falha ao persistir mock-db.json:", e);
  }
}

/** Salva ou atualiza um cliente, preservando data_nascimento e campos já existentes */
export function mockUpsertCliente(c: Partial<Cliente> & { id: string; nome: string; whatsapp: string }): Cliente {
  const store = loadStore();
  const existingIndex = store.clientes.findIndex((item) => item.id === c.id || item.whatsapp === c.whatsapp);
  const existing = existingIndex >= 0 ? store.clientes[existingIndex] : null;
  const now = new Date().toISOString();

  // Preserva data_nascimento se não for passada explicitamente
  const dataNascimentoFinal =
    c.data_nascimento !== undefined
      ? (c.data_nascimento || null)
      : (existing?.data_nascimento || null);

  const fullCliente: Cliente = {
    id: c.id,
    nome: c.nome,
    whatsapp: c.whatsapp,
    data_nascimento: dataNascimentoFinal,
    user_id: c.user_id || existing?.user_id || c.id,
    observacoes: c.observacoes !== undefined ? c.observacoes : (existing?.observacoes || null),
    aceite_lgpd_em: c.aceite_lgpd_em || existing?.aceite_lgpd_em || now,
    criado_em: existing?.criado_em || c.criado_em || now,
  };

  if (existingIndex >= 0) {
    store.clientes[existingIndex] = fullCliente;
  } else {
    store.clientes.push(fullCliente);
  }

  saveStore(store);
  return fullCliente;
}

/** Exclui um cliente e seus agendamentos/registros do mock store */
export function mockExcluirCliente(clienteId: string): boolean {
  const store = loadStore();
  const initialCount = store.clientes.length;
  store.clientes = store.clientes.filter((item) => item.id !== clienteId);
  store.agendamentos = store.agendamentos.filter((item) => item.cliente_id !== clienteId);
  store.horariosFixos = store.horariosFixos.filter((item) => item.cliente_id !== clienteId);
  store.multas = store.multas.filter((item) => item.cliente_id !== clienteId);
  saveStore(store);
  return store.clientes.length < initialCount;
}

/** Cria agendamento no store local */
export function mockCriarAgendamento(params: {
  clienteId: string;
  servicosIds: string[];
  inicio: string;
  observacao?: string;
  origem?: AgendamentoOrigem;
}): { success: boolean; agendamento: Agendamento; error?: string } {
  const store = loadStore();

  let cliente = store.clientes.find((c) => c.id === params.clienteId);
  if (!cliente) {
    cliente = {
      id: params.clienteId,
      nome: "Cliente",
      whatsapp: "32999999999",
      data_nascimento: null,
      user_id: params.clienteId,
      observacoes: null,
      aceite_lgpd_em: new Date().toISOString(),
      criado_em: new Date().toISOString(),
    };
    store.clientes.push(cliente);
  }

  const servicosMarcados = DEMO_SERVICOS_STATIC.filter((s) => params.servicosIds.includes(s.id));
  const valorTotal = servicosMarcados.reduce((acc, s) => acc + s.preco, 0);

  // Calcula fim (60min padrão)
  const inicioDate = new Date(params.inicio);
  const fimDate = new Date(inicioDate.getTime() + 60 * 60 * 1000);
  const fimStr = fimDate.toISOString();

  const novoAg: Agendamento = {
    id: "ag-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
    cliente_id: cliente.id,
    inicio: params.inicio,
    fim: fimStr,
    status: "agendado",
    origem: params.origem || "app",
    horario_fixo_id: null,
    valor_total: valorTotal > 0 ? valorTotal : 25.0,
    desconto: 0,
    pago: false,
    forma_pagamento: "pix",
    usou_credito: false,
    cancelado_em: null,
    cancelado_por: null,
    motivo_cancelamento: null,
    observacao: params.observacao || null,
    criado_em: new Date().toISOString(),
    cliente,
    servicos: servicosMarcados.length > 0 ? servicosMarcados : [DEMO_SERVICOS_STATIC[0]],
  };

  store.agendamentos.push(novoAg);
  saveStore(store);

  return { success: true, agendamento: novoAg };
}

/** Busca agendamentos de um cliente específico */
export function mockGetAgendamentosCliente(clienteId: string): {
  proximos: Agendamento[];
  historico: Agendamento[];
} {
  const store = loadStore();
  const now = new Date().toISOString();

  const doCliente = store.agendamentos.filter((a) => a.cliente_id === clienteId);

  const proximos: Agendamento[] = [];
  const historico: Agendamento[] = [];

  for (const ag of doCliente) {
    if (ag.status === "agendado" || ag.status === "confirmado") {
      if (ag.inicio >= now) {
        proximos.push(ag);
        continue;
      }
    }
    historico.push(ag);
  }

  proximos.sort((a, b) => (a.inicio > b.inicio ? 1 : -1));
  historico.sort((a, b) => (a.inicio < b.inicio ? 1 : -1));

  return { proximos, historico };
}

/** Busca horários ocupados para uma data (YYYY-MM-DD) */
export function mockGetHorasOcupadas(dataStr: string): Set<string> {
  const store = loadStore();
  const ocupadas = new Set<string>();

  // 1. Agendamentos ativos do dia
  for (const ag of store.agendamentos) {
    if (ag.status === "cancelado") continue;
    if (ag.inicio.startsWith(dataStr)) {
      try {
        const hora = ag.inicio.substring(11, 16);
        ocupadas.add(hora);
      } catch {
        // ignora
      }
    }
  }

  // 2. Bloqueios que colidem com este dia
  for (const b of (store.bloqueios || [])) {
    if (b.inicio.startsWith(dataStr) || b.fim.startsWith(dataStr)) {
      try {
        const bHoraInicio = parseInt(b.inicio.substring(11, 13));
        const bHoraFim = parseInt(b.fim.substring(11, 13));
        for (let h = bHoraInicio; h < (bHoraFim || bHoraInicio + 1); h++) {
          ocupadas.add(`${h.toString().padStart(2, "0")}:00`);
        }
      } catch {
        // ignora
      }
    }
  }

  // 3. Horários fixos do dia da semana
  try {
    const dayOfWeek = new Date(`${dataStr}T12:00:00`).getDay();
    for (const f of (store.horariosFixos || [])) {
      if (f.ativo && f.dia_semana === dayOfWeek) {
        ocupadas.add(f.hora.substring(0, 5));
      }
    }
  } catch {
    // ignora
  }

  return ocupadas;
}

/** Busca exceções de horários / dias especiais */
export function mockGetDiasExcecao(inicioStr?: string, fimStr?: string): import("./supabase/types").DiaExcecao[] {
  const store = loadStore();
  const list = store.diasExcecao || [];
  if (!inicioStr || !fimStr) return list;

  const inDia = inicioStr.substring(0, 10);
  const fiDia = fimStr.substring(0, 10);
  return list.filter((d) => d.data >= inDia && d.data <= fiDia);
}

/** Busca exceção de uma data específica */
export function mockGetDiaExcecao(dataStr: string): import("./supabase/types").DiaExcecao | null {
  const store = loadStore();
  const dia = dataStr.substring(0, 10);
  return (store.diasExcecao || []).find((d) => d.data === dia) || null;
}

/** Salva ou atualiza a exceção / personalização de horário de uma data */
export function mockSalvarDiaExcecao(excecao: {
  data: string;
  tipo: import("./supabase/types").DiaExcecaoTipo;
  motivo?: string | null;
  abre?: string | null;
  fecha?: string | null;
  horarios_especificos?: string[] | null;
}): import("./supabase/types").DiaExcecao {
  const store = loadStore();
  if (!store.diasExcecao) store.diasExcecao = [];

  const dataDia = excecao.data.substring(0, 10);
  const existingIndex = store.diasExcecao.findIndex((d) => d.data === dataDia);

  const nova: import("./supabase/types").DiaExcecao = {
    id: existingIndex >= 0 ? store.diasExcecao[existingIndex].id : "excecao-" + Date.now().toString(36),
    data: dataDia,
    tipo: excecao.tipo,
    motivo: excecao.motivo || null,
    abre: excecao.abre || null,
    fecha: excecao.fecha || null,
    horarios_especificos: excecao.horarios_especificos || null,
    criado_em: new Date().toISOString(),
  };

  if (existingIndex >= 0) {
    store.diasExcecao[existingIndex] = nova;
  } else {
    store.diasExcecao.push(nova);
  }

  saveStore(store);
  return nova;
}

/** Remove a exceção de um dia (restaura horário padrão da semana) */
export function mockRemoverDiaExcecao(dataStr: string): boolean {
  const store = loadStore();
  if (!store.diasExcecao) return false;

  const dataDia = dataStr.substring(0, 10);
  const initialLen = store.diasExcecao.length;
  store.diasExcecao = store.diasExcecao.filter((d) => d.data !== dataDia);
  saveStore(store);
  return store.diasExcecao.length < initialLen;
}

/** Criar bloqueio no mock store */
export function mockCriarBloqueio(inicio: string, fim: string, motivo: string): Bloqueio {
  const store = loadStore();
  if (!store.bloqueios) store.bloqueios = [];

  const novoBloqueio: Bloqueio = {
    id: "blq-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
    inicio,
    fim,
    motivo: motivo || "Bloqueio de agenda",
    criado_em: new Date().toISOString(),
  };

  store.bloqueios.push(novoBloqueio);
  saveStore(store);
  return novoBloqueio;
}

/** Excluir bloqueio no mock store */
export function mockExcluirBloqueio(bloqueioId: string): boolean {
  const store = loadStore();
  if (!store.bloqueios) return false;

  const initialLen = store.bloqueios.length;
  store.bloqueios = store.bloqueios.filter((b) => b.id !== bloqueioId);
  saveStore(store);
  return store.bloqueios.length < initialLen;
}

/** Busca agendamentos e estatísticas para o Admin */
export function mockGetAdminPeriodo(inicioStr: string, fimStr: string): {
  agendamentos: Agendamento[];
  bloqueios: Bloqueio[];
  horariosFixos: HorarioFixo[];
  diasExcecao: import("./supabase/types").DiaExcecao[];
} {
  const store = loadStore();

  const inicioDia = inicioStr.substring(0, 10);
  const fimDia = fimStr.substring(0, 10);

  const agendamentos = store.agendamentos.filter((ag) => {
    const agDia = ag.inicio.substring(0, 10);
    return agDia >= inicioDia && agDia <= fimDia;
  });

  return {
    agendamentos,
    bloqueios: store.bloqueios || [],
    horariosFixos: store.horariosFixos || [],
    diasExcecao: store.diasExcecao || [],
  };
}

/** Dashboard do Admin para Hoje */
export function mockGetDashboardHoje(hojeStr: string) {
  const store = loadStore();
  const agendamentosHoje = store.agendamentos.filter(
    (ag) => ag.inicio.startsWith(hojeStr) && ag.status !== "cancelado"
  );

  const concluidosHoje = agendamentosHoje.filter((a) => a.status === "concluido").length;
  const faturamentoHoje = agendamentosHoje
    .filter((a) => a.status === "concluido" && a.pago)
    .reduce((acc, a) => acc + (a.valor_total || 0), 0);

  return {
    agendamentosHoje,
    metricas: {
      faturamentoHoje,
      atendimentosHojeCount: agendamentosHoje.length,
      concluidosHojeCount: concluidosHoje,
    },
    alertas: {
      clientesSumidos: [],
      aniversariantesSemana: [],
      multasPendentes: (store.multas || []).filter((m) => m.status === "pendente"),
    },
  };
}

/** Conclui atendimento no mock store e gera lançamento financeiro */
export function mockConcluirAgendamento(params: {
  id: string;
  formaPagamento: import("./supabase/types").FormaPagamento;
  pago: boolean;
  usarCredito: boolean;
}): { success: boolean; error?: string } {
  const store = loadStore();
  const agIndex = store.agendamentos.findIndex((a) => a.id === params.id);
  if (agIndex < 0) {
    return { success: false, error: "Agendamento não encontrado" };
  }

  const ag = store.agendamentos[agIndex];
  ag.status = "concluido";
  ag.forma_pagamento = params.formaPagamento;
  ag.pago = params.pago;
  ag.usou_credito = params.usarCredito;

  if (!store.lancamentos) store.lancamentos = [];

  // Se o cliente pagou e não foi crédito pré-pago, gera lançamento financeiro de entrada
  if (params.pago && !params.usarCredito && (ag.valor_total || 0) > 0) {
    const hojeStr = new Date().toISOString().split("T")[0];
    const novoLancamento: Lancamento = {
      id: "lanc-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
      tipo: "entrada",
      categoria: "Atendimento",
      descricao: `Atendimento concluído - ${ag.cliente?.nome || "Cliente"}`,
      valor: ag.valor_total,
      data: hojeStr,
      forma_pagamento: params.formaPagamento,
      agendamento_id: ag.id,
      multa_id: null,
      cliente_id: ag.cliente_id,
      criado_em: new Date().toISOString(),
      cliente: ag.cliente,
    };
    store.lancamentos.unshift(novoLancamento);
  }

  saveStore(store);
  return { success: true };
}

/** Marca não compareceu no mock store e gera multa */
export function mockMarcarNaoCompareceu(id: string): { success: boolean; error?: string } {
  const store = loadStore();
  const agIndex = store.agendamentos.findIndex((a) => a.id === id);
  if (agIndex < 0) return { success: false, error: "Agendamento não encontrado" };

  const ag = store.agendamentos[agIndex];
  ag.status = "nao_compareceu";

  // Gera multa de 50%
  const valorMulta = Math.round((ag.valor_total || 25) * 0.5);
  const novaMulta: Multa = {
    id: "m-" + Date.now().toString(36),
    cliente_id: ag.cliente_id,
    agendamento_id: ag.id,
    valor: valorMulta,
    status: "pendente",
    criado_em: new Date().toISOString(),
    pago_em: null,
    cliente: ag.cliente,
    agendamento: ag,
  };
  if (!store.multas) store.multas = [];
  store.multas.push(novaMulta);

  saveStore(store);
  return { success: true };
}

/** Cancela agendamento no mock store */
export function mockCancelarAgendamento(id: string, motivo?: string): { success: boolean; error?: string } {
  const store = loadStore();
  const agIndex = store.agendamentos.findIndex((a) => a.id === id);
  if (agIndex < 0) return { success: false, error: "Agendamento não encontrado" };

  const ag = store.agendamentos[agIndex];
  ag.status = "cancelado";
  ag.motivo_cancelamento = motivo || "Cancelado pelo admin";
  ag.cancelado_em = new Date().toISOString();
  ag.cancelado_por = "admin";

  saveStore(store);
  return { success: true };
}

/** Cria lançamento financeiro manual no mock store */
export function mockCriarLancamento(data: {
  tipo: "entrada" | "saida";
  categoria: string;
  descricao: string;
  valor: number;
  data: string;
  formaPagamento?: import("./supabase/types").FormaPagamento;
}): Lancamento {
  const store = loadStore();
  if (!store.lancamentos) store.lancamentos = [];

  const novo: Lancamento = {
    id: "lanc-" + Date.now().toString(36) + "-" + Math.random().toString(36).substring(2, 6),
    tipo: data.tipo,
    categoria: data.categoria,
    descricao: data.descricao,
    valor: data.valor,
    data: data.data,
    forma_pagamento: data.formaPagamento || null,
    agendamento_id: null,
    multa_id: null,
    cliente_id: null,
    criado_em: new Date().toISOString(),
  };

  store.lancamentos.unshift(novo);
  saveStore(store);
  return novo;
}

/** Busca dados financeiros consolidados no mock store */
export function mockGetFinanceiro(): {
  lancamentos: Lancamento[];
  pendencias: Agendamento[];
  agendamentosPrevistos: Agendamento[];
  faturamentoPrevistoTotal: number;
  multasPendentes: Multa[];
} {
  const store = loadStore();
  const lancamentos = (store.lancamentos || []).map((l) => {
    if (!l.cliente && l.cliente_id) {
      const cli = store.clientes.find((c) => c.id === l.cliente_id);
      return { ...l, cliente: cli };
    }
    return l;
  });

  const pendencias = store.agendamentos.filter(
    (a) => a.status === "concluido" && a.pago === false
  );

  const agendamentosPrevistos = store.agendamentos.filter(
    (a) => a.status === "agendado" || a.status === "confirmado"
  );

  const faturamentoPrevistoTotal = agendamentosPrevistos.reduce(
    (acc, a) => acc + Number(a.valor_total || 0),
    0
  );

  const multasPendentes = (store.multas || []).filter((m) => m.status === "pendente");

  return {
    lancamentos,
    pendencias,
    agendamentosPrevistos,
    faturamentoPrevistoTotal,
    multasPendentes,
  };
}

/** Lista de clientes com estatísticas calculadas */
export function mockGetClientesComStats(): ClienteEstatistica[] {
  const store = loadStore();

  return store.clientes.map((c) => {
    const agsDoCliente = store.agendamentos.filter((a) => a.cliente_id === c.id);
    const concluidos = agsDoCliente.filter((a) => a.status === "concluido");
    const totalGasto = concluidos.reduce((acc, a) => acc + (a.valor_total || 0), 0);
    const ultimaVisita = concluidos.length > 0 ? concluidos[concluidos.length - 1].inicio : null;

    return {
      ...c,
      visitas: concluidos.length,
      total_gasto: totalGasto,
      ultima_visita: ultimaVisita,
      dias_sem_vir: ultimaVisita ? Math.floor((Date.now() - new Date(ultimaVisita).getTime()) / 86400000) : 0,
      multas_pendentes_qtd: 0,
      multas_pendentes_valor: 0,
      servico_mais_usado: "Corte (máquina e tesoura)",
    };
  });
}

/** Salva ou atualiza um serviço no mock store */
export function mockSalvarServico(servico: Partial<Servico>): Servico {
  const store = loadStore();
  if (!store.servicos) {
    store.servicos = [...DEMO_SERVICOS_STATIC];
  }

  if (servico.id) {
    const idx = store.servicos.findIndex((s) => s.id === servico.id);
    if (idx >= 0) {
      store.servicos[idx] = { ...store.servicos[idx], ...servico };
      saveStore(store);
      return store.servicos[idx];
    }
  }

  const novoServico: Servico = {
    id: servico.id || "srv-" + Date.now().toString(36),
    nome: servico.nome || "Novo Serviço",
    descricao: servico.descricao || null,
    preco: servico.preco ?? 25.0,
    duracao_min: servico.duracao_min ?? 60,
    icone: servico.icone || "corte",
    tipo: servico.tipo || "avulso",
    ativo: servico.ativo ?? true,
    ordem: servico.ordem ?? store.servicos.length + 1,
    criado_em: new Date().toISOString(),
  };

  store.servicos.push(novoServico);
  saveStore(store);
  return novoServico;
}

/** Exclui um serviço do mock store */
export function mockExcluirServico(servicoId: string): boolean {
  const store = loadStore();
  if (!store.servicos) {
    store.servicos = [...DEMO_SERVICOS_STATIC];
  }

  const initialLen = store.servicos.length;
  store.servicos = store.servicos.filter((s) => s.id !== servicoId);
  saveStore(store);
  return store.servicos.length < initialLen;
}

/** Salva anexo no mock store */
export function mockSalvarAnexo(
  anexo: import("./supabase/types").AgendamentoAnexo
): import("./supabase/types").AgendamentoAnexo {
  const store = loadStore();
  if (!store.anexos) store.anexos = [];
  store.anexos = store.anexos.filter((a) => a.id !== anexo.id);
  store.anexos.push(anexo);
  saveStore(store);
  return anexo;
}

/** Retorna anexos de um agendamento no mock store */
export function mockGetAnexosAgendamento(
  agendamentoId: string
): import("./supabase/types").AgendamentoAnexo[] {
  const store = loadStore();
  return (store.anexos || []).filter(
    (a) => a.agendamento_id === agendamentoId && a.status === "enviado"
  );
}

/** Exclui anexo do mock store */
export function mockExcluirAnexo(anexoId: string): boolean {
  const store = loadStore();
  if (!store.anexos) return false;
  const initialLen = store.anexos.length;
  store.anexos = store.anexos.filter((a) => a.id !== anexoId);
  saveStore(store);
  return store.anexos.length < initialLen;
}

