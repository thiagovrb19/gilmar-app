"use client";

import React from "react";
import {
  X,
  Calendar,
  Clock,
  DollarSign,
  User,
  Phone,
  FileText,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Printer,
} from "lucide-react";
import { toast } from "sonner";
import { Agendamento } from "@/lib/supabase/types";
import { formatCurrency, formatPhone, getWhatsAppLink } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo } from "@/lib/date/tz";
import { AdminAttachmentGallery } from "./admin-attachment-gallery";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { numeroDoPedido } from "@/lib/whatsapp";
import { abrirPropostaPDF } from "@/lib/pdf/proposta-pdf";

interface AdminAppointmentDetailModalProps {
  agendamento: Agendamento | null;
  onClose: () => void;
  onRefresh?: () => void;
}

export function AdminAppointmentDetailModal({
  agendamento,
  onClose,
  onRefresh,
}: AdminAppointmentDetailModalProps) {
  if (!agendamento) return null;

  const dataFormatada = formatDateFriendly(agendamento.inicio);
  const horaFormatada = formatTimeSaoPaulo(agendamento.inicio);
  const pedidoNum = numeroDoPedido(agendamento.id);

  const whatsAppLink = agendamento.cliente?.whatsapp
    ? getWhatsAppLink(
        agendamento.cliente.whatsapp,
        `Olá, ${agendamento.cliente.nome}! Aqui é o Gilmar da GS Elétrica e Manutenção. Estou analisando sua solicitação de orçamento ${pedidoNum}.`
      )
    : null;

  const statusColors: Record<string, string> = {
    agendado: "bg-surface-2 text-gold border-border-gold/30",
    confirmado: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    concluido: "bg-success/15 text-success border-success/30",
    nao_compareceu: "bg-destructive/15 text-destructive border-destructive/30",
    cancelado: "bg-zinc-800 text-zinc-500 border-zinc-700",
  };

  return (
    <div
      role="dialog"
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="bg-surface-1 border border-border-gold/50 rounded-3xl p-5 sm:p-6 max-w-2xl w-full max-h-[92vh] overflow-y-auto space-y-5 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* CABEÇALHO DO MODAL */}
        <div className="flex items-start justify-between border-b border-border-subtle pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs bg-gold/15 text-gold border border-gold/40 px-2.5 py-0.5 rounded-full font-bold">
                {pedidoNum}
              </span>
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded-full border capitalize ${
                  statusColors[agendamento.status] || "bg-surface-2 text-text-muted"
                }`}
              >
                {agendamento.status.replace("_", " ")}
              </span>
              {agendamento.origem === "fixo" && (
                <span className="text-[10px] bg-gold/15 text-gold font-bold px-2 py-0.5 rounded-full border border-gold/30">
                  Recorrente
                </span>
              )}
            </div>
            <h2 className="font-heading text-lg sm:text-xl font-bold text-text-main">
              Detalhes da Solicitação de Orçamento
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-surface-2 hover:bg-surface-3 text-text-muted hover:text-text-main flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* INFORMAÇÕES DO CLIENTE */}
        <div className="bg-surface-2/60 border border-border-subtle rounded-2xl p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-gold/15 text-gold border border-gold/30 flex items-center justify-center shrink-0">
                <User className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-text-main text-sm leading-tight">
                  {agendamento.cliente?.nome || "Cliente avulso"}
                </h3>
                {agendamento.cliente?.whatsapp ? (
                  <p className="text-xs text-text-muted">
                    {formatPhone(agendamento.cliente.whatsapp)}
                  </p>
                ) : (
                  <p className="text-xs text-text-muted italic">Telefone não informado</p>
                )}
              </div>
            </div>

            {whatsAppLink && (
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 bg-success/20 hover:bg-success/30 text-success border border-success/40 text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors shrink-0"
              >
                <WhatsAppIcon className="w-3.5 h-3.5 fill-current" />
                <span>Conversar no WhatsApp</span>
              </a>
            )}
          </div>
        </div>

        {/* DATA, HORÁRIO E VALORES */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <div className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 space-y-0.5">
            <span className="text-text-muted flex items-center gap-1">
              <Calendar className="w-3 h-3 text-gold" />
              <span>Data sugerida</span>
            </span>
            <p className="font-semibold text-text-main capitalize truncate">
              {dataFormatada}
            </p>
          </div>

          <div className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 space-y-0.5">
            <span className="text-text-muted flex items-center gap-1">
              <Clock className="w-3 h-3 text-gold" />
              <span>Horário</span>
            </span>
            <p className="font-semibold text-text-main">{horaFormatada} (60 min)</p>
          </div>

          <div className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 space-y-0.5 col-span-2 sm:col-span-1">
            <span className="text-text-muted flex items-center gap-1">
              <DollarSign className="w-3 h-3 text-gold" />
              <span>Valor de referência</span>
            </span>
            <p className="font-bold text-gold text-sm font-heading">
              {formatCurrency(agendamento.valor_total)}
            </p>
          </div>
        </div>

        {/* SERVIÇOS SELECIONADOS */}
        {agendamento.servicos && agendamento.servicos.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Serviços Selecionados
            </h4>
            <div className="space-y-1.5">
              {agendamento.servicos.map((s) => (
                <div
                  key={s.id}
                  className="bg-surface-2/60 border border-border-subtle rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <span className="text-text-main font-medium">{s.nome}</span>
                  <span className="text-gold font-semibold">{formatCurrency(s.preco)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* OBSERVAÇÕES DO CLIENTE */}
        {agendamento.observacao && (
          <div className="space-y-1.5">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <FileText className="w-3 h-3 text-gold" />
              <span>Observações do Cliente</span>
            </h4>
            <div className="bg-surface-2/80 border border-border-gold/30 rounded-xl p-3 text-xs text-text-main italic leading-relaxed">
              &ldquo;{agendamento.observacao}&rdquo;
            </div>
          </div>
        )}

        {/* SEÇÃO: IMAGENS ANEXADAS PELO CLIENTE */}
        <div className="space-y-2 pt-1">
          <AdminAttachmentGallery
            agendamentoId={agendamento.id}
            onAnexoRemovido={onRefresh}
          />
        </div>

        {/* BOTÃO GERAR PDF E FECHAR */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => {
              const itensDetalhados =
                agendamento.proposta_itens_json && agendamento.proposta_itens_json.length > 0
                  ? agendamento.proposta_itens_json
                  : (agendamento.servicos || []).map((s, idx) => ({
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
                numeroPedido: pedidoNum,
                clienteNome: agendamento.cliente?.nome || "Cliente",
                clienteWhatsapp: agendamento.cliente?.whatsapp || "",
                clienteLocalidade: agendamento.cliente_localidade || undefined,
                subtitulo: agendamento.proposta_subtitulo || undefined,
                objetivo: agendamento.proposta_objetivo || undefined,
                condicoesPagamento: agendamento.proposta_condicoes_pagamento || undefined,
                observacaoCliente: agendamento.observacao || undefined,
                itens: itensDetalhados,
                valorTotal: agendamento.valor_total,
              });
              if (ok) {
                toast.success("Proposta Comercial aberta para impressão / Salvar como PDF!");
              } else {
                toast.error("Permita pop-ups no navegador para abrir o PDF.");
              }
            }}
            className="inline-flex items-center gap-1.5 bg-[#0e74bc] hover:bg-[#0c63a0] text-white font-bold text-xs px-4 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Gerar Proposta Comercial (PDF)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors"
          >
            Fechar Detalhes
          </button>
        </div>
      </div>
    </div>
  );
}
