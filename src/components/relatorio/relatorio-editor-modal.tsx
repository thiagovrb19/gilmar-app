"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  ArrowLeftRight,
  Camera,
  ClipboardCheck,
  Loader2,
  Printer,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  RelatorioFotoTipo,
  RelatorioFotoVisualizacao,
  RelatorioServicoDetalhe,
} from "@/lib/supabase/types";
import {
  excluirRelatorioAction,
  obterRelatorioAction,
  obterRelatorioPorAgendamentoAction,
  salvarRelatorioAction,
} from "@/actions/relatorios";
import { comprimirImagem } from "@/lib/imagem/comprimir";
import { RELATORIO_MAX_FOTOS } from "@/lib/relatorios/config";
import { abrirJanelaRelatorio, escreverRelatorioNaJanela } from "@/lib/pdf/relatorio-pdf";
import { getWhatsAppLink } from "@/lib/formatters";
import { WhatsAppIcon } from "@/components/icons/whatsapp-icon";

export interface RelatorioPrefill {
  clienteId?: string | null;
  clienteNome?: string;
  clienteWhatsapp?: string | null;
  clienteLocalidade?: string | null;
  titulo?: string;
  descricao?: string;
  /** Ex.: "#A1B2C3" — aparece no PDF como número do orçamento */
  referencia?: string | null;
}

interface Props {
  onClose: () => void;
  /** Abre um relatório existente */
  relatorioId?: string | null;
  /** Abre (ou cria) o relatório do orçamento informado */
  agendamentoId?: string | null;
  /** Dados iniciais quando o relatório ainda não existe */
  prefill?: RelatorioPrefill;
  /** Chamado após salvar ou excluir, para a tela de trás se atualizar */
  onChanged?: () => void;
}

interface FotoLocal {
  key: string;
  /** id no servidor (ausente enquanto a foto ainda não foi enviada) */
  id?: string;
  tipo: RelatorioFotoTipo;
  legenda: string;
  url: string;
  /** arquivo comprimido aguardando envio */
  blob?: Blob;
}

const inputCls =
  "w-full bg-surface-1 border border-border-subtle rounded-lg px-2.5 py-2 text-xs text-text-main focus:outline-none focus:border-gold";
const labelCls = "text-[10px] text-text-muted block mb-0.5";

function hojeSaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function deServidor(fotos: RelatorioFotoVisualizacao[]): FotoLocal[] {
  return fotos.map((f) => ({ key: f.id, id: f.id, tipo: f.tipo, legenda: f.legenda || "", url: f.url }));
}

function liberarPrevias(fotos: FotoLocal[]) {
  fotos.forEach((f) => {
    if (f.blob && f.url.startsWith("blob:")) {
      try {
        URL.revokeObjectURL(f.url);
      } catch {
        // ignora
      }
    }
  });
}

