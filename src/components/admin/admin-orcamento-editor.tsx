"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  Camera,
  FileText,
  Loader2,
  MessageCircle,
  Plus,
  Printer,
  Save,
  Search,
  Trash2,
  UserPlus,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ModoValoresOrcamento,
  OrcamentoAdmin,
  OrcamentoAdminResumo,
  Servico,
} from "@/lib/supabase/types";
import { formatCurrency, formatPhone, getWhatsAppLink } from "@/lib/formatters";
import { abrirPropostaPDF, calcularValidadeBR, formatarDataBR } from "@/lib/pdf/proposta-pdf";
import { comprimirImagem } from "@/lib/imagem/comprimir";
import { salvarOrcamentoAdminAction } from "@/actions/orcamentos";

export interface ClienteOpcao {
  id: string;
  nome: string;
  whatsapp: string;
}

interface Props {
  inicial: OrcamentoAdmin | null;
  servicos: Servico[];
  clientes: ClienteOpcao[];
  onClose: () => void;
  onSaved: (resumo: OrcamentoAdminResumo) => void;
}

interface ItemEd {
  key: string;
  identificacao: string;
  servicoNome: string;
  escopo: string;
  descricao: string;
  quantidade: number;
  preco: string; // texto, para permitir campo vazio
  icone?: string;
  fotoUrl: string | null;
  fotoDe: number | null;
  fotoNova: boolean;
}

const MODOS: { id: ModoValoresOrcamento; titulo: string; ajuda: string }[] = [
  { id: "por_item", titulo: "Preço em cada serviço", ajuda: "Cada serviço com seu valor; o total é a soma." },
  { id: "total_unico", titulo: "Valor único no final", ajuda: "Serviços sem preço; você digita só o valor final." },
  { id: "a_combinar", titulo: "Sem valor (a combinar)", ajuda: "O orçamento sai sem preço, “A combinar”." },
];

/** Soma máxima das fotos novas em um único salvamento (o limite da requisição é 4 MB) */
const MAX_CHARS_FOTOS_NOVAS = 3_300_000;

const inputCls =
  "w-full bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-2 text-xs text-text-main focus:outline-none focus:border-gold";
const labelCls = "text-[10px] text-text-muted block mb-0.5";

