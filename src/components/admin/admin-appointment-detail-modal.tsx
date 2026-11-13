"use client";

import React, { useState } from "react";
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
  Pencil,
  Camera,
  ClipboardCheck,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Agendamento } from "@/lib/supabase/types";
import { formatCurrency, formatPhone, getWhatsAppLink } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo } from "@/lib/date/tz";
import { AdminAttachmentGallery } from "./admin-attachment-gallery";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";
import { numeroDoPedido } from "@/lib/whatsapp";
import { abrirPropostaPDF } from "@/lib/pdf/proposta-pdf";
import { PropostaEditorModal } from "@/components/proposta/proposta-editor-modal";
import { RelatorioEditorModal } from "@/components/relatorio/relatorio-editor-modal";
import { definirFotoItemPropostaAction } from "@/actions/booking";
import { comprimirImagem } from "@/lib/imagem/comprimir";

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
  const [editandoProposta, setEditandoProposta] = useState(false);
  const [relatorioAberto, setRelatorioAberto] = useState(false);
  // Fotos trocadas aqui no modal (chave "<agendamento>:<índice>"): o objeto `agendamento`
  // vem da tela de trás e só é atualizado quando ela recarrega.
  const [fotosLocais, setFotosLocais] = useState<Record<string, string | null>>({});
  const [salvandoFoto, setSalvandoFoto] = useState<number | null>(null);
  const [versaoGaleria, setVersaoGaleria] = useState(0);
  if (!agendamento) return null;

  const chaveFoto = (idx: number) => `${agendamento.id}:${idx}`;
  const itensSalvos = (agendamento.proposta_itens_json || []).map((it, idx) =>
    chaveFoto(idx) in fotosLocais ? { ...it, fotoUrl: fotosLocais[chaveFoto(idx)] } : it
  );

  const trocarFotoItem = async (idx: number, file: File | null | undefined) => {
    if (!file) return;
    setSalvandoFoto(idx);
    try {
      const { dataUrl } = await comprimirImagem(file, { maxDim: 1000, qualidade: 0.78, maxBytes: 280 * 1024 });
      const res = await definirFotoItemPropostaAction({ agendamentoId: agendamento.id, indice: idx, foto: dataUrl });
      if (!res.success) {
        toast.error(res.error || "Não foi possível salvar a foto.");
        return;
      }
      setFotosLocais((prev) => ({ ...prev, [chaveFoto(idx)]: dataUrl }));
      setVersaoGaleria((v) => v + 1);
      toast.success("Foto adicionada ao item da proposta!");
      onRefresh?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível salvar a foto.");
    } finally {
      setSalvandoFoto(null);
    }
  };

  const itensParaEditar = (
    itensSalvos.length > 0
      ? itensSalvos
      : (agendamento.servicos || []).map((s, idx) => ({
          numero: String(idx + 1).padStart(2, "0"),
          identificacao: `Item ${String(idx + 1).padStart(2, "0")}`,
          servicoNome: s.nome,
          escopo: `Execução de ${s.nome.toLowerCase()}.`,
          descricao: s.descricao || "Fornecimento e instalação. Materiais e mão de obra inclusos.",
          quantidade: 1,
          valorUnitario: Number(s.preco || 0),
          valorTotal: Number(s.preco || 0),
          fotoUrl: null,
          icone: s.icone,
        }))
  );

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

        {/* SERVIÇOS E ITENS DA PROPOSTA COMERCIAL */}
        {(agendamento.proposta_subtitulo ||
          agendamento.proposta_objetivo ||
          agendamento.cliente_localidade ||
          agendamento.proposta_condicoes_pagamento) && (
          <div className="bg-surface-2/60 border border-[#0e74bc]/40 rounded-2xl p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between border-b border-border-subtle pb-2">
              <span className="font-heading font-bold text-[#38bdf8] uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" />
                <span>Dados da Proposta Comercial de Serviços</span>
              </span>
              {agendamento.cliente_localidade && (
                <span className="text-[11px] font-semibold text-gold">
                  📍 {agendamento.cliente_localidade}
                </span>
              )}
            </div>

            {agendamento.proposta_subtitulo && (
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Subtítulo:</span>
                <p className="text-text-main font-medium">{agendamento.proposta_subtitulo}</p>
              </div>
            )}

            {agendamento.proposta_objetivo && (
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Objetivo:</span>
                <p className="text-text-main leading-relaxed">{agendamento.proposta_objetivo}</p>
              </div>
            )}

            {agendamento.proposta_condicoes_pagamento && (
              <div>
                <span className="text-[10px] text-text-muted uppercase font-bold block">Condições de Pagamento:</span>
                <p className="text-gold font-medium">{agendamento.proposta_condicoes_pagamento}</p>
              </div>
            )}
          </div>
        )}

        {itensSalvos.length > 0 ? (
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              Escopo Detalhado da Proposta ({itensSalvos.length} {itensSalvos.length === 1 ? "item" : "itens"})
            </h4>
            <div className="space-y-2">
              {itensSalvos.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-start gap-3">
                    {item.fotoUrl ? (
                      <a
                        href={item.fotoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-16 h-16 rounded-lg overflow-hidden border border-gold/50 bg-bg-base shrink-0 block"
                        title="Clique para ampliar a foto do item"
                      >
                        <img
                          src={item.fotoUrl}
                          alt={item.identificacao}
                          className="w-full h-full object-cover"
                        />
                      </a>
                    ) : (
                      <div className="w-16 h-16 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-extrabold text-red-400 uppercase text-center px-1">
                          SEM FOTO
                        </span>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="bg-[#0e74bc] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          #{item.numero || String(idx + 1).padStart(2, "0")}
                        </span>
                        <span className="font-bold text-gold">{item.identificacao}</span>
                        <span className="text-text-main font-semibold">— {item.servicoNome}</span>
                      </div>
                      <p className="text-text-muted text-[11px] leading-snug">{item.escopo}</p>
                      <span className="text-[10px] text-text-muted block">
                        Qtd: <strong>{item.quantidade}</strong> &bull; Unitário: <strong>{formatCurrency(item.valorUnitario)}</strong>
                      </span>
                      <label
                        className={`inline-flex items-center gap-1.5 mt-1 bg-surface-1 hover:bg-surface-3 text-gold border border-border-gold/40 text-[11px] font-bold px-2.5 py-1.5 rounded-lg cursor-pointer ${
                          salvandoFoto !== null ? "opacity-60 pointer-events-none" : ""
                        }`}
                      >
                        {salvandoFoto === idx ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Camera className="w-3.5 h-3.5" />
                        )}
                        <span>{salvandoFoto === idx ? "Salvando..." : item.fotoUrl ? "Trocar foto" : "Adicionar foto"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          aria-label={`${item.fotoUrl ? "Trocar" : "Adicionar"} foto do item ${item.numero || String(idx + 1).padStart(2, "0")}`}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = "";
                            void trocarFotoItem(idx, f);
                          }}
                        />
                      </label>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-heading font-bold text-sm text-gold">
                      {formatCurrency(item.valorTotal)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          agendamento.servicos &&
          agendamento.servicos.length > 0 && (
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
          )
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

        {/* SEÇÃO: IMAGENS DA SOLICITAÇÃO (cliente e admin) */}
        <div className="space-y-2 pt-1">
          <AdminAttachmentGallery
            agendamentoId={agendamento.id}
            refreshKey={versaoGaleria}
            onAnexoRemovido={(anexoId) => {
              // Foto de item da proposta removida pela galeria: reflete na lista de itens acima
              const m = /^proposta-item-.+-(\d+)$/.exec(anexoId);
              if (m) setFotosLocais((prev) => ({ ...prev, [chaveFoto(Number(m[1]))]: null }));
              onRefresh?.();
            }}
          />
        </div>

        {/* BOTÃO GERAR PDF E FECHAR */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border-subtle">
          <button
            type="button"
            onClick={() => {
              const itensDetalhados =
                itensSalvos.length > 0
                  ? itensSalvos
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
            onClick={() => setEditandoProposta(true)}
            className="inline-flex items-center gap-1.5 bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
          >
            <Pencil className="w-4 h-4" />
            <span>Editar Proposta e Fotos</span>
          </button>

          <button
            type="button"
            onClick={() => setRelatorioAberto(true)}
            className="inline-flex items-center gap-1.5 bg-success/15 hover:bg-success/25 text-success border border-success/40 font-bold text-xs px-4 py-2.5 rounded-xl transition-colors"
          >
            <ClipboardCheck className="w-4 h-4" />
            <span>Relatório Antes e Depois</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle font-semibold text-xs px-5 py-2.5 rounded-xl transition-colors"
          >
            Fechar Detalhes
          </button>

          {relatorioAberto && (
            <RelatorioEditorModal
              agendamentoId={agendamento.id}
              onClose={() => setRelatorioAberto(false)}
              prefill={{
                clienteId: agendamento.cliente_id,
                clienteNome: agendamento.cliente?.nome || "",
                clienteWhatsapp: agendamento.cliente?.whatsapp || "",
                clienteLocalidade: agendamento.cliente_localidade || "",
                titulo: (itensSalvos.length > 0
                  ? itensSalvos.map((i) => i.servicoNome)
                  : (agendamento.servicos || []).map((s) => s.nome)
                )
                  .filter(Boolean)
                  .slice(0, 3)
                  .join(" + "),
                referencia: pedidoNum,
              }}
            />
          )}

          {editandoProposta && (
            <PropostaEditorModal
              open
              modo="admin"
              agendamentoId={agendamento.id}
              numeroPedido={pedidoNum}
              onClose={() => setEditandoProposta(false)}
              onSaved={() => {
                setEditandoProposta(false);
                onRefresh?.();
                onClose(); // reabra para ver os dados já atualizados
              }}
              inicial={{
                clienteNome: agendamento.cliente?.nome || "Cliente",
                clienteWhatsapp: agendamento.cliente?.whatsapp || "",
                clienteLocalidade: agendamento.cliente_localidade || "",
                subtitulo: agendamento.proposta_subtitulo || "",
                objetivo: agendamento.proposta_objetivo || "",
                condicoesPagamento: agendamento.proposta_condicoes_pagamento || "",
                observacaoCliente: agendamento.observacao || "",
                itens: itensParaEditar,
              }}
            />
          )}
        </div>
      </div>
    </div>
  );
}
