"use client";

import React, { useMemo, useState } from "react";
import { FileText, Plus, Printer, Save, Trash2, X, RefreshCw, Lock } from "lucide-react";
import { toast } from "sonner";
import { PropostaItemDetalhe } from "@/lib/supabase/types";
import { formatCurrency } from "@/lib/formatters";
import { abrirPropostaPDF, formatarDataBR, calcularValidadeBR } from "@/lib/pdf/proposta-pdf";
import { salvarPropostaAction } from "@/actions/booking";

export interface PropostaInicial {
  clienteNome: string;
  clienteWhatsapp?: string | null;
  clienteLocalidade?: string | null;
  subtitulo?: string | null;
  objetivo?: string | null;
  condicoesPagamento?: string | null;
  observacaoCliente?: string | null;
  dataProposta?: string;
  validadeProposta?: string;
  itens: PropostaItemDetalhe[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** admin: edita tudo (inclusive valores e itens). cliente: edita textos e quantidades. */
  modo: "admin" | "cliente";
  agendamentoId?: string;
  numeroPedido?: string;
  inicial: PropostaInicial;
  onSaved?: () => void;
}

type ItemEditavel = PropostaItemDetalhe & { fotoDe: number | null };

const inputCls =
  "w-full bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-main focus:outline-none focus:border-gold";
const labelCls = "text-[10px] text-text-muted block mb-0.5";

function condicaoPadrao(total: number) {
  const metade = total / 2;
  return `Entrada de ${formatCurrency(metade)} (50%) na aprovação da proposta e saldo de ${formatCurrency(
    total - metade
  )} (50%) após a conclusão dos serviços.`;
}

export function PropostaEditorModal({ open, onClose, modo, agendamentoId, numeroPedido, inicial, onSaved }: Props) {
  const isAdmin = modo === "admin";

  const [clienteNome, setClienteNome] = useState(inicial.clienteNome || "");
  const [clienteWhatsapp, setClienteWhatsapp] = useState(inicial.clienteWhatsapp || "");
  const [clienteLocalidade, setClienteLocalidade] = useState(inicial.clienteLocalidade || "");
  const [subtitulo, setSubtitulo] = useState(inicial.subtitulo || "");
  const [objetivo, setObjetivo] = useState(inicial.objetivo || "");
  const [condicoes, setCondicoes] = useState(inicial.condicoesPagamento || "");
  const [observacao, setObservacao] = useState(inicial.observacaoCliente || "");
  const [dataProposta, setDataProposta] = useState(inicial.dataProposta || formatarDataBR(new Date()));
  const [validade, setValidade] = useState(inicial.validadeProposta || calcularValidadeBR(new Date(), 10));
  const [itens, setItens] = useState<ItemEditavel[]>(() =>
    inicial.itens.map((it, i) => ({ ...it, fotoDe: i }))
  );
  const [salvando, setSalvando] = useState(false);

  const total = useMemo(
    () => itens.reduce((acc, it) => acc + Math.max(1, it.quantidade) * Math.max(0, it.valorUnitario), 0),
    [itens]
  );

  if (!open) return null;

  const patchItem = (idx: number, patch: Partial<ItemEditavel>) =>
    setItens((prev) =>
      prev.map((it, i) => {
        if (i !== idx) return it;
        const novo = { ...it, ...patch };
        novo.valorTotal = Math.max(1, novo.quantidade) * Math.max(0, novo.valorUnitario);
        return novo;
      })
    );

  const addItem = () =>
    setItens((prev) => {
      const num = String(prev.length + 1).padStart(2, "0");
      return [
        ...prev,
        {
          numero: num,
          identificacao: `Item ${num}`,
          servicoNome: "Novo serviço",
          escopo: "",
          descricao: "Fornecimento e instalação. Materiais e mão de obra inclusos.",
          quantidade: 1,
          valorUnitario: 0,
          valorTotal: 0,
          fotoUrl: null,
          fotoDe: null,
        },
      ];
    });

  const removeItem = (idx: number) => {
    if (itens.length <= 1) {
      toast.error("A proposta precisa ter pelo menos 1 item.");
      return;
    }
    setItens((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, numero: String(i + 1).padStart(2, "0") })));
  };

  const gerarPdf = () => {
    if (!clienteNome.trim()) {
      toast.error("Informe o nome do cliente.");
      return false;
    }
    const ok = abrirPropostaPDF({
      numeroPedido,
      clienteNome: clienteNome.trim(),
      clienteWhatsapp: clienteWhatsapp || null,
      clienteLocalidade: clienteLocalidade.trim() || null,
      dataProposta,
      validadeProposta: validade,
      subtitulo: subtitulo || null,
      objetivo: objetivo || null,
      condicoesPagamento: condicoes || null,
      observacaoCliente: observacao || null,
      itens: itens.map((it, i) => ({
        ...it,
        numero: String(i + 1).padStart(2, "0"),
        valorTotal: Math.max(1, it.quantidade) * Math.max(0, it.valorUnitario),
      })),
      valorTotal: total,
    });
    if (!ok) toast.error("Permita pop-ups no navegador para abrir o PDF.");
    return ok;
  };

  const salvar = async (): Promise<boolean> => {
    if (!agendamentoId) return true; // sem registro no banco: só gera o PDF
    setSalvando(true);
    try {
      const res = await salvarPropostaAction({
        agendamentoId,
        clienteNome,
        clienteWhatsapp,
        clienteLocalidade,
        subtitulo,
        objetivo,
        condicoesPagamento: condicoes,
        itens: itens.map((it) => ({
          numero: it.numero,
          identificacao: it.identificacao,
          servicoNome: it.servicoNome,
          escopo: it.escopo,
          descricao: it.descricao,
          quantidade: it.quantidade,
          valorUnitario: it.valorUnitario,
          icone: it.icone,
          fotoDe: it.fotoDe,
        })),
      });
      if (!res.success) {
        toast.error(res.error || "Não foi possível salvar.");
        return false;
      }
      toast.success("Alterações salvas na proposta!");
      onSaved?.();
      return true;
    } finally {
      setSalvando(false);
    }
  };

  const handleSalvarEGerar = async () => {
    const salvou = await salvar();
    if (salvou) gerarPdf();
  };

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-bg-base border border-border-gold/40 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-gold shrink-0" />
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-base text-text-main truncate">Editar Proposta (PDF)</h2>
              <p className="text-[11px] text-text-muted">
                {isAdmin
                  ? "Altere textos, quantidades, valores e itens. As fotos permanecem."
                  : "Altere os textos e quantidades. Os valores só o Gilmar pode alterar. As fotos permanecem."}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo rolável */}
        <div className="overflow-y-auto px-5 py-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Cliente / Empresa *</label>
              <input className={inputCls} value={clienteNome} onChange={(e) => setClienteNome(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>WhatsApp {isAdmin ? "" : "(somente leitura)"}</label>
              <input className={inputCls} value={clienteWhatsapp} disabled={!isAdmin} onChange={(e) => setClienteWhatsapp(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Cidade / Localidade</label>
              <input className={inputCls} value={clienteLocalidade} onChange={(e) => setClienteLocalidade(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Data da proposta</label>
              <input className={inputCls} value={dataProposta} onChange={(e) => setDataProposta(e.target.value)} placeholder="DD/MM/AAAA" />
            </div>
            <div>
              <label className={labelCls}>Validade</label>
              <input className={inputCls} value={validade} onChange={(e) => setValidade(e.target.value)} placeholder="DD/MM/AAAA" />
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>Subtítulo</label>
              <input className={inputCls} value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
            </div>
            <div className="sm:col-span-3">
              <label className={labelCls}>Objetivo da proposta</label>
              <textarea rows={3} className={`${inputCls} resize-none`} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} />
            </div>
          </div>

          {/* Itens */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-heading text-sm font-bold text-text-main">Escopo dos serviços ({itens.length})</h3>
              {isAdmin && (
                <button type="button" onClick={addItem} className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 text-xs font-bold px-3 py-1.5 rounded-xl">
                  <Plus className="w-3.5 h-3.5" /> Adicionar item
                </button>
              )}
            </div>

            {itens.map((it, idx) => (
              <div key={idx} className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-7 h-7 rounded-lg bg-[#1b80c4] text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <input className={`${inputCls} font-bold text-gold`} value={it.identificacao} onChange={(e) => patchItem(idx, { identificacao: e.target.value })} />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-heading font-bold text-sm text-gold">{formatCurrency(Math.max(1, it.quantidade) * Math.max(0, it.valorUnitario))}</span>
                    {isAdmin && itens.length > 1 && (
                      <button type="button" onClick={() => removeItem(idx)} className="p-1.5 rounded-lg bg-surface-1 hover:bg-destructive/20 text-text-muted hover:text-destructive" title="Remover item">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="col-span-2">
                    <label className={labelCls}>Serviço</label>
                    <input className={inputCls} value={it.servicoNome} onChange={(e) => patchItem(idx, { servicoNome: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Quantidade</label>
                    <input type="number" min={1} className={inputCls} value={it.quantidade}
                      onChange={(e) => patchItem(idx, { quantidade: Math.max(1, parseInt(e.target.value, 10) || 1) })} />
                  </div>
                  <div>
                    <label className={`${labelCls} flex items-center gap-1`}>
                      Valor unit. (R$) {!isAdmin && <Lock className="w-2.5 h-2.5" />}
                    </label>
                    <input type="number" step="0.01" min={0} className={`${inputCls} ${!isAdmin ? "opacity-60 cursor-not-allowed" : ""}`}
                      value={it.valorUnitario} readOnly={!isAdmin}
                      onChange={(e) => patchItem(idx, { valorUnitario: Math.max(0, parseFloat(e.target.value) || 0) })} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Descrição no escopo</label>
                  <input className={inputCls} value={it.escopo} onChange={(e) => patchItem(idx, { escopo: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Detalhamento</label>
                  <textarea rows={2} className={`${inputCls} resize-none`} value={it.descricao} onChange={(e) => patchItem(idx, { descricao: e.target.value })} />
                </div>
                <p className="text-[10px] text-text-muted">
                  {it.fotoUrl ? "📷 Foto mantida neste item." : "Sem foto neste item (sairá “SEM FOTO” no PDF)."}
                </p>
              </div>
            ))}
          </div>

          {/* Pagamento e total */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className={labelCls}>Condições de pagamento</label>
              <button type="button" onClick={() => setCondicoes(condicaoPadrao(total))} className="inline-flex items-center gap-1 text-[10px] text-gold hover:underline">
                <RefreshCw className="w-3 h-3" /> Recalcular 50% / 50%
              </button>
            </div>
            <textarea rows={2} className={`${inputCls} resize-none`} value={condicoes} onChange={(e) => setCondicoes(e.target.value)} />
            <div>
              <label className={labelCls}>Observações</label>
              <input className={inputCls} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-text-muted">Valor total da proposta</span>
              <span className="text-2xl font-bold font-heading text-gold">{formatCurrency(total)}</span>
            </div>
          </div>
        </div>

        {/* Rodapé de ações */}
        <div className="flex flex-col sm:flex-row gap-2 px-5 py-4 border-t border-border-subtle shrink-0">
          {agendamentoId ? (
            <>
              <button type="button" disabled={salvando} onClick={handleSalvarEGerar}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0e74bc] hover:bg-[#0c63a0] disabled:opacity-50 text-white font-bold text-sm px-4 py-3 rounded-xl">
                <Printer className="w-4 h-4" /> {salvando ? "Salvando..." : "Salvar e gerar PDF"}
              </button>
              <button type="button" disabled={salvando} onClick={() => void salvar()}
                className="inline-flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle font-semibold text-sm px-4 py-3 rounded-xl">
                <Save className="w-4 h-4" /> Só salvar
              </button>
            </>
          ) : null}
          <button type="button" onClick={gerarPdf}
            className="inline-flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 font-semibold text-sm px-4 py-3 rounded-xl">
            <FileText className="w-4 h-4" /> Só gerar PDF
          </button>
        </div>
      </div>
    </div>
  );
}
