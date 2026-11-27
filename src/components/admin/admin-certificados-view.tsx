"use client";

import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpDown,
  Award,
  Check,
  ChevronDown,
  ChevronUp,
  ChevronsUp,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Pencil,
  Trash2,
  Upload,
  X,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { CertificadoView } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import { broadcastSync } from "@/hooks/use-realtime-sync";
import {
  CERTIFICADOS_BUCKET,
  CERTIFICADO_MAX_BYTES,
  formatarTamanho,
} from "@/lib/certificados/config";
import {
  atualizarCertificadoAction,
  excluirCertificadoAction,
  iniciarUploadCertificadoAction,
  registrarCertificadoAction,
  reordenarCertificadosAction,
} from "@/actions/certificados";
import { PdfViewerModal } from "@/components/certificados/pdf-viewer-modal";

const inputCls =
  "w-full bg-surface-2 border border-border-subtle rounded-xl px-3.5 py-2.5 text-sm text-text-main focus:outline-none focus:border-gold";

export function AdminCertificadosView({
  certificados,
  erro,
}: {
  certificados: CertificadoView[];
  erro?: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  // Lista local (para a ordem mudar na hora, antes de o servidor responder)
  const [lista, setLista] = useState<CertificadoView[]>(certificados);
  const [listaServidor, setListaServidor] = useState(certificados);
  const [ordemPendente, setOrdemPendente] = useState(false);
  if (certificados !== listaServidor) {
    setListaServidor(certificados);
    if (!ordemPendente) setLista(certificados); // não sobrescreve enquanto há mudança de ordem sendo salva
  }
  const [modoOrdem, setModoOrdem] = useState(false);
  const [ordemSalva, setOrdemSalva] = useState(false);
  const [visualizando, setVisualizando] = useState<CertificadoView | null>(null);
  const timerOrdem = useRef<ReturnType<typeof setTimeout> | null>(null);
  const listaRef = useRef(lista);
  useEffect(() => {
    listaRef.current = lista;
  }, [lista]);

  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [enviando, setEnviando] = useState(false);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [editTitulo, setEditTitulo] = useState("");
  const [editDescricao, setEditDescricao] = useState("");
  const [ocupadoId, setOcupadoId] = useState<string | null>(null);

  const atualizarTela = () => {
    broadcastSync("certificados");
    router.refresh();
  };

  const escolherArquivo = (f: File | null) => {
    if (!f) return setArquivo(null);
    if (!/\.pdf$/i.test(f.name) && f.type !== "application/pdf") {
      toast.error("Escolha um arquivo PDF.");
      return;
    }
    if (f.size > CERTIFICADO_MAX_BYTES) {
      toast.error("O PDF excede o limite de 20 MB.");
      return;
    }
    setArquivo(f);
    if (!titulo.trim()) setTitulo(f.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ").trim());
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!arquivo) return toast.error("Escolha o PDF do certificado.");
    if (titulo.trim().length < 2) return toast.error("Informe o nome do certificado.");

    setEnviando(true);
    try {
      // 1. servidor valida e libera um upload de uso único
      const inicio = await iniciarUploadCertificadoAction({ nomeArquivo: arquivo.name, tamanho: arquivo.size });
      if (!inicio.success) return toast.error(inicio.error);

      // 2. o navegador envia o PDF direto ao Supabase
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(CERTIFICADOS_BUCKET)
        .uploadToSignedUrl(inicio.path, inicio.token, arquivo, { contentType: "application/pdf" });
      if (upErr) return toast.error(`Falha ao enviar o PDF: ${upErr.message}`);

      // 3. servidor confere que é um PDF e cadastra
      const reg = await registrarCertificadoAction({
        path: inicio.path,
        titulo,
        descricao,
        nomeArquivo: arquivo.name,
      });
      if (!reg.success) return toast.error(reg.error);

      toast.success("Certificado publicado! Já aparece para os clientes.");
      setTitulo("");
      setDescricao("");
      setArquivo(null);
      if (fileRef.current) fileRef.current.value = "";
      atualizarTela();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao enviar o certificado.");
    } finally {
      setEnviando(false);
    }
  };

  const abrirEdicao = (c: CertificadoView) => {
    setEditandoId(c.id);
    setEditTitulo(c.titulo);
    setEditDescricao(c.descricao || "");
  };

  const salvarEdicao = async (id: string) => {
    setOcupadoId(id);
    const res = await atualizarCertificadoAction({ id, titulo: editTitulo, descricao: editDescricao });
    setOcupadoId(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Certificado atualizado!");
    setEditandoId(null);
    atualizarTela();
  };

  const alternarAtivo = async (c: CertificadoView) => {
    setOcupadoId(c.id);
    const res = await atualizarCertificadoAction({ id: c.id, ativo: !c.ativo });
    setOcupadoId(null);
    if (!res.success) return toast.error(res.error);
    toast.success(c.ativo ? "Ocultado dos clientes." : "Visível para os clientes.");
    atualizarTela();
  };

  const excluir = async (c: CertificadoView) => {
    if (!window.confirm(`Remover "${c.titulo}" de vez? O PDF será apagado e sumirá para os clientes.`)) return;
    setOcupadoId(c.id);
    const res = await excluirCertificadoAction(c.id);
    setOcupadoId(null);
    if (!res.success) return toast.error(res.error);
    toast.success("Certificado removido.");
    atualizarTela();
  };

  const gravarOrdem = async (ids: string[]) => {
    const res = await reordenarCertificadosAction(ids);
    setOrdemPendente(false);
    if (!res.success) {
      toast.error(res.error);
      router.refresh();
      return;
    }
    setOrdemSalva(true);
    atualizarTela();
  };

  const agendarGravacao = (nova: CertificadoView[]) => {
    setLista(nova);
    setOrdemPendente(true);
    setOrdemSalva(false);
    if (timerOrdem.current) clearTimeout(timerOrdem.current);
    timerOrdem.current = setTimeout(() => {
      timerOrdem.current = null;
      void gravarOrdem(nova.map((c) => c.id));
    }, 500);
  };

  const mover = (idx: number, destino: number) => {
    if (destino < 0 || destino >= lista.length || destino === idx) return;
    const nova = [...lista];
    const [item] = nova.splice(idx, 1);
    nova.splice(destino, 0, item);
    agendarGravacao(nova);
  };

  const concluirOrdem = () => {
    if (timerOrdem.current) {
      clearTimeout(timerOrdem.current);
      timerOrdem.current = null;
      void gravarOrdem(listaRef.current.map((c) => c.id));
    }
    setModoOrdem(false);
  };

  // Se sair da tela com uma mudança de ordem ainda não enviada, envia antes
  useEffect(() => {
    return () => {
      if (timerOrdem.current) {
        clearTimeout(timerOrdem.current);
        void reordenarCertificadosAction(listaRef.current.map((c) => c.id));
      }
    };
  }, []);

  return (
    <div className="space-y-6">
      <div className="border-b border-border-subtle pb-4">
        <span className="text-xs text-gold font-semibold flex items-center gap-1.5">
          <Award className="w-3.5 h-3.5" /> Prova de qualificação
        </span>
        <div className="flex items-center justify-between gap-3 mt-1">
          <h1 className="text-2xl font-bold font-heading text-text-main">Certificados e NRs</h1>
          {lista.length > 1 && (
            <button
              type="button"
              onClick={() => {
                setModoOrdem(true);
                setTimeout(() => document.getElementById("lista-certificados")?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
              }}
              className="inline-flex items-center gap-1.5 bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 text-xs font-bold px-3 py-2 rounded-xl shrink-0"
            >
              <ArrowUpDown className="w-3.5 h-3.5" /> Reordenar
            </button>
          )}
        </div>
        <p className="text-xs text-text-muted mt-1">
          Envie os PDFs das certificações. Eles aparecem na hora para os clientes, no card “Certificados” da página
          inicial.
        </p>
      </div>

      {erro && (
        <div className="bg-destructive/10 border border-destructive/40 text-destructive text-xs rounded-xl p-3.5 leading-relaxed">
          {erro}
        </div>
      )}

      {/* ENVIAR NOVO */}
      <form onSubmit={handleEnviar} className="bg-surface-1 border border-border-gold/40 rounded-2xl p-5 space-y-3.5">
        <h2 className="font-heading text-sm font-bold text-text-main flex items-center gap-2">
          <Upload className="w-4 h-4 text-gold" /> Adicionar certificado
        </h2>

        <div>
          <label className="text-[11px] text-text-muted block mb-1">Nome do certificado *</label>
          <input
            className={inputCls}
            value={titulo}
            maxLength={160}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex: NR-10 — Segurança em Instalações Elétricas"
          />
        </div>

        <div>
          <label className="text-[11px] text-text-muted block mb-1">Descrição (opcional)</label>
          <input
            className={inputCls}
            value={descricao}
            maxLength={600}
            onChange={(e) => setDescricao(e.target.value)}
            placeholder="Ex: Válido até 2027 · Carga horária 40h"
          />
        </div>

        <div>
          <label className="text-[11px] text-text-muted block mb-1">Arquivo PDF * (até 20 MB)</label>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf"
            onChange={(e) => escolherArquivo(e.target.files?.[0] || null)}
            className="block w-full text-xs text-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-gold/20 file:text-gold file:font-semibold file:px-3 file:py-2 file:cursor-pointer"
          />
          {arquivo && (
            <p className="text-[11px] text-text-muted mt-1.5 flex items-center gap-1.5">
              <FileText className="w-3 h-3" /> {arquivo.name} · {formatarTamanho(arquivo.size)}
            </p>
          )}
        </div>

        <button
          type="submit"
          disabled={enviando}
          className="w-full inline-flex items-center justify-center gap-2 metallic-gold-btn disabled:opacity-50 font-bold text-sm py-3.5 rounded-xl"
        >
          {enviando ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" /> Enviando PDF...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" /> Publicar certificado
            </>
          )}
        </button>
      </form>

      {/* LISTA */}
      <div id="lista-certificados" className="space-y-3 scroll-mt-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-heading text-sm font-bold text-text-main">Certificados publicados ({lista.length})</h2>
          {lista.length > 1 && !modoOrdem && (
            <button
              type="button"
              onClick={() => setModoOrdem(true)}
              className="inline-flex items-center gap-1.5 bg-gold/15 hover:bg-gold/25 text-gold border border-gold/40 text-xs font-bold px-3 py-2 rounded-xl"
            >
              <ArrowUpDown className="w-3.5 h-3.5" /> Reordenar
            </button>
          )}
        </div>

        {modoOrdem && (
          <div className="bg-surface-1 border border-border-gold/40 rounded-2xl p-3 space-y-2">
            <p className="text-[11px] text-text-muted leading-relaxed">
              Use as setas para colocar os mais importantes <strong className="text-gold">primeiro</strong>. A ordem vale
              para o que o cliente vê. <span className="text-text-main">{ordemPendente ? "Salvando..." : ordemSalva ? "Ordem salva ✓" : ""}</span>
            </p>
            {lista.map((c, i) => (
              <div key={c.id} className="flex items-center gap-2 bg-bg-base border border-border-subtle rounded-xl p-2">
                <span className="w-7 text-center text-sm font-bold text-gold shrink-0">{i + 1}</span>
                <span className="flex-1 min-w-0 text-xs text-text-main leading-snug line-clamp-2">
                  {c.titulo}
                  {!c.ativo && <span className="ml-1.5 text-destructive font-semibold">(oculto)</span>}
                </span>
                <button
                  type="button"
                  onClick={() => mover(i, 0)}
                  disabled={i === 0}
                  className="p-2 rounded-lg bg-surface-2 text-gold disabled:opacity-30"
                  aria-label="Colocar no topo"
                  title="Colocar no topo"
                >
                  <ChevronsUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, i - 1)}
                  disabled={i === 0}
                  className="p-2 rounded-lg bg-surface-2 text-text-main disabled:opacity-30"
                  aria-label="Subir"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => mover(i, i + 1)}
                  disabled={i === lista.length - 1}
                  className="p-2 rounded-lg bg-surface-2 text-text-main disabled:opacity-30"
                  aria-label="Descer"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={concluirOrdem}
              className="w-full inline-flex items-center justify-center gap-2 metallic-gold-btn font-bold text-sm py-3 rounded-xl"
            >
              <Check className="w-4 h-4" /> Concluir
            </button>
          </div>
        )}

        {lista.length === 0 && (
          <p className="text-xs text-text-muted bg-surface-1 border border-border-subtle rounded-2xl p-5 text-center">
            Nenhum certificado ainda. Envie o primeiro acima.
          </p>
        )}

        {!modoOrdem && lista.map((c) => {
          const editando = editandoId === c.id;
          const ocupado = ocupadoId === c.id;
          return (
            <div
              key={c.id}
              className={`bg-surface-1 border rounded-2xl p-4 space-y-3 transition-opacity ${
                c.ativo ? "border-border-subtle" : "border-border-subtle/40 opacity-60"
              }`}
            >
              {editando ? (
                <div className="space-y-2.5">
                  <input className={inputCls} value={editTitulo} maxLength={160} onChange={(e) => setEditTitulo(e.target.value)} />
                  <input
                    className={inputCls}
                    value={editDescricao}
                    maxLength={600}
                    onChange={(e) => setEditDescricao(e.target.value)}
                    placeholder="Descrição (opcional)"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={ocupado}
                      onClick={() => salvarEdicao(c.id)}
                      className="inline-flex items-center gap-1.5 metallic-gold-btn font-bold text-xs px-4 py-2 rounded-xl"
                    >
                      <Check className="w-3.5 h-3.5" /> Salvar
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditandoId(null)}
                      className="inline-flex items-center gap-1.5 bg-surface-2 text-text-main border border-border-subtle text-xs font-semibold px-4 py-2 rounded-xl"
                    >
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-heading font-bold text-sm text-text-main break-words">{c.titulo}</h3>
                    {c.descricao && <p className="text-[12px] text-text-muted mt-0.5">{c.descricao}</p>}
                    <p className="text-[10px] text-text-muted mt-1">
                      {formatarTamanho(c.tamanho_bytes)} · {new Date(c.criado_em).toLocaleDateString("pt-BR")}
                      {!c.ativo && <span className="ml-2 text-destructive font-semibold">OCULTO</span>}
                    </p>
                  </div>
                </div>
              )}

              {!editando && (
                <div className="flex flex-wrap gap-2 pt-1 border-t border-border-subtle/60">
                  <button
                    type="button"
                    onClick={() => setVisualizando(c)}
                    className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-gold border border-border-gold/40 text-xs font-semibold px-3 py-2 rounded-xl"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> Abrir
                  </button>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => abrirEdicao(c)}
                    className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs font-semibold px-3 py-2 rounded-xl"
                  >
                    <Pencil className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => alternarAtivo(c)}
                    title={c.ativo ? "Ocultar dos clientes" : "Mostrar para os clientes"}
                    className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs font-semibold px-3 py-2 rounded-xl"
                  >
                    {c.ativo ? <Eye className="w-3.5 h-3.5 text-success" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {c.ativo ? "Visível" : "Oculto"}
                  </button>
                  <button
                    type="button"
                    disabled={ocupado}
                    onClick={() => excluir(c)}
                    title="Remover de vez"
                    className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-destructive/20 text-text-muted hover:text-destructive border border-border-subtle text-xs font-semibold px-3 py-2 rounded-xl ml-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Remover
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {visualizando && (
        <PdfViewerModal
          url={visualizando.url}
          titulo={visualizando.titulo}
          nomeArquivo={visualizando.arquivo_nome}
          onClose={() => setVisualizando(null)}
        />
      )}
    </div>
  );
}