export function RelatorioEditorModal({ onClose, relatorioId, agendamentoId, prefill, onChanged }: Props) {
  const [carregando, setCarregando] = useState(Boolean(relatorioId || agendamentoId));
  const [id, setId] = useState<string | null>(relatorioId || null);
  const [clienteNome, setClienteNome] = useState(prefill?.clienteNome || "");
  const [clienteWhatsapp, setClienteWhatsapp] = useState(prefill?.clienteWhatsapp || "");
  const [clienteLocalidade, setClienteLocalidade] = useState(prefill?.clienteLocalidade || "");
  const [dataServico, setDataServico] = useState(hojeSaoPaulo());
  const [titulo, setTitulo] = useState(prefill?.titulo || "");
  const [descricao, setDescricao] = useState(prefill?.descricao || "");
  const [observacoes, setObservacoes] = useState("");
  const [fotos, setFotos] = useState<FotoLocal[]>([]);
  const [processando, setProcessando] = useState<RelatorioFotoTipo | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  // Espelho das fotos para uso em efeitos e funções assíncronas (sempre o valor mais recente)
  const fotosRef = useRef<FotoLocal[]>([]);
  useEffect(() => {
    fotosRef.current = fotos;
  }, [fotos]);
  const ocupado = Boolean(status) || excluindo;

  const aplicar = (r: RelatorioServicoDetalhe) => {
    setId(r.id);
    setClienteNome(r.cliente_nome || "");
    setClienteWhatsapp(r.cliente_whatsapp || "");
    setClienteLocalidade(r.cliente_localidade || "");
    setDataServico(r.data_servico || hojeSaoPaulo());
    setTitulo(r.titulo || "");
    setDescricao(r.descricao || "");
    setObservacoes(r.observacoes || "");
    liberarPrevias(fotosRef.current);
    setFotos(deServidor(r.fotos));
  };

  // Carrega o relatório existente (pelo id ou pelo orçamento de origem)
  useEffect(() => {
    let ativo = true;
    (async () => {
      if (!relatorioId && !agendamentoId) return;
      try {
        if (relatorioId) {
          const res = await obterRelatorioAction(relatorioId);
          if (!ativo) return;
          if (res.success && res.relatorio) aplicar(res.relatorio);
          else toast.error(res.error || "Não foi possível abrir o relatório.");
        } else if (agendamentoId) {
          const res = await obterRelatorioPorAgendamentoAction(agendamentoId);
          if (!ativo) return;
          if (res.relatorio) aplicar(res.relatorio);
          else if (!res.success) toast.error(res.error || "Não foi possível abrir o relatório.");
        }
      } catch {
        if (ativo) toast.error("Não foi possível abrir o relatório. Verifique sua conexão.");
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [relatorioId, agendamentoId]);

  // Libera as prévias locais ao fechar
  useEffect(() => () => liberarPrevias(fotosRef.current), []);

  const adicionarFotos = async (tipo: RelatorioFotoTipo, lista: FileList | null) => {
    const arquivos = Array.from(lista || []);
    if (arquivos.length === 0) return;
    const vagas = RELATORIO_MAX_FOTOS - fotos.length;
    if (vagas <= 0) {
      toast.error(`O relatório aceita no máximo ${RELATORIO_MAX_FOTOS} fotos.`);
      return;
    }
    if (arquivos.length > vagas) {
      toast.error(`Só cabem mais ${vagas} foto(s) neste relatório. As demais foram ignoradas.`);
    }
    setProcessando(tipo);
    try {
      for (const file of arquivos.slice(0, vagas)) {
        try {
          const { blob } = await comprimirImagem(file, { maxDim: 1400, qualidade: 0.8, maxBytes: 550 * 1024 });
          const nova: FotoLocal = {
            key: `nova-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
            tipo,
            legenda: "",
            url: URL.createObjectURL(blob),
            blob,
          };
          setFotos((prev) => [...prev, nova]);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Não foi possível usar esta foto.");
        }
      }
    } finally {
      setProcessando(null);
    }
  };

  const patchFoto = (key: string, patch: Partial<FotoLocal>) =>
    setFotos((prev) => prev.map((f) => (f.key === key ? { ...f, ...patch } : f)));

  const removerFoto = (key: string) =>
    setFotos((prev) => {
      liberarPrevias(prev.filter((f) => f.key === key));
      return prev.filter((f) => f.key !== key);
    });

  /** Salva textos, sincroniza as fotos já enviadas e envia as novas. Devolve o relatório salvo. */
  const salvar = async (): Promise<RelatorioServicoDetalhe | null> => {
    if (clienteNome.trim().length < 2) {
      toast.error("Informe o nome do cliente.");
      return null;
    }
    const atuais = fotos;
    try {
      setStatus("Salvando relatório...");
      const res = await salvarRelatorioAction({
        id,
        agendamentoId: agendamentoId || null,
        clienteId: prefill?.clienteId || null,
        clienteNome,
        clienteWhatsapp,
        clienteLocalidade,
        titulo,
        descricao,
        observacoes,
        dataServico,
        fotos: atuais.filter((f) => f.id).map((f) => ({ id: f.id!, tipo: f.tipo, legenda: f.legenda })),
      });
      if (!res.success || !res.id) {
        toast.error(res.error || "Não foi possível salvar o relatório.");
        return null;
      }
      const relatorioSalvoId = res.id;
      setId(relatorioSalvoId);

      // Envia as fotos novas, uma por vez
      const novas = atuais.filter((f) => !f.id && f.blob);
      let falhas = 0;
      for (let i = 0; i < novas.length; i++) {
        const f = novas[i];
        setStatus(`Enviando foto ${i + 1} de ${novas.length}...`);
        try {
          const fd = new FormData();
          fd.append("relatorioId", relatorioSalvoId);
          fd.append("tipo", f.tipo);
          fd.append("legenda", f.legenda);
          fd.append("file", new File([f.blob!], `${f.tipo}-${i + 1}.jpg`, { type: "image/jpeg" }));
          const resp = await fetch("/api/admin/relatorios/fotos", { method: "POST", body: fd });
          const json = (await resp.json().catch(() => null)) as { error?: string } | null;
          if (!resp.ok) {
            falhas++;
            toast.error(json?.error || "Falha ao enviar uma das fotos.");
          }
        } catch {
          falhas++;
          toast.error("Falha de conexão ao enviar uma das fotos.");
        }
      }

      setStatus("Finalizando...");
      const final = await obterRelatorioAction(relatorioSalvoId);
      onChanged?.();
      if (!final.success || !final.relatorio) {
        toast.error(final.error || "Relatório salvo, mas não foi possível recarregar as fotos.");
        return null;
      }
      aplicar(final.relatorio);
      if (falhas > 0) {
        toast.error(`${falhas} foto(s) não foram enviadas. Adicione-as novamente e salve.`);
      } else {
        toast.success("Relatório salvo!");
      }
      return final.relatorio;
    } catch {
      toast.error("Não foi possível salvar. Verifique sua conexão e tente novamente.");
      return null;
    } finally {
      setStatus(null);
    }
  };

  const salvarEGerarPdf = async () => {
    if (clienteNome.trim().length < 2) {
      toast.error("Informe o nome do cliente.");
      return;
    }
    // A janela precisa ser aberta já no clique; depois do envio das fotos o navegador bloquearia o pop-up
    const win = abrirJanelaRelatorio();
    if (!win) {
      toast.error("Permita pop-ups no navegador para abrir o PDF.");
      return;
    }
    const salvo = await salvar();
    if (!salvo) {
      win.close();
      return;
    }
    escreverRelatorioNaJanela(win, {
      clienteNome: salvo.cliente_nome,
      clienteLocalidade: salvo.cliente_localidade,
      dataServico: salvo.data_servico,
      referencia: prefill?.referencia || null,
      titulo: salvo.titulo,
      descricao: salvo.descricao,
      observacoes: salvo.observacoes,
      fotos: salvo.fotos.map((f) => ({ tipo: f.tipo, legenda: f.legenda, url: f.url })),
    });
  };

  const excluir = async () => {
    if (!id) return;
    if (!confirm("Excluir este relatório e todas as fotos dele? Esta ação não pode ser desfeita.")) return;
    setExcluindo(true);
    try {
      const res = await excluirRelatorioAction(id);
      if (!res.success) {
        toast.error(res.error || "Não foi possível excluir o relatório.");
        return;
      }
      toast.success("Relatório excluído.");
      onChanged?.();
      onClose();
    } catch {
      toast.error("Não foi possível excluir. Verifique sua conexão.");
    } finally {
      setExcluindo(false);
    }
  };

  const digitosWhats = clienteWhatsapp.replace(/\D/g, "");
  const linkWhats =
    digitosWhats.length >= 10
      ? getWhatsAppLink(
          digitosWhats,
          `Olá, ${clienteNome.trim() || "tudo bem"}! Aqui é o Gilmar da GS Elétrica e Manutenção. Segue o relatório do serviço executado, com as fotos de antes e depois.`
        )
      : null;

  const renderColuna = (tipo: RelatorioFotoTipo) => {
    const lista = fotos.filter((f) => f.tipo === tipo);
    const ehAntes = tipo === "antes";
    return (
      <div className="bg-surface-2/60 border border-border-subtle rounded-xl p-3 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`text-[11px] font-extrabold px-2.5 py-1 rounded-md text-white tracking-wide ${
                ehAntes ? "bg-red-700" : "bg-green-700"
              }`}
            >
              {ehAntes ? "ANTES" : "DEPOIS"}
            </span>
            <span className="text-[11px] text-text-muted">{lista.length} foto(s)</span>
          </div>
          <label
            className={`inline-flex items-center gap-1.5 bg-surface-1 hover:bg-surface-3 text-gold border border-border-gold/40 text-[11px] font-bold px-3 py-2 rounded-lg cursor-pointer ${
              ocupado || processando ? "opacity-60 pointer-events-none" : ""
            }`}
          >
            {processando === tipo ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Camera className="w-3.5 h-3.5" />}
            <span>Adicionar fotos</span>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              aria-label={`Adicionar fotos de ${ehAntes ? "antes" : "depois"}`}
              onChange={(e) => {
                const arquivos = e.target.files;
                void adicionarFotos(tipo, arquivos).finally(() => {
                  e.target.value = "";
                });
              }}
            />
          </label>
        </div>

        {lista.length === 0 ? (
          <p className="text-[11px] text-text-muted text-center py-6 border border-dashed border-border-subtle rounded-lg">
            {ehAntes
              ? "Nenhuma foto de como estava antes do serviço."
              : "Nenhuma foto de como ficou depois do serviço."}
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-2.5">
            {lista.map((f, i) => (
              <div key={f.key} className="bg-surface-1 border border-border-subtle rounded-lg overflow-hidden flex flex-col">
                <a
                  href={f.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative block aspect-[4/3] bg-black/50"
                  title="Clique para ampliar"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={f.url} alt={`${ehAntes ? "Antes" : "Depois"} ${i + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-1 left-1.5 bg-black/75 text-[9px] text-white px-1.5 py-0.5 rounded font-mono">
                    #{i + 1}
                  </span>
                  {!f.id && (
                    <span className="absolute top-1 left-1.5 bg-gold text-bg-base text-[9px] font-bold px-1.5 py-0.5 rounded">
                      Nova
                    </span>
                  )}
                </a>
                <div className="p-1.5 space-y-1.5">
                  <input
                    className={inputCls}
                    value={f.legenda}
                    maxLength={200}
                    placeholder="Legenda (opcional)"
                    aria-label={`Legenda da foto ${i + 1} de ${ehAntes ? "antes" : "depois"}`}
                    onChange={(e) => patchFoto(f.key, { legenda: e.target.value })}
                  />
                  <div className="flex items-center justify-between gap-1">
                    <button
                      type="button"
                      onClick={() => patchFoto(f.key, { tipo: ehAntes ? "depois" : "antes" })}
                      className="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-gold px-1.5 py-1.5 rounded"
                      title={`Mover para "${ehAntes ? "Depois" : "Antes"}"`}
                    >
                      <ArrowLeftRight className="w-3 h-3" />
                      <span>{ehAntes ? "É depois" : "É antes"}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => removerFoto(f.key)}
                      className="inline-flex items-center gap-1 text-[10px] text-text-muted hover:text-destructive px-1.5 py-1.5 rounded"
                      title="Remover foto"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Remover</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div
      role="dialog"
      aria-label="Relatório de Serviço"
      className="fixed inset-0 z-[70] bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-bg-base border border-border-gold/40 rounded-t-3xl sm:rounded-3xl w-full max-w-3xl max-h-[94vh] flex flex-col shadow-2xl">
        {/* Cabeçalho */}
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border-subtle shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <ClipboardCheck className="w-5 h-5 text-gold shrink-0" />
            <div className="min-w-0">
              <h2 className="font-heading font-bold text-base text-text-main truncate">
                Relatório de Serviço (Antes e Depois)
              </h2>
              <p className="text-[11px] text-text-muted">
                Anexe as fotos de antes e depois, descreva o que foi feito e gere o PDF para enviar ao cliente.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={ocupado}
            className="p-2 rounded-xl bg-surface-2 hover:bg-surface-3 text-text-muted disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {carregando ? (
          <div className="py-16 flex flex-col items-center justify-center gap-2 text-text-muted text-xs">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
            <span>Carregando relatório...</span>
          </div>
        ) : (
          <>
            {/* Corpo rolável */}
            <div className="overflow-y-auto px-5 py-4 space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className={labelCls} htmlFor="rel-cliente">Cliente / Empresa *</label>
                  <input id="rel-cliente" className={inputCls} value={clienteNome} maxLength={120} onChange={(e) => setClienteNome(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="rel-whats">WhatsApp do cliente</label>
                  <input id="rel-whats" className={inputCls} value={clienteWhatsapp} inputMode="tel" placeholder="(32) 99999-9999" onChange={(e) => setClienteWhatsapp(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="rel-local">Cidade / Localidade</label>
                  <input id="rel-local" className={inputCls} value={clienteLocalidade} maxLength={200} onChange={(e) => setClienteLocalidade(e.target.value)} />
                </div>
                <div>
                  <label className={labelCls} htmlFor="rel-data">Data do serviço</label>
                  <input id="rel-data" type="date" className={inputCls} value={dataServico} onChange={(e) => setDataServico(e.target.value)} />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelCls} htmlFor="rel-titulo">Serviço realizado (título)</label>
                  <input
                    id="rel-titulo"
                    className={inputCls}
                    value={titulo}
                    maxLength={200}
                    placeholder="Ex.: Instalação de disjuntor e identificação do quadro elétrico"
                    onChange={(e) => setTitulo(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className={labelCls} htmlFor="rel-descricao">O que foi feito</label>
                  <textarea
                    id="rel-descricao"
                    rows={3}
                    className={`${inputCls} resize-none`}
                    value={descricao}
                    maxLength={4000}
                    placeholder="Ex.: Acrescentado um disjuntor no painel e aplicado adesivo de identificação de perigo na porta do quadro."
                    onChange={(e) => setDescricao(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading text-sm font-bold text-text-main">Fotos do serviço</h3>
                  <span className="text-[11px] text-text-muted">
                    {fotos.length} de {RELATORIO_MAX_FOTOS}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted">
                  No PDF, a 1ª foto de &ldquo;Antes&rdquo; sai ao lado da 1ª de &ldquo;Depois&rdquo;, a 2ª ao lado da 2ª, e assim por diante.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {renderColuna("antes")}
                  {renderColuna("depois")}
                </div>
              </div>

              <div>
                <label className={labelCls} htmlFor="rel-obs">Observações e recomendações (opcional)</label>
                <textarea
                  id="rel-obs"
                  rows={2}
                  className={`${inputCls} resize-none`}
                  value={observacoes}
                  maxLength={2000}
                  placeholder="Ex.: Recomenda-se revisão do quadro a cada 12 meses."
                  onChange={(e) => setObservacoes(e.target.value)}
                />
              </div>

              {id && (
                <button
                  type="button"
                  onClick={excluir}
                  disabled={ocupado}
                  className="inline-flex items-center gap-1.5 text-[11px] text-text-muted hover:text-destructive disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{excluindo ? "Excluindo..." : "Excluir este relatório"}</span>
                </button>
              )}
            </div>

            {/* Rodapé de ações */}
            <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2 px-5 py-3 sm:py-4 border-t border-border-subtle shrink-0">
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void salvarEGerarPdf()}
                className="col-span-2 sm:flex-1 inline-flex items-center justify-center gap-2 bg-[#0e74bc] hover:bg-[#0c63a0] disabled:opacity-50 text-white font-bold text-sm px-4 py-3 rounded-xl"
              >
                {status ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                <span>{status || "Salvar e gerar PDF"}</span>
              </button>
              <button
                type="button"
                disabled={ocupado}
                onClick={() => void salvar()}
                className={`${
                  linkWhats ? "" : "col-span-2 "
                }inline-flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-3 disabled:opacity-50 text-text-main border border-border-subtle font-semibold text-sm px-4 py-3 rounded-xl`}
              >
                <Save className="w-4 h-4" /> Só salvar
              </button>
              {linkWhats && (
                <a
                  href={linkWhats}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-success/20 hover:bg-success/30 text-success border border-success/40 font-semibold text-sm px-4 py-3 rounded-xl"
                  title="Abre a conversa com o cliente; anexe o PDF baixado"
                >
                  <WhatsAppIcon className="w-4 h-4 fill-current" /> WhatsApp
                </a>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
