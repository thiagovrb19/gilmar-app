"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Star,
  XCircle,
  MessageCircle,
  Sparkles,
  ChevronRight,
  ShieldAlert,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Agendamento, Multa, Configuracao } from "@/lib/supabase/types";
import { PixDisplay } from "@/components/pix/pix-display";
import { formatCurrency, getWhatsAppLink } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo, toSaoPaulo } from "@/lib/date/tz";
import { cancelarMeuAgendamentoAction, enviarAvaliacaoAction } from "@/actions/booking";
import { useRealtimeSync, broadcastSync } from "@/hooks/use-realtime-sync";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { abrirPropostaPDF } from "@/lib/pdf/proposta-pdf";
import { WHATSAPP_COMERCIAL } from "@/lib/whatsapp";

interface ClientBookingsViewProps {
  proximos: Agendamento[];
  historico: Agendamento[];
  multas: Multa[];
  config: Configuracao;
}

export function ClientBookingsView({
  proximos,
  historico,
  multas,
  config,
}: ClientBookingsViewProps) {
  const router = useRouter();

  // Sincronização em tempo real para o cliente (WebSockets + BroadcastChannel + foco)
  useRealtimeSync({
    tables: ["agendamentos", "multas"],
    onSync: () => router.refresh(),
  });
  const [selectedMultaPix, setSelectedMultaPix] = useState<Multa | null>(null);

  // Estados para modal de cancelamento
  const [cancelModalAg, setCancelModalAg] = useState<Agendamento | null>(null);
  const [cancelMotivo, setCancelMotivo] = useState("");
  const [isCanceling, setIsCanceling] = useState(false);

  // Estados para modal de avaliação
  const [reviewModalAg, setReviewModalAg] = useState<Agendamento | null>(null);
  const [reviewNota, setReviewNota] = useState<number>(5);
  const [reviewComentario, setReviewComentario] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);

  const calculateHoursToStart = (inicioIso: string) => {
    const diffMs = new Date(inicioIso).getTime() - new Date().getTime();
    return diffMs / (1000 * 60 * 60);
  };

  const handleConfirmCancel = async () => {
    if (!cancelModalAg) return;
    setIsCanceling(true);

    const res = await cancelarMeuAgendamentoAction(cancelModalAg.id, cancelMotivo);
    setIsCanceling(false);

    if (!res.success) {
      toast.error(res.error || "Não foi possível cancelar.");
      return;
    }

    if (res.gerou_multa) {
      toast.warning(
        `Agendamento cancelado com menos de ${config.horas_cancelamento_gratis}h. Multa de ${formatCurrency(
          res.valor_multa || 0
        )} gerada.`
      );
    } else {
      toast.success("Agendamento cancelado com sucesso sem cobrança.");
    }

    setCancelModalAg(null);
    broadcastSync("agendamentos");
    broadcastSync("multas");
    router.refresh();
  };

  const handleConfirmReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewModalAg) return;
    setIsSubmittingReview(true);

    const res = await enviarAvaliacaoAction(
      reviewModalAg.id,
      reviewNota,
      reviewComentario
    );
    setIsSubmittingReview(false);

    if (!res.success) {
      toast.error(res.error || "Erro ao salvar avaliação.");
      return;
    }

    toast.success("Obrigado pela sua avaliação!");
    setReviewModalAg(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* 1. ALERTA DE MULTAS PENDENTES (Se houver) */}
      {multas.length > 0 && (
        <div className="bg-destructive/10 border-2 border-destructive/40 rounded-2xl p-5 space-y-3 animate-in shake duration-300">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-destructive shrink-0 mt-0.5" />
            <div className="flex-1 space-y-1">
              <h3 className="font-heading text-base text-destructive font-bold">
                Você possui {multas.length} multa(s) pendente(s)
              </h3>
              <p className="text-xs text-text-muted leading-relaxed">
                Referente a cancelamento fora do prazo de 3h ou ausência. Regularize via Pix para manter seu cadastro apto a novos horários.
              </p>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            {multas.map((m) => (
              <div
                key={m.id}
                className="bg-surface-1 border border-border-subtle rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <span className="text-xs text-text-muted block">Multa por cancelamento</span>
                  <span className="text-base font-bold font-heading text-destructive">
                    {formatCurrency(m.valor)}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedMultaPix(m)}
                  className="bg-destructive hover:bg-destructive/90 text-text-main text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-sm active:scale-95"
                >
                  Pagar via Pix
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL PIX PARA MULTA */}
      {selectedMultaPix && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setSelectedMultaPix(null)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center pb-3 border-b border-border-subtle mb-4">
              <span className="font-heading text-base font-bold text-gold">
                Pagar Multa Pendente
              </span>
              <button
                type="button"
                onClick={() => setSelectedMultaPix(null)}
                className="text-text-muted hover:text-text-main text-sm"
              >
                Fechar
              </button>
            </div>

            <PixDisplay
              valor={selectedMultaPix.valor}
              chave={config.pix_chave}
              nomeRecebedor={config.pix_nome}
              cidade={config.pix_cidade}
              descricao="Após o pagamento, o Gilmar dará baixa manual no sistema."
            />
          </div>
        </div>
      )}

      {/* 2. PRÓXIMOS AGENDAMENTOS */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-bold font-heading text-text-main">
            Próximos Agendamentos
          </h2>
          <Link
            href="/agendar"
            className="text-xs text-gold hover:text-gold-hover font-semibold flex items-center gap-1"
          >
            Novo Agendamento &rarr;
          </Link>
        </div>

        {proximos.length === 0 ? (
          <div className="bg-surface-1 border border-border-subtle rounded-2xl p-8 text-center space-y-3">
            <Calendar className="w-10 h-10 mx-auto text-text-muted/60" />
            <h3 className="font-heading text-base text-text-main font-semibold">
              Você não tem agendamentos futuros
            </h3>
            <p className="text-xs text-text-muted max-w-xs mx-auto">
              Garanta seu atendimento! Solicite seu orçamento ou agendamento com o Gilmar Sales.
            </p>
            <Link
              href="/agendar"
              className="inline-block bg-gold hover:bg-gold-hover text-bg-base text-xs font-bold px-5 py-2.5 rounded-xl shadow-md transition-all active:scale-95"
            >
              Agendar Agora
            </Link>
          </div>
        ) : (
          <div className="space-y-3.5">
            {proximos.map((ag) => {
              const hoursLeft = calculateHoursToStart(ag.inicio);
              const willHaveFine = hoursLeft < config.horas_cancelamento_gratis;

              return (
                <div
                  key={ag.id}
                  className="bg-surface-1 border border-border-gold/40 rounded-2xl p-5 shadow-lg space-y-4 relative overflow-hidden"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="inline-flex items-center gap-1.5 bg-surface-2 px-2.5 py-1 rounded-full text-[10px] font-semibold text-gold border border-border-gold/30 mb-2">
                        <Clock className="w-3 h-3" />
                        <span>Confirmado &bull; 60 min</span>
                      </div>

                      <h3 className="font-heading text-lg font-bold text-text-main">
                        {formatDateFriendly(ag.inicio)}
                      </h3>
                      <span className="text-xl font-bold font-heading text-gold block">
                        às {formatTimeSaoPaulo(ag.inicio)}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-lg font-bold font-heading text-gold block">
                        {formatCurrency(ag.valor_total)}
                      </span>
                      <span className="text-[10px] text-text-muted">
                        {ag.pago ? "Pago" : "Pagar no atendimento"}
                      </span>
                    </div>
                  </div>

                  {/* Serviços vinculados */}
                  {ag.servicos && ag.servicos.length > 0 && (
                    <div className="text-xs text-text-muted border-t border-border-subtle/60 pt-2 flex flex-wrap gap-2">
                      {ag.servicos.map((s) => (
                        <span
                          key={s.id}
                          className="bg-surface-2 px-2 py-0.5 rounded-md text-[11px] text-text-main"
                        >
                          {s.nome}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Ações: Cancelar e Reagendar */}
                  <div className="pt-2 border-t border-border-subtle flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setCancelModalAg(ag)}
                      className="text-xs text-destructive hover:underline font-medium"
                    >
                      Cancelar Horário
                    </button>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const itensDetalhados =
                            ag.proposta_itens_json && ag.proposta_itens_json.length > 0
                              ? ag.proposta_itens_json
                              : (ag.servicos || []).map((s, idx) => ({
                                  numero: String(idx + 1).padStart(2, "0"),
                                  identificacao: `Máquina / Ponto ${String(idx + 1).padStart(2, "0")}`,
                                  servicoNome: s.nome,
                                  escopo: `${s.nome} — execução técnica especializada conforme padrão GS Elétrica e Manutenção.`,
                                  descricao:
                                    s.descricao ||
                                    "Fornecimento e instalação técnica especializada com materiais adequados, testes funcionais e acabamento profissional.",
                                  quantidade: 1,
                                  valorUnitario: Number(s.preco || 0),
                                  valorTotal: Number(s.preco || 0),
                                  fotoUrl: null,
                                  icone: s.icone,
                                }));

                          const ok = abrirPropostaPDF({
                            numeroPedido: ag.id.slice(0, 8).toUpperCase(),
                            clienteNome: ag.cliente?.nome || "Cliente",
                            clienteWhatsapp: ag.cliente?.whatsapp || "",
                            clienteLocalidade: ag.cliente_localidade || undefined,
                            subtitulo: ag.proposta_subtitulo || undefined,
                            objetivo: ag.proposta_objetivo || undefined,
                            condicoesPagamento: ag.proposta_condicoes_pagamento || undefined,
                            observacaoCliente: ag.observacao || undefined,
                            itens: itensDetalhados,
                            valorTotal: ag.valor_total,
                          });
                          if (ok) {
                            toast.success("Proposta Comercial aberta para salvar em PDF!");
                          }
                        }}
                        className="inline-flex items-center gap-1 text-xs text-white font-semibold bg-[#0e74bc] hover:bg-[#0c63a0] px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Orçamento PDF</span>
                      </button>

                      <a
                        href={getWhatsAppLink(
                          WHATSAPP_COMERCIAL,
                          `Olá, Gilmar! Tenho um orçamento/agendamento no dia ${formatDateFriendly(
                            ag.inicio
                          )} às ${formatTimeSaoPaulo(ag.inicio)}. Segue em anexo meu orçamento em PDF.`
                        )}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-text-muted hover:text-text-main bg-surface-2 px-3 py-1.5 rounded-lg border border-border-subtle"
                      >
                        <WhatsAppIcon className="w-3.5 h-3.5 text-success fill-current" />
                        <span>WhatsApp</span>
                      </a>

                      <Link
                        href="/agendar"
                        className="inline-flex items-center gap-1 text-xs text-bg-base font-semibold bg-gold hover:bg-gold-hover px-3 py-1.5 rounded-lg shadow-sm"
                      >
                        Novo / Reagendar
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 3. HISTÓRICO DE ATENDIMENTOS */}
      <section className="space-y-4 pt-4 border-t border-border-subtle">
        <h2 className="text-xl font-bold font-heading text-text-main">
          Histórico Passado
        </h2>

        {historico.length === 0 ? (
          <p className="text-xs text-text-muted italic">Nenhum histórico anterior registrado.</p>
        ) : (
          <div className="space-y-3">
            {historico.map((ag) => {
              const isConcluido = ag.status === "concluido";
              const isCancelado = ag.status === "cancelado";

              return (
                <div
                  key={ag.id}
                  className="bg-surface-1/60 border border-border-subtle rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full block">
                        {ag.status === "concluido" ? (
                          <span className="bg-success/15 text-success border border-success/30 px-2 py-0.5 rounded-full">
                            Concluído
                          </span>
                        ) : ag.status === "cancelado" ? (
                          <span className="bg-destructive/15 text-destructive border border-destructive/30 px-2 py-0.5 rounded-full">
                            Cancelado
                          </span>
                        ) : (
                          <span className="bg-warning/15 text-warning border border-warning/30 px-2 py-0.5 rounded-full">
                            Não Compareceu
                          </span>
                        )}
                      </span>
                      {ag.origem === "fixo" && (
                        <span className="text-[10px] bg-gold/15 text-gold font-bold px-2 py-0.5 rounded-full border border-gold/30">
                          Recorrente
                        </span>
                      )}
                    </div>

                    <h4 className="font-semibold text-text-main text-sm">
                      {formatDateFriendly(ag.inicio)} às {formatTimeSaoPaulo(ag.inicio)}
                    </h4>

                    {/* Serviços */}
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

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-border-subtle">
                    <span className="font-bold font-heading text-gold text-sm block">
                      {formatCurrency(ag.valor_total)}
                    </span>

                    {isConcluido && (
                      <button
                        type="button"
                        onClick={() => setReviewModalAg(ag)}
                        className="inline-flex items-center gap-1 bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/30 px-3 py-1.5 rounded-xl font-medium"
                      >
                        <Star className="w-3.5 h-3.5 fill-gold" />
                        <span>Avaliar</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* MODAL DE CONFIRMAÇÃO DE CANCELAMENTO COM AVISO DE MULTA */}
      {cancelModalAg && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setCancelModalAg(null)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 text-destructive">
              <AlertTriangle className="w-6 h-6" />
              <h3 className="font-heading text-lg font-bold text-text-main">
                Confirmar Cancelamento
              </h3>
            </div>

            <div className="text-xs text-text-muted space-y-2">
              <p>
                Você está prestes a cancelar o agendamento de{" "}
                <strong className="text-text-main">
                  {formatDateFriendly(cancelModalAg.inicio)} às{" "}
                  {formatTimeSaoPaulo(cancelModalAg.inicio)}
                </strong>
                .
              </p>

              {calculateHoursToStart(cancelModalAg.inicio) < config.horas_cancelamento_gratis ? (
                <div className="bg-destructive/15 border border-destructive/40 rounded-xl p-3 text-destructive font-medium space-y-1">
                  <p className="font-bold">⚠️ ATENÇÃO: Menos de {config.horas_cancelamento_gratis} horas de antecedência!</p>
                  <p className="text-[11px] text-text-main leading-relaxed">
                    Conforme as políticas da empresa, cancelamentos de última hora podem gerar cobrança de{" "}
                    <strong>
                      {config.multa_percentual}% ({formatCurrency(cancelModalAg.valor_total * (config.multa_percentual / 100))})
                    </strong>
                    .
                  </p>
                </div>
              ) : (
                <p className="text-success font-medium">
                  ✔ Cancelamento sem custo (antecedência maior que {config.horas_cancelamento_gratis} horas).
                </p>
              )}
            </div>

            <div>
              <label className="text-xs text-text-muted block mb-1">Motivo (opcional):</label>
              <input
                type="text"
                value={cancelMotivo}
                onChange={(e) => setCancelMotivo(e.target.value)}
                placeholder="Ex: Imprevisto de trabalho..."
                className="w-full bg-surface-2 border border-border-subtle rounded-xl px-3 py-2 text-xs text-text-main focus:outline-none focus:border-gold"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                disabled={isCanceling}
                onClick={handleConfirmCancel}
                className="flex-1 bg-destructive hover:bg-destructive/90 text-text-main font-bold text-xs py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isCanceling ? "Cancelando..." : "Sim, confirmar cancelamento"}
              </button>
              <button
                type="button"
                onClick={() => setCancelModalAg(null)}
                className="flex-1 bg-surface-2 text-text-main font-medium text-xs py-3 rounded-xl border border-border-subtle"
              >
                Voltar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE AVALIAÇÃO DE ATENDIMENTO */}
      {reviewModalAg && (
        <div
          role="dialog"
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setReviewModalAg(null)}
        >
          <div
            className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 max-w-md w-full space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="font-heading text-lg font-bold text-text-main">
                Avaliar Atendimento
              </h3>
              <button
                type="button"
                onClick={() => setReviewModalAg(null)}
                className="text-text-muted hover:text-text-main"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleConfirmReview} className="space-y-4">
              <div className="text-center space-y-2">
                <span className="text-xs text-text-muted">Como foi seu atendimento com o Gilmar?</span>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((nota) => (
                    <button
                      key={nota}
                      type="button"
                      onClick={() => setReviewNota(nota)}
                      className="p-1 transition-transform active:scale-125"
                    >
                      <Star
                        className={`w-7 h-7 ${
                          nota <= reviewNota
                            ? "text-gold fill-gold"
                            : "text-text-muted/40"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-text-muted block mb-1">Deixe um comentário (opcional):</label>
                <textarea
                  rows={3}
                  value={reviewComentario}
                  onChange={(e) => setReviewComentario(e.target.value)}
                  placeholder="Ex: Excelente serviço elétrico, pontual e atencioso!"
                  className="w-full bg-surface-2 border border-border-subtle rounded-xl p-3 text-xs text-text-main focus:outline-none focus:border-gold resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={isSubmittingReview}
                className="w-full bg-gold hover:bg-gold-hover text-bg-base font-bold text-xs py-3 rounded-xl transition-all shadow-md active:scale-95 disabled:opacity-50"
              >
                {isSubmittingReview ? "Enviando avaliação..." : "Enviar Avaliação"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
