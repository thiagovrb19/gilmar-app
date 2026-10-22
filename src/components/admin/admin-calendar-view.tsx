"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  Plus,
  Lock,
  Repeat,
  ChevronLeft,
  ChevronRight,
  User,
  Phone,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  Trash2,
  Sparkles,
  CalendarOff,
  Settings2,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";
import {
  Agendamento,
  Bloqueio,
  HorarioFixo,
  Servico,
  Cliente,
  DiaExcecao,
  DiaExcecaoTipo,
} from "@/lib/supabase/types";
import { formatCurrency, formatPhone } from "@/lib/formatters";
import {
  formatDateFriendly,
  formatTimeSaoPaulo,
  formatDateShort,
  formatWeekDayShort,
} from "@/lib/date/tz";
import {
  criarAgendamentoManualAction,
  criarBloqueioAction,
  excluirBloqueioAction,
  criarHorarioFixoAction,
  salvarHorarioFixoAction,
  salvarDiaExcecaoAction,
  removerDiaExcecaoAction,
} from "@/actions/admin";
import { useRealtimeSync, broadcastSync } from "@/hooks/use-realtime-sync";
import { AdminAppointmentDetailModal } from "./admin-appointment-detail-modal";

interface AdminCalendarViewProps {
  initialAgendamentos: Agendamento[];
  initialBloqueios: Bloqueio[];
  initialHorariosFixos: HorarioFixo[];
  initialDiasExcecao?: DiaExcecao[];
  servicos: Servico[];
  clientes: Cliente[];
}

