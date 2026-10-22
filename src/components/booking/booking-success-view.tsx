"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Calendar,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  MessageCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { PixDisplay } from "@/components/pix/pix-display";
import { downloadICSFile } from "@/lib/calendar/ics";
import { formatCurrency } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo } from "@/lib/date/tz";
import { Configuracao } from "@/lib/supabase/types";
import { IconWhatsApp } from "@/components/icons/barber-icons";
import {
  WHATSAPP_COMERCIAL,
  numeroDoPedido,
  agruparItens,
  linkWhatsAppPedido,
  montarMensagemPedido,
  ResumoPedido,
} from "@/lib/whatsapp";
import { toast } from "sonner";

interface BookingSuccessViewProps {
  agendamentoId: string;
  valorTotal: number;
  inicioIso: string;
  config: Configuracao;
  resumo?: {
    id: string;
    clienteNome: string;
    inicio: string | null;
    valorTotal: number;
    desconto: number;
    observacao: string | null;
    servicos: { nome: string; preco: number }[];
    anexosCount: number;
  } | null;
  anexosCount?: number;
}

export function BookingSuccessView({
  agendamentoId,
  valorTotal,
  inicioIso,
  config,
  resumo,
  anexosCount = 0,
}: BookingSuccessViewProps) {
  const [showPix, setShowPix] = useState(false);
  const [appLink, setAppLink] = useState<string>("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppLink(`${window.location.origin}/meus-agendamentos`);
    }
  }, []);

  const dataHoraInicio = new Date(inicioIso);
  const dataHoraFim = new Date(dataHoraInicio.getTime() + 60 * 60 * 1000);

  const dataFormatada = formatDateFriendly(inicioIso);
  const horaFormatada = formatTimeSaoPaulo(inicioIso);

  const finalAnexosCount = Math.max(anexosCount, resumo?.anexosCount || 0);
  const pedidoNum = numeroDoPedido(agendamentoId);

  // Monta objeto consolidado para a mensagem do WhatsApp
  const pedidoResumo: ResumoPedido = {
    id: agendamentoId,
    numero: pedidoNum,
    clienteNome: resumo?.clienteNome || "Cliente",
    inicio: inicioIso,
    itens: agruparItens(resumo?.servicos || []),
    desconto: resumo?.desconto || 0,
    valorTotal: valorTotal > 0 ? valorTotal : (resumo?.valorTotal || 0),
    observacao: resumo?.observacao || null,
    anexosCount: finalAnexosCount,
  };

  const whatsAppLink = linkWhatsAppPedido(pedidoResumo, appLink);
  const whatsAppTexto = montarMensagemPedido(pedidoResumo, appLink);

  const handleCopiarMensagem = async () => {
    try {
      await navigator.clipboard.writeText(whatsAppTexto);
      toast.success("Mensagem do WhatsApp copiada!");
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleDownloadCalendar = () => {
    downloadICSFile({
      title: `GS Elétrica e Manutenção - Atendimento ${pedidoNum}`,
      description: `Atendimento com Gilmar Sales (GS Elétrica e Manutenção). Valor de referência: ${formatCurrency(
        valorTotal
      )}.`,
      location: config.endereco || "Visconde do Rio Branco - MG e região",
      startDate: dataHoraInicio,
      endDate: dataHoraFim,
    });
  };

  return (
    <div className="space-y-6">
      {/* CARD PRINCIPAL DE SUCESSO */}
      <div className="bg-surface-1 border border-border-gold/60 rounded-3xl p-6 sm:p-8 text-center space-y-5 shadow-2xl relative overflow-hidden">
        <div className="w-16 h-16 rounded-2xl bg-success/20 text-success border border-success/40 mx-auto flex items-center justify-center animate-in zoom-in-75 duration-300 shadow-lg">
          <CheckCircle2 className="w-9 h-9 stroke-[2.2]" />
        </div>

        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 bg-gold/15 text-gold border border-gold/40 text-xs font-bold px-3 py-1 rounded-full font-mono">
            <span>Pedido {pedidoNum}</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold font-heading text-text-main">
            Solicitação Enviada com Sucesso!
          </h1>
          <p className="text-xs sm:text-sm text-text-muted max-w-md mx-auto">
            Sua solicitação de orçamento foi registrada no sistema da{" "}
            <strong className="text-text-main">GS Elétrica e Manutenção</strong>.
          </p>
        </div>

        {/* DETALHES DO PEDIDO / SOLICITAÇÃO */}
        <div className="bg-surface-2/70 border border-border-subtle rounded-2xl p-4 text-left space-y-2.5 max-w-md mx-auto text-xs sm:text-sm shadow-inner">
          <div className="flex justify-between">
            <span className="text-text-muted">Data & Horário sugerido:</span>
            <span className="font-semibold text-text-main capitalize">
              {dataFormatada}, às {horaFormatada}
            </span>
          </div>

          <div className="flex justify-between items-center border-t border-border-subtle/60 pt-2">
            <span className="text-text-muted flex items-center gap-1.5">
              <ImageIcon className="w-3.5 h-3.5 text-gold" />
              <span>Fotos anexadas:</span>
            </span>
            <span
              className={`font-semibold px-2 py-0.5 rounded-md text-[11px] ${
                finalAnexosCount > 0
                  ? "bg-gold/20 text-gold border border-gold/40 font-bold"
                  : "bg-surface-3 text-text-muted"
              }`}
            >
              {finalAnexosCount > 0
                ? `${finalAnexosCount} foto(s) anexada(s)`
                : "Nenhuma foto"}
            </span>
          </div>

          {resumo?.servicos && resumo.servicos.length > 0 && (
            <div className="border-t border-border-subtle/60 pt-2 space-y-1">
              <span className="text-text-muted text-[11px] block">Serviços solicitados:</span>
              {agruparItens(resumo.servicos).map((it, idx) => (
                <div key={idx} className="flex justify-between text-xs">
                  <span className="text-text-main">
                    • {it.quantidade}x {it.nome}
                  </span>
                  <span className="text-gold font-medium">
                    {formatCurrency(it.valorUnitario * it.quantidade)}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between border-t border-border-subtle/60 pt-2 items-baseline">
            <span className="text-text-muted">Valor de referência:</span>
            <span className="font-bold text-gold text-lg font-heading">
              {formatCurrency(valorTotal)}
            </span>
          </div>
        </div>

        {/* INTEGRAÇÃO WHATSAPP EM DESTAQUE */}
        <div className="bg-gradient-to-b from-success/15 to-success/5 border border-success/40 rounded-2xl p-5 max-w-md mx-auto space-y-3 shadow-lg">
          <div className="flex items-center gap-3 text-left">
            <div className="w-10 h-10 rounded-xl bg-success text-bg-base flex items-center justify-center shrink-0 shadow-md">
              <IconWhatsApp size={22} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-heading text-sm font-bold text-text-main leading-snug">
                Falar com o Gilmar no WhatsApp
              </h3>
              <p className="text-[11px] text-text-muted">
                Envie os detalhes do seu pedido e as fotos direto para o Gilmar: (32) 98871-4986
              </p>
            </div>
          </div>

          <a
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2.5 bg-success hover:bg-success/90 text-bg-base font-bold text-sm py-3.5 px-5 rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <IconWhatsApp size={20} />
            <span>Abrir WhatsApp com o Pedido Pronto</span>
          </a>

          <button
            type="button"
            onClick={handleCopiarMensagem}
            className="inline-flex items-center justify-center gap-1.5 text-[11px] text-text-muted hover:text-text-main transition-colors mx-auto"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar texto da mensagem</span>
          </button>
        </div>

        {/* BOTÃO SECUNDÁRIO: CALENDÁRIO */}
        <div className="max-w-md mx-auto pt-1">
          <button
            type="button"
            onClick={handleDownloadCalendar}
            className="w-full flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle font-semibold py-2.5 px-4 rounded-xl transition-all active:scale-95 text-xs"
          >
            <Calendar className="w-4 h-4 text-gold" />
            <span>Adicionar Lembrete ao Calendário</span>
          </button>
        </div>
      </div>

      {/* SEÇÃO OPÇÃO DE PAGAMENTO PIX */}
      {config.pix_chave && (
        <div className="space-y-3">
          <button
            type="button"
            onClick={() => setShowPix(!showPix)}
            className="w-full flex items-center justify-between p-4 bg-surface-1 border border-border-subtle rounded-2xl text-left text-sm hover:border-border-gold/40 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-gold" />
              <span className="font-heading text-sm font-semibold text-text-main">
                Pagar entrada / sinal via Pix (Opcional)
              </span>
            </div>
            <div className="flex items-center gap-1 text-xs text-text-muted">
              <span>{showPix ? "Ocultar" : "Exibir Chave Pix"}</span>
              {showPix ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </div>
          </button>

          {showPix && (
            <PixDisplay
              valor={valorTotal}
              chave={config.pix_chave}
              nomeRecebedor={config.pix_nome}
              cidade={config.pix_cidade}
              descricao="O pagamento pode ser acertado diretamente com o Gilmar após a vistoria."
            />
          )}
        </div>
      )}

      {/* NAVEGAÇÃO DE SAÍDA */}
      <div className="flex flex-col sm:flex-row gap-3 pt-2">
        <Link
          href="/meus-agendamentos"
          className="flex-1 flex items-center justify-center gap-2 bg-surface-1 hover:bg-surface-2 border border-border-subtle text-text-main py-3.5 px-4 rounded-xl text-sm font-semibold transition-colors"
        >
          <span>Ver Minhas Solicitações</span>
          <ArrowRight className="w-4 h-4 text-gold" />
        </Link>
        <Link
          href="/"
          className="flex-1 flex items-center justify-center py-3.5 px-4 text-text-muted hover:text-text-main text-sm transition-colors"
        >
          Voltar para a Página Inicial
        </Link>
      </div>
    </div>
  );
}

