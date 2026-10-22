"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  DollarSign,
  Users,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Gift,
  ShieldAlert,
  ChevronRight,
  TrendingUp,
  Image as ImageIcon,
} from "lucide-react";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { toast } from "sonner";
import { Agendamento, ClienteEstatistica, Multa, FormaPagamento } from "@/lib/supabase/types";
import { formatCurrency, formatPhone, getWhatsAppLink } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo } from "@/lib/date/tz";
import { AdminAppointmentDetailModal } from "./admin-appointment-detail-modal";
import {
  concluirAtendimentoAction,
  marcarNaoCompareceuAction,
  cancelarAgendamentoAdminAction,
  atualizarStatusMultaAction,
} from "@/actions/admin";
import { useRealtimeSync, broadcastSync } from "@/hooks/use-realtime-sync";

interface AdminTodayDashboardProps {
  agendamentosHoje: Agendamento[];
  metricas: {
    faturamentoHoje: number;
    faturamentoPrevistoHoje?: number;
    atendimentosHojeCount: number;
    concluidosHojeCount: number;
    totalClientesCount?: number;
  };
  alertas: {
    clientesSumidos: ClienteEstatistica[];
    aniversariantesSemana: ClienteEstatistica[];
    multasPendentes: Multa[];
  };
}

