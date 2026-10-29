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
  FileText,
  Printer,
  Check,
} from "lucide-react";
import { PixDisplay } from "@/components/pix/pix-display";
import { downloadICSFile } from "@/lib/calendar/ics";
import { formatCurrency } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo } from "@/lib/date/tz";
import { Configuracao, PropostaItemDetalhe } from "@/lib/supabase/types";
import { IconWhatsApp } from "@/components/icons/barber-icons";
import {
  WHATSAPP_COMERCIAL,
  WHATSAPP_GILMAR_DISPLAY,
  numeroDoPedido,
  agruparItens,
  linkWhatsAppPedido,
  montarMensagemPedido,
  ResumoPedido,
} from "@/lib/whatsapp";
import { abrirPropostaPDF, formatarDataBR, calcularValidadeBR } from "@/lib/pdf/proposta-pdf";
import { toast } from "sonner";

interface BookingSuccessViewProps {
  agendamentoId: string;
  valorTotal: number;
  inicioIso: string;
  config: Configuracao;
  resumo?: {
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
    propostaItensJson?: PropostaItemDetalhe[] | null;
    servicos: { nome: string; preco: number; descricao?: string | null; icone?: string }[];
    anexosCount: number;
    anexosUrls?: string[];
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
  const [pdfGerado, setPdfGerado] = useState(false);
  const [localItemFotos, setLocalItemFotos] = useState<(string | null)[]>([]);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setAppLink(`${window.location.origin}/meus-agendamentos`);
      try {
        const savedFotos = sessionStorage.getItem(`proposta_fotos_${agendamentoId}`);
        if (savedFotos) {
          const parsed = JSON.parse(savedFotos);
          if (Array.isArray(parsed)) {
            setLocalItemFotos(parsed);
          }
        }
      } catch {
        // ignora
      }
    }
  }, [agendamentoId]);

  const dataHoraInicio = new Date(inicioIso);
  const dataHoraFim = new Date(dataHoraInicio.getTime() + 60 * 60 * 1000);

  const dataFormatada = formatDateFriendly(inicioIso);
  const horaFormatada = formatTimeSaoPaulo(inicioIso);

  const finalAnexosCount = Math.max(anexosCount, resumo?.anexosCount || 0);
  const pedidoNum = numeroDoPedido(agendamentoId);
  const valorFinal = valorTotal > 0 ? valorTotal : (resumo?.valorTotal || 0);

  const itensProposta: PropostaItemDetalhe[] =
    resumo?.propostaItensJson && resumo.propostaItensJson.length > 0
      ? resumo.propostaItensJson.map((it, idx) => ({
          ...it,
          fotoUrl: localItemFotos[idx] || it.fotoUrl || resumo?.anexosUrls?.[idx] || null,
        }))
      : (resumo?.servicos || []).map((srv, idx) => {
          const num = String(idx + 1).padStart(2, "0");
          const ident = `Máquina ${num}`;
          return {
            numero: num,
            identificacao: ident,
            servicoNome: srv.nome,
            escopo: `Execução de ${srv.nome.toLowerCase()} na ${ident}.`,
            descricao: `${srv.descricao || `Fornecimento e instalação de ${srv.nome.toLowerCase()}.`} Materiais e mão de obra inclusos.`,
            quantidade: 1,
            valorUnitario: srv.preco,
            valorTotal: srv.preco,
            fotoUrl: localItemFotos[idx] || resumo?.anexosUrls?.[idx] || null,
            icone: srv.icone,
          };
        });

  // Monta objeto consolidado para a mensagem do WhatsApp
  const pedidoResumo: ResumoPedido = {
    id: agendamentoId,
    numero: pedidoNum,
    clienteNome: resumo?.clienteNome || "Cliente",
    clienteLocalidade: resumo?.clienteLocalidade || "Visconde do Rio Branco - MG",
    inicio: inicioIso,
    itens:
      itensProposta.length > 0
        ? itensProposta.map((i) => ({
            nome: i.servicoNome,
            quantidade: i.quantidade,
            valorUnitario: i.valorUnitario,
            identificacao: i.identificacao,
            escopo: i.escopo,
          }))
        : agruparItens(resumo?.servicos || []),
    desconto: resumo?.desconto || 0,
    valorTotal: valorFinal,
    observacao: resumo?.observacao || null,
    anexosCount: finalAnexosCount,
    subtitulo: resumo?.propostaSubtitulo || null,
    objetivo: resumo?.propostaObjetivo || null,
    condicoesPagamento: resumo?.propostaCondicoesPagamento || null,
    pdfGerado: true,
  };

  const whatsAppLink = linkWhatsAppPedido(pedidoResumo, appLink);
  const whatsAppTexto = montarMensagemPedido(pedidoResumo, appLink);

  const handleGerarPDF = () => {
    const ok = abrirPropostaPDF({
      numeroPedido: pedidoNum,
      clienteNome: resumo?.clienteNome || "Cliente",
      clienteLocalidade: resumo?.clienteLocalidade || "Visconde do Rio Branco - MG",
      dataProposta: formatarDataBR(new Date()),
      validadeProposta: calcularValidadeBR(new Date(), 10),
      subtitulo: resumo?.propostaSubtitulo || null,
      objetivo: resumo?.propostaObjetivo || null,
      condicoesPagamento: resumo?.propostaCondicoesPagamento || null,
      observacaoCliente: resumo?.observacao || null,
      itens:
        itensProposta.length > 0
          ? itensProposta
          : [
              {
                numero: "01",
                identificacao: "Máquina 01",
                servicoNome: "Serviço Elétrico Especializado",
                escopo: "Execução de serviço elétrico conforme solicitação.",
                descricao: "Fornecimento técnico e mão de obra inclusos.",
                quantidade: 1,
                valorUnitario: valorFinal,
                valorTotal: valorFinal,
                fotoUrl: resumo?.anexosUrls?.[0] || null,
              },
            ],
      valorTotal: valorFinal,
    });

    if (!ok) {
      toast.error("Permita pop-ups no seu navegador para gerar o PDF da proposta.");
      return;
    }

    setPdfGerado(true);
    toast.success("Proposta Comercial em PDF gerada! Agora encaminhe para o Gilmar no WhatsApp.");
  };

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

        {/* PASSO 1 E 2: GERAR PROPOSTA COMERCIAL EM PDF E ENCAMINHAR NO WHATSAPP DO GILMAR */}
        <div className="bg-gradient-to-b from-[#0c1626] to-surface-2 border-2 border-[#0284c7]/50 rounded-2xl p-5 max-w-md mx-auto space-y-4 shadow-xl text-left">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0284c7] text-white flex items-center justify-center shrink-0 shadow-md">
              <Printer className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#38bdf8]">
                Passo Final Obrigatório
              </span>
              <h3 className="font-heading text-sm font-bold text-text-main leading-snug">
                Gere o PDF do seu Orçamento e Encaminhe ao Gilmar
              </h3>
              <p className="text-[11px] text-text-muted mt-0.5">
                1º Baixe a Proposta Comercial em PDF (com logo, escopo e assinaturas) e 2º envie para o WhatsApp do Gilmar ({WHATSAPP_GILMAR_DISPLAY}).
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGerarPDF}
            className="w-full inline-flex items-center justify-center gap-2.5 bg-[#0284c7] hover:bg-[#0369a1] text-white font-bold text-sm py-3.5 px-5 rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer"
          >
            <FileText className="w-4 h-4" />
            <span>{pdfGerado ? "Baixar / Imprimir Orçamento em PDF Novamente" : "1º Gerar Orçamento Completo em PDF"}</span>
          </button>

          <a
            href={whatsAppLink}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => {
              if (!pdfGerado) {
                handleGerarPDF();
              }
            }}
            className={`w-full inline-flex items-center justify-center gap-2.5 font-bold text-sm py-3.5 px-5 rounded-xl shadow-lg transition-all active:scale-[0.98] cursor-pointer ${
              pdfGerado
                ? "bg-[#25D366] hover:bg-[#20bd5a] text-white ring-2 ring-[#25D366]/60 animate-pulse"
                : "bg-success hover:bg-success/90 text-bg-base"
            }`}
          >
            <IconWhatsApp size={20} />
            <span>2º Encaminhar Orçamento no WhatsApp ({WHATSAPP_GILMAR_DISPLAY})</span>
          </a>

          {pdfGerado && (
            <div className="bg-success/15 border border-success/40 rounded-xl p-2.5 text-[11px] text-success flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 stroke-[3]" />
              <span>
                PDF gerado! Na conversa do WhatsApp que se abrirá, basta anexar o PDF salvo e enviar ao Gilmar.
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={handleCopiarMensagem}
            className="w-full inline-flex items-center justify-center gap-1.5 text-[11px] text-text-muted hover:text-text-main transition-colors pt-1"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Copiar resumo em texto</span>
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