const num = (v: string) => {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const novaKey = () => Math.random().toString(36).slice(2, 10);

export function rotuloOrcamento(numero: number) {
  return `ORC-${String(numero).padStart(4, "0")}`;
}

export function AdminOrcamentoEditor({ inicial, servicos, clientes, onClose, onSaved }: Props) {
  const [id, setId] = useState<string | null>(inicial?.id ?? null);
  const [numero, setNumero] = useState<number | null>(inicial?.numero ?? null);

  const [clienteId, setClienteId] = useState<string | null>(inicial?.cliente_id ?? null);
  const [clienteNome, setClienteNome] = useState(inicial?.cliente_nome ?? "");
  const [clienteWhats, setClienteWhats] = useState(inicial?.cliente_whatsapp ? formatPhone(inicial.cliente_whatsapp) : "");
  const [clienteLocal, setClienteLocal] = useState(inicial?.cliente_localidade ?? "Visconde do Rio Branco - MG");
  const [buscaCliente, setBuscaCliente] = useState("");

  const [subtitulo, setSubtitulo] = useState(
    inicial?.subtitulo ?? "Instalação de comandos elétricos, manutenção e dispositivos de segurança"
  );
  const [objetivo, setObjetivo] = useState(inicial?.objetivo ?? "");
  const [condicoes, setCondicoes] = useState(inicial?.condicoes_pagamento ?? "");
  const [observacoes, setObservacoes] = useState(inicial?.observacoes ?? "");
  const [validadeDias, setValidadeDias] = useState(inicial?.validade_dias ?? 10);

  const [modo, setModo] = useState<ModoValoresOrcamento>(inicial?.modo_valores ?? "por_item");
  const [valorFinalStr, setValorFinalStr] = useState(() => {
    if (!inicial || inicial.valor_total == null) return "";
    const soma = inicial.itens.reduce((a, i) => a + Number(i.valorTotal || 0), 0);
    // em "por item", só mostra o campo preenchido se o valor foi ajustado manualmente
    if (inicial.modo_valores === "por_item" && Math.abs(Number(inicial.valor_total) - soma) < 0.005) return "";
    return String(inicial.valor_total);
  });
  const [mostrarSemFoto, setMostrarSemFoto] = useState(inicial?.mostrar_sem_foto ?? false);

  const [itens, setItens] = useState<ItemEd[]>(() =>
    (inicial?.itens ?? []).map((it, i) => ({
      key: novaKey(),
      identificacao: it.identificacao,
      servicoNome: it.servicoNome,
      escopo: it.escopo,
      descricao: it.descricao,
      quantidade: it.quantidade || 1,
      preco: it.valorUnitario > 0 ? String(it.valorUnitario) : "",
      icone: it.icone,
      fotoUrl: it.fotoUrl || null,
      fotoDe: it.fotoUrl ? i : null,
      fotoNova: false,
    }))
  );

  const [salvando, setSalvando] = useState(false);
  const [processandoFoto, setProcessandoFoto] = useState<string | null>(null);
  const fotoInputs = useRef<Record<string, HTMLInputElement | null>>({});

  const soma = useMemo(() => itens.reduce((a, it) => a + Math.max(1, it.quantidade) * num(it.preco), 0), [itens]);
  const valorFinalNum = valorFinalStr.trim() === "" ? null : num(valorFinalStr);
  const totalExibido =
    modo === "a_combinar" ? null : modo === "total_unico" ? valorFinalNum : valorFinalNum != null ? valorFinalNum : soma;

  const sugestoesCliente = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    if (q.length < 1) return [];
    return clientes
      .filter((c) => c.nome.toLowerCase().includes(q) || c.whatsapp.includes(q.replace(/\D/g, "") || "§"))
      .slice(0, 6);
  }, [buscaCliente, clientes]);

  const escolherCliente = (c: ClienteOpcao) => {
    setClienteId(c.id);
    setClienteNome(c.nome);
    setClienteWhats(formatPhone(c.whatsapp));
    setBuscaCliente("");
  };

  const addDoCatalogo = (s: Servico) =>
    setItens((prev) => {
      const n = String(prev.length + 1).padStart(2, "0");
      return [
        ...prev,
        {
          key: novaKey(),
          identificacao: `Item ${n}`,
          servicoNome: s.nome,
          escopo: `Execução de ${s.nome.toLowerCase()}.`,
          descricao: `${s.descricao || `Fornecimento e instalação de ${s.nome.toLowerCase()}.`} Materiais e mão de obra inclusos.`,
          quantidade: 1,
          preco: s.preco > 0 ? String(s.preco) : "",
          icone: s.icone,
          fotoUrl: null,
          fotoDe: null,
          fotoNova: false,
        },
      ];
    });

  const addPersonalizado = () =>
    setItens((prev) => {
      const n = String(prev.length + 1).padStart(2, "0");
      return [
        ...prev,
        {
          key: novaKey(),
          identificacao: `Item ${n}`,
          servicoNome: "",
          escopo: "",
          descricao: "Fornecimento e instalação. Materiais e mão de obra inclusos.",
          quantidade: 1,
          preco: "",
          fotoUrl: null,
          fotoDe: null,
          fotoNova: false,
        },
      ];
    });

  const patch = (key: string, p: Partial<ItemEd>) => setItens((prev) => prev.map((it) => (it.key === key ? { ...it, ...p } : it)));
  const remover = (key: string) => setItens((prev) => prev.filter((it) => it.key !== key));

  const escolherFoto = async (key: string, file: File | null | undefined) => {
    if (!file) return;
    setProcessandoFoto(key);
    try {
      const { dataUrl } = await comprimirImagem(file, { maxDim: 1000, qualidade: 0.78, maxBytes: 280 * 1024 });
      patch(key, { fotoUrl: dataUrl, fotoNova: true, fotoDe: null });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não foi possível usar esta foto.");
    } finally {
      setProcessandoFoto(null);
    }
  };

  const validar = (): string | null => {
    if (clienteNome.trim().length < 2) return "Informe o nome do cliente.";
    if (itens.length === 0) return "Adicione pelo menos 1 serviço ao orçamento.";
    if (itens.some((i) => i.servicoNome.trim().length < 2)) return "Todo item precisa do nome do serviço.";
    if (modo === "total_unico" && (valorFinalNum == null || valorFinalNum <= 0)) {
      return "Informe o valor final do orçamento.";
    }
    return null;
  };

  const dadosPdf = () => {
    const porItem = modo === "por_item";
    return {
      numeroPedido: numero ? rotuloOrcamento(numero) : undefined,
      clienteNome: clienteNome.trim(),
      clienteWhatsapp: clienteWhats || null,
      clienteLocalidade: clienteLocal.trim() || null,
      dataProposta: formatarDataBR(new Date()),
      validadeProposta: calcularValidadeBR(new Date(), validadeDias),
      subtitulo: subtitulo || null,
      objetivo: objetivo || null,
      condicoesPagamento: condicoes || null,
      observacaoCliente: observacoes || null,
      modoValores: modo,
      ocultarSemFoto: !mostrarSemFoto,
      valorTotal: totalExibido ?? 0,
      itens: itens.map((it, i) => {
        const qtd = Math.max(1, it.quantidade);
        const unit = porItem ? num(it.preco) : 0;
        return {
          numero: String(i + 1).padStart(2, "0"),
          identificacao: it.identificacao,
          servicoNome: it.servicoNome,
          escopo: it.escopo,
          descricao: it.descricao,
          quantidade: qtd,
          valorUnitario: unit,
          valorTotal: qtd * unit,
          fotoUrl: it.fotoUrl,
          icone: it.icone,
        };
      }),
    };
  };

  /** Salva no banco. Devolve true se deu certo. */
  const salvar = async (): Promise<boolean> => {
    const erro = validar();
    if (erro) {
      toast.error(erro);
      return false;
    }
    const peso = itens.reduce((a, it) => a + (it.fotoNova && it.fotoUrl ? it.fotoUrl.length : 0), 0);
    if (peso > MAX_CHARS_FOTOS_NOVAS) {
      toast.error("Muitas fotos novas de uma vez. Salve com parte das fotos e depois adicione as demais.");
      return false;
    }

    setSalvando(true);
    try {
      const res = await salvarOrcamentoAdminAction({
        id: id ?? undefined,
        clienteId,
        clienteNome,
        clienteWhatsapp: clienteWhats,
        clienteLocalidade: clienteLocal,
        subtitulo,
        objetivo,
        condicoesPagamento: condicoes,
        observacoes,
        modoValores: modo,
        valorTotal: modo === "a_combinar" ? null : valorFinalNum,
        mostrarSemFoto,
        validadeDias,
        itens: itens.map((it) => ({
          identificacao: it.identificacao,
          servicoNome: it.servicoNome,
          escopo: it.escopo,
          descricao: it.descricao,
          quantidade: it.quantidade,
          valorUnitario: num(it.preco),
          icone: it.icone,
          fotoDe: it.fotoNova ? null : it.fotoDe,
          fotoNova: it.fotoNova ? it.fotoUrl : null,
        })),
      });
      if (!res.success) {
        toast.error(res.error);
        return false;
      }
      // a partir daqui as fotos já estão salvas: indexa pela posição atual
      setId(res.orcamento.id);
      setNumero(res.orcamento.numero);
      setItens((prev) => prev.map((it, i) => ({ ...it, fotoDe: it.fotoUrl ? i : null, fotoNova: false })));
      onSaved(res.orcamento);
      return true;
    } catch {
      toast.error("Não foi possível salvar. Verifique sua conexão e tente novamente.");
      return false;
    } finally {
      setSalvando(false);
    }
  };

  const soSalvar = async () => {
    if (await salvar()) toast.success("Orçamento salvo!");
  };

  const gerarPdfSemSalvar = () => {
    const erro = validar();
    if (erro) return toast.error(erro);
    if (!abrirPropostaPDF(dadosPdf())) toast.error("Permita pop-ups no navegador para abrir o PDF.");
  };

  const salvarEGerarPdf = async () => {
    const erro = validar();
    if (erro) return toast.error(erro);
    // abre a janela JÁ NO CLIQUE (celular bloqueia janela aberta depois de esperar o servidor)
    const janela = window.open("", "_blank");
    const ok = await salvar();
    if (!ok) {
      janela?.close();
      return;
    }
    if (!abrirPropostaPDF(dadosPdf(), janela)) toast.error("Permita pop-ups no navegador para abrir o PDF.");
    else toast.success("Orçamento salvo e PDF aberto!");
  };

  const whatsLink = (() => {
    const digitos = clienteWhats.replace(/\D/g, "");
    if (digitos.length < 10) return null;
    const linhas = itens.map((it, i) => `${i + 1}. ${it.servicoNome}${it.quantidade > 1 ? ` (${it.quantidade}x)` : ""}`);
    const valorTxt =
      modo === "a_combinar" ? "A combinar" : totalExibido != null ? formatCurrency(totalExibido) : "—";
    const msg = [
      `Olá, ${clienteNome.trim().split(" ")[0] || "tudo bem"}! Aqui é o Gilmar da GS Elétrica e Manutenção.`,
      numero ? `Segue o orçamento ${rotuloOrcamento(numero)}:` : "Segue o orçamento:",
      ...linhas,
      `Valor total: ${valorTxt}`,
      `Validade: ${validadeDias} dias.`,
    ].join("\n");
    return getWhatsAppLink(digitos, msg);
  })();

  return (
    <div className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-bg-base border border-border-gold/40 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl h-[96vh] sm:h-auto sm:max-h-[94vh] flex flex-col shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <FileText className="w-5 h-5 text-gold shrink-0" />
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-base text-text-main truncate">
                {numero ? `Orçamento ${rotuloOrcamento(numero)}` : "Novo orçamento"}
              </h2>
              <p className="text-[11px] text-text-muted">Você define os preços aqui; os valores fixos dos serviços não mudam.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted" aria-label="Fechar">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Corpo */}
        <div className="overflow-y-auto px-5 py-4 space-y-6 flex-1">
          {/* CLIENTE */}
          <section className="space-y-3">
            <h3 className="font-heading text-sm font-bold text-text-main flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-gold" /> Cliente
            </h3>

            <div className="relative">
              <label className={labelCls}>Buscar cliente já cadastrado (opcional)</label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                <input
                  className={`${inputCls} pl-8`}
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Digite o nome ou telefone..."
                />
              </div>
              {sugestoesCliente.length > 0 && (
                <ul className="absolute z-10 left-0 right-0 mt-1 bg-surface-1 border border-border-gold/40 rounded-xl overflow-hidden shadow-xl">
                  {sugestoesCliente.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => escolherCliente(c)}
                        className="w-full text-left px-3 py-2 text-xs hover:bg-surface-2 flex justify-between gap-2"
                      >
                        <span className="text-text-main font-medium truncate">{c.nome}</span>
                        <span className="text-text-muted shrink-0">{formatPhone(c.whatsapp)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Nome / Empresa *</label>
                <input
                  className={inputCls}
                  value={clienteNome}
                  onChange={(e) => {
                    setClienteNome(e.target.value);
                    setClienteId(null); // nome digitado à mão: deixa de apontar para um cadastro
                  }}
                />
              </div>
              <div>
                <label className={labelCls}>WhatsApp</label>
                <input
                  className={inputCls}
                  inputMode="tel"
                  value={clienteWhats}
                  onChange={(e) => setClienteWhats(formatPhone(e.target.value))}
                  placeholder="(32) 99999-9999"
                />
              </div>
              <div>
                <label className={labelCls}>Cidade / Localidade</label>
                <input className={inputCls} value={clienteLocal} onChange={(e) => setClienteLocal(e.target.value)} />
              </div>
            </div>
            {clienteId && <p className="text-[10px] text-success">Vinculado ao cliente cadastrado.</p>}
          </section>

          {/* VALORES */}
          <section className="space-y-3">
            <h3 className="font-heading text-sm font-bold text-text-main">Como mostrar os valores?</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {MODOS.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setModo(m.id)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    modo === m.id
                      ? "bg-gold/15 border-gold ring-1 ring-gold"
                      : "bg-surface-1 border-border-subtle hover:border-gold/40"
                  }`}
                >
                  <span className={`block text-xs font-bold ${modo === m.id ? "text-gold" : "text-text-main"}`}>{m.titulo}</span>
                  <span className="block text-[10px] text-text-muted mt-0.5 leading-snug">{m.ajuda}</span>
                </button>
              ))}
            </div>
          </section>

          {/* SERVIÇOS */}
          <section className="space-y-3">
            <h3 className="font-heading text-sm font-bold text-text-main">Serviços do orçamento ({itens.length})</h3>

            <div>
              <label className={labelCls}>Toque para adicionar do catálogo (os preços abaixo são só sugestão e podem ser alterados)</label>
              <div className="flex flex-wrap gap-1.5">
                {servicos.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addDoCatalogo(s)}
                    className="inline-flex items-center gap-1 bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-gold/50 text-text-main text-[11px] px-2.5 py-1.5 rounded-lg"
                  >
                    <Plus className="w-3 h-3 text-gold" /> {s.nome}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={addPersonalizado}
                  className="inline-flex items-center gap-1 bg-gold/15 hover:bg-gold/25 border border-gold/40 text-gold text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                >
                  <Plus className="w-3 h-3" /> Item personalizado
                </button>
              </div>
            </div>

            {itens.length === 0 && (
              <p className="text-xs text-text-muted bg-surface-1 border border-dashed border-border-subtle rounded-xl p-4 text-center">
                Nenhum serviço ainda. Toque em um serviço acima para começar.
              </p>
            )}

            {itens.map((it, idx) => (
              <div key={it.key} className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="w-7 h-7 rounded-lg bg-[#1b80c4] text-white font-bold flex items-center justify-center text-xs shrink-0">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <input
                      className={`${inputCls} font-bold text-gold`}
                      value={it.identificacao}
                      onChange={(e) => patch(it.key, { identificacao: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {modo === "por_item" && (
                      <span className="font-heading font-bold text-sm text-gold">
                        {formatCurrency(Math.max(1, it.quantidade) * num(it.preco))}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => remover(it.key)}
                      className="p-1.5 rounded-lg bg-surface-1 hover:bg-destructive/20 text-text-muted hover:text-destructive"
                      title="Remover item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className={`grid gap-2 ${modo === "por_item" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                  <div className={modo === "por_item" ? "col-span-2" : "col-span-2"}>
                    <label className={labelCls}>Serviço *</label>
                    <input className={inputCls} value={it.servicoNome} onChange={(e) => patch(it.key, { servicoNome: e.target.value })} />
                  </div>
                  <div>
                    <label className={labelCls}>Qtd.</label>
                    <input
                      type="number"
                      min={1}
                      className={inputCls}
                      value={it.quantidade}
                      onChange={(e) => patch(it.key, { quantidade: Math.max(1, parseInt(e.target.value, 10) || 1) })}
                    />
                  </div>
                  {modo === "por_item" && (
                    <div>
                      <label className={labelCls}>Valor unit. (R$)</label>
                      <input
                        inputMode="decimal"
                        className={inputCls}
                        value={it.preco}
                        placeholder="0,00"
                        onChange={(e) => patch(it.key, { preco: e.target.value })}
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Descrição no escopo</label>
                  <input className={inputCls} value={it.escopo} onChange={(e) => patch(it.key, { escopo: e.target.value })} />
                </div>
                <div>
                  <label className={labelCls}>Detalhamento</label>
                  <textarea rows={2} className={`${inputCls} resize-none`} value={it.descricao} onChange={(e) => patch(it.key, { descricao: e.target.value })} />
                </div>

                <div className="flex items-center gap-3 pt-1">
                  {it.fotoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.fotoUrl} alt={it.identificacao} className="w-16 h-16 rounded-lg object-cover border border-gold/50" />
                  ) : (
                    <span className="text-[10px] text-text-muted">Sem foto (opcional)</span>
                  )}
                  <input
                    ref={(el) => {
                      fotoInputs.current[it.key] = el;
                    }}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      void escolherFoto(it.key, e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                  <button
                    type="button"
                    disabled={processandoFoto === it.key}
                    onClick={() => fotoInputs.current[it.key]?.click()}
                    className="inline-flex items-center gap-1.5 bg-surface-1 hover:bg-surface-3 text-gold border border-border-gold/40 text-[11px] font-bold px-2.5 py-1.5 rounded-lg"
                  >
                    {processandoFoto === it.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Camera className="w-3 h-3" />}
                    {it.fotoUrl ? "Trocar foto" : "Anexar foto"}
                  </button>
                  {it.fotoUrl && (
                    <button
                      type="button"
                      onClick={() => patch(it.key, { fotoUrl: null, fotoNova: false, fotoDe: null })}
                      className="text-[11px] text-text-muted hover:text-destructive"
                    >
                      Remover foto
                    </button>
                  )}
                </div>
              </div>
            ))}
          </section>

          {/* TOTAL */}
          <section className="space-y-3 bg-surface-1 border border-border-gold/40 rounded-2xl p-4">
            {modo === "por_item" && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-text-muted">Soma dos serviços</span>
                  <span className="font-bold text-text-main">{formatCurrency(soma)}</span>
                </div>
                <div>
                  <label className={labelCls}>Valor final do orçamento (opcional — deixe vazio para usar a soma; preencha para dar desconto ou arredondar)</label>
                  <input
                    inputMode="decimal"
                    className={inputCls}
                    value={valorFinalStr}
                    placeholder={soma.toFixed(2).replace(".", ",")}
                    onChange={(e) => setValorFinalStr(e.target.value)}
                  />
                </div>
              </>
            )}
            {modo === "total_unico" && (
              <div>
                <label className={labelCls}>Valor final do orçamento (R$) *</label>
                <input
                  inputMode="decimal"
                  className={`${inputCls} text-base font-bold`}
                  value={valorFinalStr}
                  placeholder="0,00"
                  onChange={(e) => setValorFinalStr(e.target.value)}
                />
              </div>
            )}
            {modo === "a_combinar" && (
              <p className="text-xs text-text-muted">Este orçamento não terá valores. No PDF o total aparece como “A combinar”.</p>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border-subtle/60">
              <span className="text-xs text-text-muted">Total no orçamento</span>
              <span className="text-2xl font-bold font-heading text-gold">
                {modo === "a_combinar" ? "A combinar" : totalExibido != null ? formatCurrency(totalExibido) : "—"}
              </span>
            </div>
          </section>

          {/* TEXTOS */}
          <section className="space-y-3">
            <h3 className="font-heading text-sm font-bold text-text-main">Textos do orçamento</h3>
            <div>
              <label className={labelCls}>Subtítulo</label>
              <input className={inputCls} value={subtitulo} onChange={(e) => setSubtitulo(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Objetivo</label>
              <textarea rows={3} className={`${inputCls} resize-none`} value={objetivo} onChange={(e) => setObjetivo(e.target.value)} placeholder="Se deixar vazio, o PDF cria um texto padrão com os serviços." />
            </div>
            <div>
              <label className={labelCls}>Condições de pagamento</label>
              <textarea rows={2} className={`${inputCls} resize-none`} value={condicoes} onChange={(e) => setCondicoes(e.target.value)} placeholder="Se deixar vazio, o PDF usa o padrão (50% de entrada e 50% ao concluir)." />
            </div>
            <div>
              <label className={labelCls}>Observações</label>
              <input className={inputCls} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
            </div>
            <div className="flex flex-wrap items-center gap-4">
              <div className="w-32">
                <label className={labelCls}>Validade (dias)</label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  className={inputCls}
                  value={validadeDias}
                  onChange={(e) => setValidadeDias(Math.min(365, Math.max(1, parseInt(e.target.value, 10) || 10)))}
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer select-none mt-4">
                <input
                  type="checkbox"
                  checked={mostrarSemFoto}
                  onChange={(e) => setMostrarSemFoto(e.target.checked)}
                  className="w-4 h-4 accent-gold"
                />
                Mostrar “SEM FOTO” em vermelho nos itens sem foto
              </label>
            </div>
          </section>
        </div>

        {/* Ações */}
        <div className="px-5 py-4 border-t border-border-subtle shrink-0 space-y-2">
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={salvando}
              onClick={salvarEGerarPdf}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-[#0e74bc] hover:bg-[#0c63a0] disabled:opacity-50 text-white font-bold text-sm px-4 py-3 rounded-xl"
            >
              {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
              {salvando ? "Salvando..." : "Salvar e gerar PDF"}
            </button>
            <button
              type="button"
              disabled={salvando}
              onClick={soSalvar}
              className="inline-flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle font-semibold text-sm px-4 py-3 rounded-xl"
            >
              <Save className="w-4 h-4" /> Só salvar
            </button>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              onClick={gerarPdfSemSalvar}
              className="flex-1 inline-flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 font-semibold text-xs px-4 py-2.5 rounded-xl"
            >
              <FileText className="w-4 h-4" /> Só gerar PDF (sem salvar)
            </button>
            {whatsLink && (
              <a
                href={whatsLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 inline-flex items-center justify-center gap-2 bg-[#25D366]/15 hover:bg-[#25D366]/25 text-[#25D366] border border-[#25D366]/40 font-semibold text-xs px-4 py-2.5 rounded-xl"
              >
                <MessageCircle className="w-4 h-4" /> Enviar resumo no WhatsApp do cliente
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