export function AdminTodayDashboard({
  agendamentosHoje,
  metricas,
  alertas,
}: AdminTodayDashboardProps) {
  const router = useRouter();

  // Sincronização em tempo real unificada (WebSockets + BroadcastChannel + foco)
  useRealtimeSync({
    tables: ["agendamentos", "clientes", "lancamentos", "multas", "bloqueios"],
    onSync: () => router.refresh(),
  });

  // Estados para modal de conclusão
  const [completeModalAg, setCompleteModalAg] = useState<Agendamento | null>(null);
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>("pix");
  const [pago, setPago] = useState(true);
  const [usarCredito, setUsarCredito] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);

  // Estado para modal de detalhes e fotos
  const [detailModalAg, setDetailModalAg] = useState<Agendamento | null>(null);

  // Estados para modal de cancelamento
  const [cancelModalAg, setCancelModalAg] = useState<Agendamento | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  const handleConcluir = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!completeModalAg) return;
    setIsCompleting(true);

    const res = await concluirAtendimentoAction(
      completeModalAg.id,
      formaPagamento,
      pago,
      usarCredito
    );
    setIsCompleting(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Atendimento concluído e lançado no financeiro!");
    setCompleteModalAg(null);
    broadcastSync("agendamentos");
    broadcastSync("lancamentos");
    router.refresh();
  };

  const handleNaoCompareceu = async (ag: Agendamento) => {
    if (!confirm(`Marcar que ${ag.cliente?.nome || "o cliente"} não compareceu? Uma multa de 50% será gerada.`)) {
      return;
    }

    const res = await marcarNaoCompareceuAction(ag.id);
    if (res?.error) {
      toast.error(res.error);
      return;
    }

    toast.warning("Status alterado para 'Não compareceu' e multa registrada.");
    broadcastSync("agendamentos");
    broadcastSync("multas");
    router.refresh();
  };

  const handleCancelar = async () => {
    if (!cancelModalAg) return;
    setIsCanceling(true);

    const res = await cancelarAgendamentoAdminAction(cancelModalAg.id, cancelMotivo);
    setIsCanceling(false);

    if (res?.error) {
      toast.error(res.error);
      return;
    }

    toast.success("Agendamento cancelado pelo painel.");
    setCancelModalAg(null);
    broadcastSync("agendamentos");
    router.refresh();
  };

  const handleBaixarMulta = async (multaId: string, novoStatus: "paga" | "perdoada") => {
    const res = await atualizarStatusMultaAction(multaId, novoStatus);
    if (!res.success) {
      toast.error(res.error || "Erro ao atualizar multa");
      return;
    }
    toast.success(novoStatus === "paga" ? "Multa recebida e lançada no financeiro!" : "Multa perdoada.");
    broadcastSync("multas");
    broadcastSync("lancamentos");
    router.refresh();
  };

  return (
    <div className="space-y-8">
      {/* CABEÇALHO */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-4">
        <div>
          <span className="text-xs text-gold font-semibold">
            Visão Geral Diária
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Hoje na GS Elétrica
          </h1>
          <p className="text-xs text-text-muted capitalize">
            {formatDateFriendly(new Date().toISOString())}
          </p>
        </div>

        <div className="flex gap-2.5">
          <Link
            href="/admin/agenda"
            className="inline-flex items-center gap-2 bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
          >
            <Calendar className="w-4 h-4" />
            <span>Ver Agenda Completa</span>
          </Link>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs">Faturamento Recebido</span>
            <DollarSign className="w-4 h-4 text-gold" />
          </div>
          <span className="text-2xl font-bold font-heading text-gold block">
            {formatCurrency(metricas.faturamentoHoje)}
          </span>
          <span className="text-[10px] text-text-muted">
            Previsto hoje: <strong className="text-text-main">{formatCurrency(metricas.faturamentoPrevistoHoje || 0)}</strong>
          </span>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs">Atendimentos Hoje</span>
            <Users className="w-4 h-4 text-gold" />
          </div>
          <span className="text-2xl font-bold font-heading text-text-main block">
            {metricas.atendimentosHojeCount}
          </span>
          <span className="text-[10px] text-text-muted">
            {metricas.concluidosHojeCount} concluído(s)
          </span>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs">Clientes Sumidos</span>
            <AlertTriangle className="w-4 h-4 text-warning" />
          </div>
          <span className="text-2xl font-bold font-heading text-warning block">
            {alertas.clientesSumidos.length}
          </span>
          <span className="text-[10px] text-text-muted">Sem vir há 15+ dias</span>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-4 space-y-1">
          <div className="flex items-center justify-between text-text-muted">
            <span className="text-xs">Multas Pendentes</span>
            <ShieldAlert className="w-4 h-4 text-destructive" />
          </div>
          <span className="text-2xl font-bold font-heading text-destructive block">
            {alertas.multasPendentes.length}
          </span>
          <span className="text-[10px] text-text-muted">Aguardando baixa</span>
        </div>
      </div>

      {/* LINHA DO TEMPO DE ATENDIMENTOS DE HOJE */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading text-text-main flex items-center gap-2">
            <Clock className="w-5 h-5 text-gold" />
            <span>Agenda de Hoje (Linha do Tempo)</span>
          </h2>
          <span className="text-xs text-text-muted">
            {agendamentosHoje.length} horário(s) agendado(s)
          </span>
        </div>

        {agendamentosHoje.length === 0 ? (
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-8 text-center space-y-3">
            <Calendar className="w-10 h-10 mx-auto text-text-muted/60" />
            <h3 className="font-heading text-base text-text-main">
              Nenhum agendamento para hoje
            </h3>
            <p className="text-xs text-text-muted max-w-xs mx-auto">
              A agenda de hoje está livre ou os clientes ainda não marcaram. Você pode cadastrar agendamentos manuais na aba Agenda.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {agendamentosHoje.map((ag) => {
              const statusColors: Record<string, string> = {
                agendado: "bg-surface-2 text-gold border-border-gold/30",
                confirmado: "bg-blue-500/10 text-blue-400 border-blue-500/30",
                concluido: "bg-success/15 text-success border-success/30",
                nao_compareceu: "bg-destructive/15 text-destructive border-destructive/30",
                cancelado: "bg-zinc-800 text-zinc-500 border-zinc-700",
              };

              const whatsAppLink = ag.cliente?.whatsapp
                ? getWhatsAppLink(
                    ag.cliente.whatsapp,
                    `Fala, ${ag.cliente.nome}! Gilmar aqui passando para confirmar seu atendimento hoje às ${formatTimeSaoPaulo(
                      ag.inicio
                    )} com a GS Elétrica.`
                  )
                : "#";

              return (
                <div
                  key={ag.id}
                  className="bg-surface-1 border border-border-subtle rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 transition-all hover:border-border-gold/40"
                >
                  {/* Horário e Identificação */}
                  <div className="flex items-start gap-4">
                    <div className="bg-surface-2 border border-border-gold/30 px-3 py-2 rounded-xl text-center shrink-0 min-w-[70px]">
                      <span className="text-lg font-bold font-heading text-gold block">
                        {formatTimeSaoPaulo(ag.inicio)}
                      </span>
                      <span className="text-[10px] text-text-muted block">60 min</span>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-heading text-base font-bold text-text-main">
                          {ag.cliente?.nome || "Cliente avulso"}
                        </h3>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${
                            statusColors[ag.status] || "bg-surface-2 text-text-muted"
                          }`}
                        >
                          {ag.status.replace("_", " ")}
                        </span>
                      </div>

                      {ag.cliente?.whatsapp && (
                        <p className="text-xs text-text-muted">
                          WhatsApp: {formatPhone(ag.cliente.whatsapp)}
                        </p>
                      )}

                      {/* Serviços */}
                      {ag.servicos && ag.servicos.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          {ag.servicos.map((s) => (
                            <span
                              key={s.id}
                              className="text-[10px] bg-surface-2 px-2 py-0.5 rounded text-text-muted"
                            >
                              {s.nome}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Valor e Ações Rápidas em 1 toque */}
                  <div className="flex flex-wrap items-center justify-between md:justify-end gap-3 pt-3 md:pt-0 border-t md:border-t-0 border-border-subtle">
                    <div className="text-left md:text-right pr-2">
                      <span className="text-base font-bold font-heading text-gold block">
                        {formatCurrency(ag.valor_total)}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {ag.pago ? "Pago" : "Pendente"}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Visualizar Fotos / Detalhes */}
                      <button
                        type="button"
                        onClick={() => setDetailModalAg(ag)}
                        className="bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 font-semibold text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                        title="Visualizar detalhes da solicitação e fotos anexadas"
                      >
                        <ImageIcon className="w-3.5 h-3.5" />
                        <span>Fotos / Detalhes</span>
                      </button>

                      {ag.status !== "concluido" && ag.status !== "cancelado" && (
                        <>
                          {/* Concluir */}
                          <button
                            type="button"
                            onClick={() => setCompleteModalAg(ag)}
                            className="bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs px-3.5 py-2 rounded-xl shadow-sm transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Concluir</span>
                          </button>

                        {/* WhatsApp */}
                        {ag.cliente?.whatsapp && (
                          <a
                            href={whatsAppLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs px-3 py-2 rounded-xl transition-colors flex items-center gap-1.5"
                          >
                            <WhatsAppIcon className="w-3.5 h-3.5 text-success fill-current" />
                            <span>Whats</span>
                          </a>
                        )}

                        {/* Falta / Não Compareceu */}
                        <button
                          type="button"
                          onClick={() => handleNaoCompareceu(ag)}
                          className="bg-surface-2 hover:bg-destructive/20 text-destructive border border-border-subtle text-xs px-2.5 py-2 rounded-xl transition-colors"
                          title="Marcar falta (gera multa de 50%)"
                        >
                          Falta
                        </button>

                        {/* Cancelar */}
                        <button
                          type="button"
                          onClick={() => setCancelModalAg(ag)}
                          className="text-text-muted hover:text-destructive text-xs px-2 py-2"
                          title="Cancelar horário"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* SEÇÃO DE ALERTAS: SUMIDOS, ANIVERSARIANTES E MULTAS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-2">
        {/* Alerta 1: Clientes Sumidos (15+ dias) */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2 text-warning">
              <AlertTriangle className="w-4 h-4" />
              <h3 className="font-heading text-sm font-bold text-text-main">
                Clientes Sumidos
              </h3>
            </div>
            <span className="text-[10px] bg-warning/15 text-warning font-bold px-2 py-0.5 rounded-full">
              {alertas.clientesSumidos.length}
            </span>
          </div>

          {alertas.clientesSumidos.length === 0 ? (
            <p className="text-xs text-text-muted italic">Nenhum cliente sumido no momento!</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {alertas.clientesSumidos.slice(0, 5).map((c) => {
                const msg = `Fala, ${c.nome}! Gilmar da GS Elétrica por aqui. Tudo bem? Passando para saber se você precisa de alguma manutenção elétrica ou nova instalação por aí!`;
                const link = getWhatsAppLink(c.whatsapp, msg);

                return (
                  <div
                    key={c.id}
                    className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <h4 className="font-semibold text-text-main">{c.nome}</h4>
                      <span className="text-warning text-[11px]">
                        Sem vir há {c.dias_sem_vir} dias
                      </span>
                    </div>

                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-success/20 hover:bg-success/30 text-success text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <WhatsAppIcon className="w-3 h-3 fill-current" />
                      <span>Chamar</span>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alerta 2: Aniversariantes da Semana */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2 text-gold">
              <Gift className="w-4 h-4" />
              <h3 className="font-heading text-sm font-bold text-text-main">
                Aniversariantes
              </h3>
            </div>
            <span className="text-[10px] bg-gold/15 text-gold font-bold px-2 py-0.5 rounded-full">
              {alertas.aniversariantesSemana.length}
            </span>
          </div>

          {alertas.aniversariantesSemana.length === 0 ? (
            <p className="text-xs text-text-muted italic">Nenhum aniversariante nesta semana.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {alertas.aniversariantesSemana.map((c) => {
                const msg = `Parabéns, ${c.nome}! O Gilmar da GS Elétrica te deseja muitas felicidades, saúde e muito sucesso!`;
                const link = getWhatsAppLink(c.whatsapp, msg);

                return (
                  <div
                    key={c.id}
                    className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 flex items-center justify-between gap-2 text-xs"
                  >
                    <div>
                      <h4 className="font-semibold text-text-main">{c.nome}</h4>
                      <span className="text-gold text-[11px]">
                        {c.data_nascimento?.split("-").reverse().slice(0, 2).join("/")}
                      </span>
                    </div>

                    <a
                      href={link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bg-gold/20 hover:bg-gold/30 text-gold text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1 shrink-0"
                    >
                      <WhatsAppIcon className="w-3 h-3 fill-current" />
                      <span>Parabéns</span>
                    </a>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Alerta 3: Multas Pendentes */}
        <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-border-subtle pb-3">
            <div className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="w-4 h-4" />
              <h3 className="font-heading text-sm font-bold text-text-main">
                Multas Pendentes
              </h3>
            </div>
            <span className="text-[10px] bg-destructive/15 text-destructive font-bold px-2 py-0.5 rounded-full">
              {alertas.multasPendentes.length}
            </span>
          </div>

          {alertas.multasPendentes.length === 0 ? (
            <p className="text-xs text-text-muted italic">Nenhuma multa pendente no sistema.</p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
              {alertas.multasPendentes.map((m) => (
                <div
                  key={m.id}
                  className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 flex flex-col gap-2 text-xs"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-semibold text-text-main">
                        {m.cliente?.nome || "Cliente"}
                      </h4>
                      <span className="text-destructive font-bold">
                        {formatCurrency(m.valor)}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1 border-t border-border-subtle/50">
                    <button
                      type="button"
                      onClick={() => handleBaixarMulta(m.id, "paga")}
                      className="flex-1 bg-success/20 hover:bg-success/30 text-success text-[11px] font-bold py-1 rounded transition-colors"
                    >
                      Recebida (Pix)
                    </button>
                    <button
                      type="button"
                      onClick={() => handleBaixarMulta(m.id, "perdoada")}
                      className="flex-1 bg-surface-2 hover:bg-surface-3 text-text-muted text-[11px] py-1 rounded transition-colors"
                    >
                      Perdoar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* MODAL CONCLUIR ATENDIMENTO */}
      {completeModalAg && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setCompleteModalAg(null)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-heading text-lg font-bold text-text-main">
                Concluir Atendimento
              </h3>
              <button
                type="button"
                onClick={() => setCompleteModalAg(null)}
                className="text-text-muted hover:text-text-main text-sm"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleConcluir} className="space-y-4 text-xs">
              <div className="bg-surface-2/70 p-3 rounded-xl space-y-1">
                <span className="text-text-muted">Cliente:</span>
                <p className="font-bold text-text-main text-sm">
                  {completeModalAg.cliente?.nome}
                </p>
                <div className="flex justify-between pt-1">
                  <span className="text-text-muted">Valor a cobrar:</span>
                  <span className="font-bold text-gold text-base font-heading">
                    {formatCurrency(completeModalAg.valor_total)}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-text-muted block mb-1.5 font-medium">
                  Forma de Pagamento:
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: "pix", label: "Pix" },
                    { id: "dinheiro", label: "Dinheiro" },
                    { id: "debito", label: "Débito" },
                    { id: "credito", label: "Crédito" },
                    { id: "credito_pre_pago", label: "Crédito Pré-Pago" },
                  ].map((fp) => (
                    <button
                      key={fp.id}
                      type="button"
                      onClick={() => {
                        setFormaPagamento(fp.id as FormaPagamento);
                        if (fp.id === "credito_pre_pago") setUsarCredito(true);
                        else setUsarCredito(false);
                      }}
                      className={`p-2.5 rounded-xl border text-center transition-all ${
                        formaPagamento === fp.id
                          ? "bg-gold text-bg-base font-bold border-gold"
                          : "bg-surface-2 border-border-subtle text-text-main"
                      }`}
                    >
                      {fp.label}
                    </button>
                  ))}
                </div>
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={pago}
                  onChange={(e) => setPago(e.target.checked)}
                  className="w-4 h-4 rounded border-border-subtle text-gold accent-gold"
                />
                <span className="text-text-main font-medium">
                  Marcar como pago (lança entrada no financeiro)
                </span>
              </label>

              <button
                type="submit"
                disabled={isCompleting}
                className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-sm py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isCompleting ? "Concluindo..." : "Confirmar Conclusão"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CANCELAR ATENDIMENTO ADMIN */}
      {cancelModalAg && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setCancelModalAg(null)}
        >
          <div
            className="bg-surface-1 border border-border-subtle rounded-3xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg font-bold text-destructive">
              Cancelar Horário
            </h3>
            <p className="text-xs text-text-muted">
              Tem certeza que deseja cancelar o agendamento de{" "}
              <strong className="text-text-main">{cancelModalAg.cliente?.nome}</strong> para{" "}
              {formatTimeSaoPaulo(cancelModalAg.inicio)}? O horário será liberado na agenda.
            </p>

            <div>
              <label className="text-xs text-text-muted block mb-1">Motivo:</label>
              <input
                type="text"
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Ex: Cliente solicitou pelo WhatsApp"
                className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-gold"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isCanceling}
                onClick={handleCancelar}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-text-main font-bold text-xs py-2.5 rounded-xl transition-all"
              >
                {isCanceling ? "Cancelando..." : "Confirmar Cancelamento"}
              </button>
              <button
                type="button"
                onClick={() => setCancelModalAg(null)}
                className="flex-1 bg-surface-2 text-text-main text-xs py-2.5 rounded-xl border border-border-subtle"
              >
                Voltar
              </button>
            </div>
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