export function AdminCalendarView({
  initialAgendamentos,
  initialBloqueios,
  initialHorariosFixos,
  initialDiasExcecao = [],
  servicos,
  clientes,
}: AdminCalendarViewProps) {
  const router = useRouter();

  // Sincronização em tempo real unificada (WebSockets + BroadcastChannel + foco)
  useRealtimeSync({
    tables: ["agendamentos", "bloqueios", "horarios_fixos", "dias_excecao", "clientes"],
    onSync: () => router.refresh(),
  });

  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().split("T")[0]
  );
  const [viewMode, setViewMode] = useState<"dia" | "semana">("dia");

  // Estado das Exceções / Personalização de Horários por Data
  const [diasExcecao, setDiasExcecao] = useState<DiaExcecao[]>(initialDiasExcecao);
  const [openExcecaoModal, setOpenExcecaoModal] = useState(false);
  const [excecaoTipo, setExcecaoTipo] = useState<DiaExcecaoTipo>("personalizado");
  const [excecaoMotivo, setExcecaoMotivo] = useState("");
  const [excecaoHorarios, setExcecaoHorarios] = useState<string[]>(["17:00"]);
  const [isSubmittingExcecao, setIsSubmittingExcecao] = useState(false);

  // Modais de Ação
  const [openManualModal, setOpenManualModal] = useState(false);
  const [openBloqueioModal, setOpenBloqueioModal] = useState(false);
  const [openFixoModal, setOpenFixoModal] = useState(false);
  const [detailModalAg, setDetailModalAg] = useState<Agendamento | null>(null);

  // Formulário Agendamento Manual
  const [manualClienteId, setManualClienteId] = useState("");
  const [manualNovoNome, setManualNovoNome] = useState("");
  const [manualNovoWhats, setManualNovoWhats] = useState("");
  const [manualServicos, setManualServicos] = useState<string[]>([]);
  const [manualData, setManualData] = useState(selectedDate);
  const [manualHora, setManualHora] = useState("17:00");
  const [manualObs, setManualObs] = useState("");
  const [isSubmittingManual, setIsSubmittingManual] = useState(false);

  // Formulário Bloqueio
  const [bloqueioInicio, setBloqueioInicio] = useState("");
  const [bloqueioFim, setBloqueioFim] = useState("");
  const [bloqueioMotivo, setBloqueioMotivo] = useState("");
  const [isSubmittingBloqueio, setIsSubmittingBloqueio] = useState(false);

  // Formulário Horário Fixo
  const [fixoClienteId, setFixoClienteId] = useState("");
  const [fixoDiaSemana, setFixoDiaSemana] = useState(5); // Sexta
  const [fixoHora, setFixoHora] = useState("17:00");
  const [fixoServicoId, setFixoServicoId] = useState(servicos[0]?.id || "");
  const [fixoRecorrencia, setFixoRecorrencia] = useState<"semanal" | "quinzenal" | "mensal">("semanal");
  const [fixoSemanas, setFixoSemanas] = useState(8);
  const [fixoDataInicio, setFixoDataInicio] = useState(selectedDate);
  const [isSubmittingFixo, setIsSubmittingFixo] = useState(false);

  // Exceção atual da data selecionada
  const currentExcecao = diasExcecao.find((d) => d.data === selectedDate);

  // Abrir modal de personalização com os valores atuais da data
  const handleOpenExcecaoModal = (targetDate = selectedDate) => {
    const exc = diasExcecao.find((d) => d.data === targetDate);
    const dayOfWeek = new Date(`${targetDate}T12:00:00`).getDay();

    if (exc) {
      setExcecaoTipo(exc.tipo);
      setExcecaoMotivo(exc.motivo || "");
      if (exc.horarios_especificos && exc.horarios_especificos.length > 0) {
        setExcecaoHorarios([...exc.horarios_especificos]);
      } else if (exc.abre && exc.fecha) {
        const startH = parseInt(exc.abre.split(":")[0]);
        const endH = parseInt(exc.fecha.split(":")[0]);
        const slots: string[] = [];
        for (let h = startH; h < endH; h++) {
          slots.push(`${h.toString().padStart(2, "0")}:00`);
        }
        setExcecaoHorarios(slots);
      } else {
        setExcecaoHorarios(["17:00"]);
      }
    } else {
      setExcecaoTipo("personalizado");
      setExcecaoMotivo("");
      // Padrão sugerido: se sábado, manhã; se semana, noite
      if (dayOfWeek === 6) {
        setExcecaoHorarios(["08:00", "09:00", "10:00", "11:00"]);
      } else {
        setExcecaoHorarios(["17:00", "18:00"]);
      }
    }
    setOpenExcecaoModal(true);
  };

  const handleToggleHorario = (hora: string) => {
    if (excecaoHorarios.includes(hora)) {
      setExcecaoHorarios(excecaoHorarios.filter((h) => h !== hora));
    } else {
      setExcecaoHorarios([...excecaoHorarios, hora].sort());
    }
  };

  const handleSalvarExcecao = async (e: React.FormEvent) => {
    e.preventDefault();
    if (excecaoTipo === "personalizado" && excecaoHorarios.length === 0) {
      toast.error("Selecione pelo menos um horário em que você irá atender.");
      return;
    }

    setIsSubmittingExcecao(true);
    const res = await salvarDiaExcecaoAction({
      data: selectedDate,
      tipo: excecaoTipo,
      motivo: excecaoMotivo,
      horarios_especificos: excecaoHorarios,
    });
    setIsSubmittingExcecao(false);

    if (!res.success) {
      toast.error("Erro ao salvar configuração desta data.");
      return;
    }

    // Atualiza estado local
    setDiasExcecao((prev) => {
      const filtered = prev.filter((d) => d.data !== selectedDate);
      return [...filtered, res.excecao];
    });

    toast.success(
      excecaoTipo === "fechado"
        ? "Data marcada como fechada/feriado com sucesso!"
        : "Horários especiais configurados para esta data!"
    );
    setOpenExcecaoModal(false);
    router.refresh();
  };

  const handleRestaurarPadrao = async (dateStr = selectedDate) => {
    const res = await removerDiaExcecaoAction(dateStr);
    if (!res.success) {
      toast.error("Erro ao restaurar horário padrão.");
      return;
    }

    setDiasExcecao((prev) => prev.filter((d) => d.data !== dateStr));
    toast.success("Expediente padrão restaurado para esta data!");
    setOpenExcecaoModal(false);
    router.refresh();
  };

  const handleExcluirBloqueio = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este bloqueio?")) return;
    const res = await excluirBloqueioAction(id);
    if (res.success) {
      toast.success("Bloqueio removido!");
      router.refresh();
    } else {
      toast.error("Erro ao remover bloqueio.");
    }
  };

  // Navegar datas
  const changeDateByDays = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().split("T")[0]);
  };

  // Filtrar agendamentos do dia selecionado
  const agendamentosDoDia = initialAgendamentos.filter((ag) =>
    ag.inicio.startsWith(selectedDate)
  );

  const bloqueiosDoDia = initialBloqueios.filter(
    (b) => b.inicio.startsWith(selectedDate) || b.fim.startsWith(selectedDate)
  );

  const diaSemanaNum = new Date(`${selectedDate}T12:00:00`).getDay();
  const fixosDoDia = initialHorariosFixos.filter((f) => f.dia_semana === diaSemanaNum);

  const handleSalvarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (manualServicos.length === 0) {
      toast.error("Selecione pelo menos um serviço.");
      return;
    }

    setIsSubmittingManual(true);
    const inicioStr = `${manualData}T${manualHora}:00-03:00`;

    const res = await criarAgendamentoManualAction({
      clienteId: manualClienteId || undefined,
      novoNome: manualNovoNome || undefined,
      novoWhats: manualNovoWhats || undefined,
      servicosIds: manualServicos,
      inicio: inicioStr,
      observacao: manualObs,
    });
    setIsSubmittingManual(false);

    if (!res.success) {
      toast.error(res.error || "Não foi possível criar agendamento.");
      return;
    }

    toast.success("Agendamento criado com sucesso!");
    setOpenManualModal(false);
    setManualServicos([]);
    broadcastSync("agendamentos");
    router.refresh();
  };

  const handleSalvarBloqueio = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingBloqueio(true);

    const res = await criarBloqueioAction(bloqueioInicio, bloqueioFim, bloqueioMotivo);
    setIsSubmittingBloqueio(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao criar bloqueio");
      return;
    }

    toast.success("Bloqueio de horário registrado!");
    setOpenBloqueioModal(false);
    broadcastSync("bloqueios");
    router.refresh();
  };

  const handleSalvarFixo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fixoClienteId) {
      toast.error("Selecione o cliente fixo.");
      return;
    }

    setIsSubmittingFixo(true);
    const res = await salvarHorarioFixoAction({
      clienteId: fixoClienteId,
      diaSemana: fixoDiaSemana,
      hora: fixoHora,
      servicoId: fixoServicoId,
      recorrencia: fixoRecorrencia,
      dataInicio: fixoDataInicio || selectedDate,
      semanas: fixoSemanas,
    });
    setIsSubmittingFixo(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao salvar horário fixo");
      return;
    }

    toast.success(
      `Horário recorrente (${fixoRecorrencia}) cadastrado! ${res.agendamentos_gerados || 0} horário(s) reservados na agenda.`
    );
    setOpenFixoModal(false);
    broadcastSync("agendamentos");
    broadcastSync("horarios_fixos");
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* BARRA SUPERIOR DE AÇÕES E NAVEGAÇÃO DE DIAS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs text-gold font-semibold">
            Gestão da Cadeira
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Agenda Completa
          </h1>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setOpenManualModal(true)}
            className="inline-flex items-center gap-1.5 bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs px-3.5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Plus className="w-4 h-4 stroke-[3]" />
            <span>Novo Agendamento</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenExcecaoModal()}
            className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/50 text-xs px-3.5 py-2.5 rounded-xl transition-all font-medium shadow-sm active:scale-95"
          >
            <CalendarClock className="w-3.5 h-3.5 text-gold" />
            <span>Personalizar Data / Feriado</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenBloqueioModal(true)}
            className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs px-3.5 py-2.5 rounded-xl transition-colors"
          >
            <Lock className="w-3.5 h-3.5 text-warning" />
            <span>Bloqueio</span>
          </button>

          <button
            type="button"
            onClick={() => setOpenFixoModal(true)}
            className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 text-xs px-3.5 py-2.5 rounded-xl transition-colors"
          >
            <Repeat className="w-3.5 h-3.5" />
            <span>Cliente Fixo</span>
          </button>
        </div>
      </div>

      {/* SELETOR DE DATA E NAVEGAÇÃO ENTRE DIAS */}
      <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={() => changeDateByDays(-1)}
            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-main transition-colors"
            title="Dia anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>

          <div className="text-center px-3">
            <h3 className="font-heading text-base font-bold text-text-main capitalize">
              {formatDateFriendly(`${selectedDate}T12:00:00`)}
            </h3>
            <span className="text-[11px] text-gold font-semibold">
              {agendamentosDoDia.length} atendimento(s) &bull; {bloqueiosDoDia.length} bloqueio(s)
            </span>
          </div>

          <button
            type="button"
            onClick={() => changeDateByDays(1)}
            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-main transition-colors"
            title="Próximo dia"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bg-surface-2 border border-border-subtle text-xs text-text-main px-3 py-2 rounded-xl focus:outline-none focus:border-gold"
          />
          <button
            type="button"
            onClick={() => setSelectedDate(new Date().toISOString().split("T")[0])}
            className="bg-surface-2 hover:bg-surface-3 text-xs text-text-muted hover:text-text-main px-3 py-2 rounded-xl border border-border-subtle"
          >
            Hoje
          </button>
        </div>
      </div>

      {/* BANNER DE EXPEDIENTE / GESTÃO DE HORÁRIOS DA DATA */}
      {currentExcecao ? (
        currentExcecao.tipo === "fechado" ? (
          <div className="bg-destructive/10 border border-destructive/30 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/20 text-destructive flex items-center justify-center shrink-0">
                <CalendarOff className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-destructive text-sm">
                    🛑 Fechado para Atendimento nesta Data
                  </span>
                  <span className="bg-destructive/20 text-destructive text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {currentExcecao.motivo || "Feriado / Imprevisto"}
                  </span>
                </div>
                <p className="text-xs text-text-muted mt-0.5">
                  Nenhum cliente consegue agendar neste dia pelo aplicativo.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenExcecaoModal()}
                className="bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-text-main px-3 py-2 rounded-xl border border-border-subtle transition-colors"
              >
                Editar
              </button>
              <button
                type="button"
                onClick={() => handleRestaurarPadrao()}
                className="bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-gold px-3 py-2 rounded-xl border border-border-gold/40 transition-colors"
              >
                ↺ Restaurar Horário Normal
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-gold/10 border border-gold/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-md animate-in fade-in duration-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gold/20 text-gold flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-gold text-sm">
                    ✨ Horários Especiais Ativos nesta Data
                  </span>
                  <span className="bg-gold/20 text-gold text-[10px] font-bold px-2 py-0.5 rounded-full">
                    {currentExcecao.horarios_especificos?.length || 0} horário(s) liberado(s)
                  </span>
                </div>
                <p className="text-xs text-text-main mt-0.5 font-medium">
                  {currentExcecao.horarios_especificos && currentExcecao.horarios_especificos.length > 0
                    ? `Atendimentos disponíveis: ${currentExcecao.horarios_especificos.join(", ")}`
                    : `${currentExcecao.abre} às ${currentExcecao.fecha}`}
                  {currentExcecao.motivo ? ` • ${currentExcecao.motivo}` : ""}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleOpenExcecaoModal()}
                className="bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-text-main px-3 py-2 rounded-xl border border-border-subtle transition-colors"
              >
                Editar Horários
              </button>
              <button
                type="button"
                onClick={() => handleRestaurarPadrao()}
                className="bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-gold px-3 py-2 rounded-xl border border-border-gold/40 transition-colors"
              >
                ↺ Restaurar Padrão
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-xs">
            <Clock className="w-4 h-4 text-gold shrink-0" />
            <span className="text-text-muted">Expediente regular:</span>
            <span className="font-semibold text-text-main">
              {diaSemanaNum === 0
                ? "Domingo (Fechado)"
                : diaSemanaNum === 6
                ? "Sábado (12:00 às 18:00)"
                : "Segunda a Sexta (17:00 às 21:00)"}
            </span>
          </div>
          <button
            type="button"
            onClick={() => handleOpenExcecaoModal()}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gold hover:text-gold-hover bg-surface-2 hover:bg-surface-3 px-3 py-1.5 rounded-xl border border-border-gold/40 transition-colors self-start sm:self-auto"
          >
            <CalendarClock className="w-3.5 h-3.5" />
            <span>Personalizar Horários Deste Dia (Feriado / Reduzido)</span>
          </button>
        </div>
      )}

      {/* LISTA DO DIA */}
      <div className="space-y-4">
        {/* BLOQUEIOS DO DIA */}
        {bloqueiosDoDia.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-warning font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              Bloqueios no Período
            </span>
            {bloqueiosDoDia.map((b) => (
              <div
                key={b.id}
                className="bg-warning/10 border border-warning/30 rounded-xl p-3 flex justify-between items-center text-xs"
              >
                <div>
                  <span className="font-bold text-warning">{b.motivo}</span>
                  <p className="text-text-muted text-[11px]">
                    {formatTimeSaoPaulo(b.inicio)} às {formatTimeSaoPaulo(b.fim)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-warning/20 text-warning px-2 py-0.5 rounded font-bold">
                    Bloqueado
                  </span>
                  <button
                    type="button"
                    onClick={() => handleExcluirBloqueio(b.id)}
                    title="Remover bloqueio"
                    className="p-1 text-text-muted hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* HORÁRIOS FIXOS DO DIA */}
        {fixosDoDia.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs text-gold font-semibold flex items-center gap-1.5">
              <Repeat className="w-3.5 h-3.5" />
              Horários Fixos Semanais Cadastrados
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {fixosDoDia.map((f) => (
                <div
                  key={f.id}
                  className="bg-surface-1 border border-border-gold/40 rounded-xl p-3 flex justify-between items-center text-xs"
                >
                  <div>
                    <h4 className="font-bold text-text-main">{f.cliente?.nome}</h4>
                    <span className="text-gold font-semibold">{f.hora.slice(0, 5)}</span>
                    <span className="text-text-muted text-[11px] block">
                      {f.servico?.nome}
                    </span>
                  </div>
                  <span className="text-[10px] bg-gold/15 text-gold font-bold px-2 py-0.5 rounded">
                    Toda semana
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* AGENDAMENTOS DO DIA */}
        <div className="space-y-3 pt-2">
          <span className="text-xs text-text-muted font-semibold block">
            Atendimentos Marcados
          </span>

          {agendamentosDoDia.length === 0 ? (
            <div className="bg-surface-1 border border-border-subtle rounded-2xl p-8 text-center space-y-2">
              <Clock className="w-8 h-8 mx-auto text-text-muted/60" />
              <p className="text-xs text-text-muted">Nenhum atendimento marcado para este dia.</p>
            </div>
          ) : (
            agendamentosDoDia.map((ag) => {
              const statusColors: Record<string, string> = {
                agendado: "bg-surface-2 text-gold border-border-gold/30",
                confirmado: "bg-blue-500/10 text-blue-400 border-blue-500/30",
                concluido: "bg-success/15 text-success border-success/30",
                nao_compareceu: "bg-destructive/15 text-destructive border-destructive/30",
                cancelado: "bg-zinc-800 text-zinc-500 border-zinc-700",
              };

              return (
                <div
                  key={ag.id}
                  className="bg-surface-1 border border-border-subtle hover:border-border-gold/40 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all"
                >
                  <div className="flex items-start gap-3">
                    <div className="bg-surface-2 border border-border-gold/30 px-3 py-1.5 rounded-xl text-center shrink-0 min-w-[70px]">
                      <span className="text-base font-bold font-heading text-gold block">
                        {formatTimeSaoPaulo(ag.inicio)}
                      </span>
                      <span className="text-[10px] text-text-muted">60 min</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-text-main text-sm">
                          {ag.cliente?.nome || "Cliente avulso"}
                        </h4>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${
                            statusColors[ag.status] || "bg-surface-2 text-text-muted"
                          }`}
                        >
                          {ag.status.replace("_", " ")}
                        </span>
                        {ag.origem === "fixo" && (
                          <span className="text-[10px] bg-gold/15 text-gold font-bold px-2 py-0.5 rounded-full border border-gold/30">
                            Recorrente
                          </span>
                        )}
                      </div>

                      {ag.cliente?.whatsapp && (
                        <p className="text-xs text-text-muted">
                          WhatsApp: {formatPhone(ag.cliente.whatsapp)}
                        </p>
                      )}

                      {/* Serviços e Preços */}
                      {ag.servicos && ag.servicos.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {ag.servicos.map((s) => (
                            <span
                              key={s.id}
                              className="text-[10px] bg-surface-2 px-2 py-0.5 rounded text-text-muted border border-border-subtle"
                            >
                              {s.nome} ({formatCurrency(s.preco)})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                    <button
                      type="button"
                      onClick={() => setDetailModalAg(ag)}
                      className="bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 font-semibold text-xs px-3 py-1.5 rounded-xl transition-colors flex items-center gap-1.5"
                      title="Visualizar detalhes da solicitação e fotos anexadas"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                      <span>Fotos / Detalhes</span>
                    </button>

                    <div className="text-right">
                      <span className="text-base font-bold font-heading text-gold block">
                        {formatCurrency(ag.valor_total)}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {ag.pago ? (
                          <span className="text-success font-medium">Pago</span>
                        ) : (
                          "Pagamento Pendente"
                        )}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* MODAL 1: NOVO AGENDAMENTO MANUAL */}
      {openManualModal && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpenManualModal(false)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-heading text-lg font-bold text-text-main">
                Novo Agendamento Manual
              </h3>
              <button
                type="button"
                onClick={() => setOpenManualModal(false)}
                className="text-text-muted hover:text-text-main"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSalvarManual} className="space-y-4 text-xs">
              {/* Seleção de Cliente existente ou rápido */}
              <div className="space-y-2">
                <label className="text-text-muted block font-medium">Selecione o Cliente:</label>
                <select
                  value={manualClienteId}
                  onChange={(e) => setManualClienteId(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                >
                  <option value="">-- Cadastrar Novo Cliente Rápido --</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({formatPhone(c.whatsapp)})
                    </option>
                  ))}
                </select>

                {!manualClienteId && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <input
                      type="text"
                      required
                      placeholder="Nome do cliente"
                      value={manualNovoNome}
                      onChange={(e) => setManualNovoNome(e.target.value)}
                      className="bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                    />
                    <input
                      type="tel"
                      required
                      placeholder="WhatsApp (ex: 32999999999)"
                      value={manualNovoWhats}
                      onChange={(e) => setManualNovoWhats(formatPhone(e.target.value))}
                      className="bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>
                )}
              </div>

              {/* Data e Hora */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-text-muted block mb-1">Data:</label>
                  <input
                    type="date"
                    required
                    value={manualData}
                    onChange={(e) => setManualData(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Hora de Início:</label>
                  <input
                    type="time"
                    required
                    value={manualHora}
                    onChange={(e) => setManualHora(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              {/* Serviços */}
              <div>
                <label className="text-text-muted block mb-1 font-medium">
                  Selecione os Serviços:
                </label>
                <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-surface-2/40 rounded-xl border border-border-subtle">
                  {servicos.map((s) => {
                    const isChecked = manualServicos.includes(s.id);
                    return (
                      <label
                        key={s.id}
                        className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer border ${
                          isChecked
                            ? "bg-gold/15 border-gold text-gold font-bold"
                            : "bg-surface-2 border-border-subtle text-text-main"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {
                            if (isChecked) {
                              setManualServicos(manualServicos.filter((id) => id !== s.id));
                            } else {
                              setManualServicos([...manualServicos, s.id]);
                            }
                          }}
                          className="accent-gold"
                        />
                        <span className="truncate">{s.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Observação:</label>
                <input
                  type="text"
                  placeholder="Ex: Marcou pelo WhatsApp"
                  value={manualObs}
                  onChange={(e) => setManualObs(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingManual}
                className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSubmittingManual ? "Gravando agendamento..." : "Salvar Agendamento Manual"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: NOVO BLOQUEIO */}
      {openBloqueioModal && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpenBloqueioModal(false)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-heading text-lg font-bold text-warning">
                Bloquear Horário / Dia
              </h3>
              <button
                type="button"
                onClick={() => setOpenBloqueioModal(false)}
                className="text-text-muted hover:text-text-main"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSalvarBloqueio} className="space-y-3 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Motivo do Bloqueio:</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Compromisso médico, Férias, Folga"
                  value={bloqueioMotivo}
                  onChange={(e) => setBloqueioMotivo(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">Início do Bloqueio:</label>
                <input
                  type="datetime-local"
                  required
                  value={bloqueioInicio}
                  onChange={(e) => setBloqueioInicio(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div>
                <label className="text-text-muted block mb-1">Fim do Bloqueio:</label>
                <input
                  type="datetime-local"
                  required
                  value={bloqueioFim}
                  onChange={(e) => setBloqueioFim(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingBloqueio}
                className="w-full bg-warning hover:bg-warning/90 text-bg-base font-bold text-xs py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmittingBloqueio ? "Salvando..." : "Confirmar Bloqueio"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: NOVO HORÁRIO FIXO */}
      {openFixoModal && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpenFixoModal(false)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-heading text-lg font-bold text-gold">
                Cadastrar Cliente com Horário Fixo
              </h3>
              <button
                type="button"
                onClick={() => setOpenFixoModal(false)}
                className="text-text-muted hover:text-text-main"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSalvarFixo} className="space-y-3 text-xs">
              <div>
                <label className="text-text-muted block mb-1">Cliente:</label>
                <select
                  required
                  value={fixoClienteId}
                  onChange={(e) => setFixoClienteId(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                >
                  <option value="">-- Selecione o Cliente --</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome} ({formatPhone(c.whatsapp)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-text-muted block mb-1">Dia da Semana:</label>
                  <select
                    value={fixoDiaSemana}
                    onChange={(e) => setFixoDiaSemana(Number(e.target.value))}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  >
                    <option value={1}>Segunda-feira</option>
                    <option value={2}>Terça-feira</option>
                    <option value={3}>Quarta-feira</option>
                    <option value={4}>Quinta-feira</option>
                    <option value={5}>Sexta-feira</option>
                    <option value={6}>Sábado</option>
                  </select>
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Hora:</label>
                  <input
                    type="time"
                    required
                    value={fixoHora}
                    onChange={(e) => setFixoHora(e.target.value)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  />
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Serviço Padrão:</label>
                <select
                  value={fixoServicoId}
                  onChange={(e) => setFixoServicoId(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                >
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nome} - {formatCurrency(s.preco)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Recorrência e Duração */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-text-muted block mb-1">Frequência:</label>
                  <select
                    value={fixoRecorrencia}
                    onChange={(e) => setFixoRecorrencia(e.target.value as any)}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  >
                    <option value="semanal">Semanal (Toda semana)</option>
                    <option value="quinzenal">Quinzenal (A cada 2 semanas)</option>
                    <option value="mensal">Mensal (A cada 4 semanas)</option>
                  </select>
                </div>
                <div>
                  <label className="text-text-muted block mb-1">Duração / Semanas:</label>
                  <select
                    value={fixoSemanas}
                    onChange={(e) => setFixoSemanas(Number(e.target.value))}
                    className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                  >
                    <option value={4}>4 Semanas (1 mês)</option>
                    <option value={8}>8 Semanas (2 meses)</option>
                    <option value={12}>12 Semanas (3 meses)</option>
                    <option value={16}>16 Semanas (4 meses)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1">Data de Início da Recorrência:</label>
                <input
                  type="date"
                  value={fixoDataInicio}
                  onChange={(e) => setFixoDataInicio(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                />
              </div>

              <div className="bg-surface-2/60 p-3 rounded-xl text-[11px] text-text-muted space-y-1">
                <p className="font-semibold text-gold">✔ Reserva Automática Inteligente</p>
                <p>
                  Esse horário ficará bloqueado para outros clientes no sistema e os agendamentos reais serão criados e exibidos na agenda com checagem anti-conflito.
                </p>
              </div>

              <button
                type="submit"
                disabled={isSubmittingFixo}
                className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs py-3 rounded-xl transition-all active:scale-95 disabled:opacity-50"
              >
                {isSubmittingFixo ? "Salvando..." : "Salvar Horário Fixo"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: PERSONALIZAR EXPEDIENTE / FERIADO DA DATA */}
      {openExcecaoModal && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setOpenExcecaoModal(false)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <div>
                <span className="text-xs text-gold font-semibold block">
                  Gerenciar Agenda de Dias
                </span>
                <h3 className="font-heading text-lg font-bold text-text-main capitalize">
                  {formatDateFriendly(`${selectedDate}T12:00:00`)}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setOpenExcecaoModal(false)}
                className="text-text-muted hover:text-text-main text-xs px-2.5 py-1 rounded-lg bg-surface-2"
              >
                Fechar
              </button>
            </div>

            {/* SELEÇÃO DO TIPO: PERSONALIZADO OU FECHADO */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-surface-2 rounded-2xl">
              <button
                type="button"
                onClick={() => setExcecaoTipo("personalizado")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  excecaoTipo === "personalizado"
                    ? "bg-gold text-bg-base shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Horários Especiais</span>
              </button>

              <button
                type="button"
                onClick={() => setExcecaoTipo("fechado")}
                className={`py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  excecaoTipo === "fechado"
                    ? "bg-destructive text-white shadow-sm"
                    : "text-text-muted hover:text-text-main"
                }`}
              >
                <CalendarOff className="w-3.5 h-3.5" />
                <span>Fechar Dia (Feriado)</span>
              </button>
            </div>

            <form onSubmit={handleSalvarExcecao} className="space-y-4 text-xs">
              {excecaoTipo === "fechado" ? (
                <div className="space-y-3 p-4 bg-destructive/10 border border-destructive/30 rounded-2xl">
                  <div className="space-y-1">
                    <h4 className="font-bold text-destructive text-sm flex items-center gap-1.5">
                      <CalendarOff className="w-4 h-4" />
                      Não haverá atendimento nesta data
                    </h4>
                    <p className="text-[11px] text-text-muted">
                      A data será marcada como fechada no aplicativo e nenhum cliente conseguirá realizar agendamentos.
                    </p>
                  </div>

                  <div>
                    <label className="text-text-muted block mb-1.5 font-medium">
                      Motivo (aparecerá para os clientes):
                    </label>
                    <input
                      type="text"
                      value={excecaoMotivo}
                      onChange={(e) => setExcecaoMotivo(e.target.value)}
                      placeholder="Ex: Feriado Nacional, Imprevisto, Viagem"
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>

                  {/* Atalhos de motivos comuns */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {["Feriado", "Imprevisto", "Folga", "Compromisso Pessoal", "Viagem"].map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setExcecaoMotivo(m)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-medium border transition-colors ${
                          excecaoMotivo === m
                            ? "bg-destructive text-white border-destructive"
                            : "bg-surface-2 border-border-subtle text-text-muted hover:text-text-main"
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <p className="text-text-muted text-[11px]">
                      Selecione exatamente os horários que estarão disponíveis para agendamento nesta data:
                    </p>
                  </div>

                  {/* ATALHOS RÁPIDOS DE 1 TOQUE */}
                  <div>
                    <span className="text-[10px] text-text-muted block mb-1.5 font-semibold uppercase tracking-wider">
                      Atalhos Rápidos:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setExcecaoHorarios(["08:00", "09:00", "10:00", "11:00"]);
                          if (!excecaoMotivo) setExcecaoMotivo("Somente Manhã");
                        }}
                        className="bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all"
                      >
                        Apenas Manhã (08h às 12h)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setExcecaoHorarios(["13:00", "14:00", "15:00", "16:00"]);
                          if (!excecaoMotivo) setExcecaoMotivo("Somente Tarde");
                        }}
                        className="bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all"
                      >
                        Apenas Tarde (13h às 17h)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setExcecaoHorarios(["17:00", "18:00", "19:00", "20:00"]);
                          if (!excecaoMotivo) setExcecaoMotivo("Somente Noite");
                        }}
                        className="bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 text-[11px] font-semibold px-2.5 py-1.5 rounded-xl transition-all"
                      >
                        Apenas Noite (17h às 21h)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setExcecaoHorarios(["17:00"]);
                          if (!excecaoMotivo) setExcecaoMotivo("Apenas 17:00 às 18:00");
                        }}
                        className="bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 text-[11px] font-bold px-2.5 py-1.5 rounded-xl transition-all"
                      >
                        Apenas 17h às 18h (1 corte)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setExcecaoHorarios([
                            "08:00", "09:00", "10:00", "11:00",
                            "13:00", "14:00", "15:00", "16:00", "17:00"
                          ]);
                          if (!excecaoMotivo) setExcecaoMotivo("Dia Todo");
                        }}
                        className="bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
                      >
                        Dia Todo (08h às 18h)
                      </button>

                      <button
                        type="button"
                        onClick={() => setExcecaoHorarios([])}
                        className="bg-surface-2 hover:bg-surface-3 text-text-muted text-[11px] font-medium px-2.5 py-1.5 rounded-xl transition-all"
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  {/* GRADE DE HORÁRIOS CLICÁVEIS */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-text-muted font-semibold uppercase tracking-wider">
                        Clique nos horários para ativar ou desativar:
                      </span>
                      <span className="text-[11px] text-gold font-bold">
                        {excecaoHorarios.length} horário(s) ativo(s)
                      </span>
                    </div>

                    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                      {[
                        "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
                        "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
                        "19:00", "20:00", "21:00"
                      ].map((hora) => {
                        const isChecked = excecaoHorarios.includes(hora);
                        return (
                          <button
                            key={hora}
                            type="button"
                            onClick={() => handleToggleHorario(hora)}
                            className={`py-2 px-1 rounded-xl border text-center transition-all font-mono font-bold text-xs ${
                              isChecked
                                ? "bg-gold text-bg-base border-gold ring-1 ring-gold/40 shadow-md scale-[1.03]"
                                : "bg-surface-2 border-border-subtle text-text-muted hover:border-gold/40 hover:text-text-main"
                            }`}
                          >
                            {hora}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* MOTIVO OPCIONAL */}
                  <div>
                    <label className="text-text-muted block mb-1">Motivo / Descrição (opcional):</label>
                    <input
                      type="text"
                      value={excecaoMotivo}
                      onChange={(e) => setExcecaoMotivo(e.target.value)}
                      placeholder="Ex: Atendimento somente de manhã, Feriado reduzido"
                      className="w-full bg-surface-2 border border-border-subtle rounded-xl p-2.5 text-text-main focus:outline-none focus:border-gold"
                    />
                  </div>
                </div>
              )}

              {/* BOTÕES DE SALVAR E RESTAURAR */}
              <div className="space-y-2 pt-2 border-t border-border-subtle">
                <button
                  type="submit"
                  disabled={isSubmittingExcecao}
                  className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs py-3.5 rounded-xl transition-all active:scale-95 disabled:opacity-50 shadow-md"
                >
                  {isSubmittingExcecao
                    ? "Salvando alteração..."
                    : `Salvar Configuração para ${formatDateShort(`${selectedDate}T12:00:00`)}`}
                </button>

                {currentExcecao && (
                  <button
                    type="button"
                    onClick={() => handleRestaurarPadrao()}
                    className="w-full bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text-main font-semibold text-xs py-2.5 rounded-xl border border-border-subtle transition-colors"
                  >
                    ↺ Restaurar Expediente Normal de Atendimento
                  </button>
                )}
              </div>
            </form>

            {/* LISTA DE OUTRAS DATAS COM HORÁRIOS ESPECIAIS PROGRAMADOS */}
            {diasExcecao.length > 0 && (
              <div className="pt-3 border-t border-border-subtle space-y-2">
                <span className="text-[11px] font-bold text-gold flex items-center gap-1.5">
                  <CalendarClock className="w-3.5 h-3.5" />
                  Todas as Datas Especiais Programadas ({diasExcecao.length}):
                </span>
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {diasExcecao.map((d) => (
                    <div
                      key={d.id || d.data}
                      className="bg-surface-2 border border-border-subtle rounded-xl p-2.5 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className="font-bold text-text-main">
                          {formatDateFriendly(`${d.data}T12:00:00`)}
                        </span>
                        <p className="text-text-muted text-[10px]">
                          {d.tipo === "fechado"
                            ? `🛑 Fechado (${d.motivo || "Feriado/Imprevisto"})`
                            : `✨ Horários: ${d.horarios_especificos?.join(", ") || `${d.abre} às ${d.fecha}`}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDate(d.data);
                            handleOpenExcecaoModal(d.data);
                          }}
                          className="text-gold hover:underline text-[10px] font-bold"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRestaurarPadrao(d.data)}
                          className="text-text-muted hover:text-destructive p-1"
                          title="Remover exceção"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL DE DETALHES DA SOLICITAÇÃO E IMAGENS ANEXADAS */}
      <AdminAppointmentDetailModal
        agendamento={detailModalAg}
        onClose={() => setDetailModalAg(null)}
        onRefresh={() => router.refresh()}
      />
    </div>
  );
}
