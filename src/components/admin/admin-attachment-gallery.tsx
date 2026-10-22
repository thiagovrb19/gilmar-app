"use client";

import React, { useState, useEffect } from "react";
import {
  Image as ImageIcon,
  Eye,
  Trash2,
  ExternalLink,
  X,
  Loader2,
  FileQuestion,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { AnexoVisualizacao } from "@/lib/supabase/types";
import { formatarTamanhoArquivo } from "@/lib/anexos/config";
import { getAnexosAgendamentoAction, excluirAnexoAction } from "@/actions/anexos";

interface AdminAttachmentGalleryProps {
  agendamentoId: string;
  initialAnexos?: AnexoVisualizacao[];
  onAnexoRemovido?: () => void;
}

export function AdminAttachmentGallery({
  agendamentoId,
  initialAnexos,
  onAnexoRemovido,
}: AdminAttachmentGalleryProps) {
  const [anexos, setAnexos] = useState<AnexoVisualizacao[]>(initialAnexos || []);
  const [loading, setLoading] = useState(!initialAnexos);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const carregarAnexos = async () => {
    if (!agendamentoId) return;
    setLoading(true);
    try {
      const res = await getAnexosAgendamentoAction(agendamentoId);
      if (res.success) {
        setAnexos(res.anexos);
      } else {
        toast.error(res.error || "Erro ao carregar anexos.");
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro inesperado ao consultar imagens.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!initialAnexos) {
      carregarAnexos();
    }
  }, [agendamentoId]);

  const handleExcluir = async (anexoId: string, nome: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Tem certeza que deseja remover o anexo "${nome}"?`)) {
      return;
    }

    setIsDeleting(anexoId);
    try {
      const res = await excluirAnexoAction(anexoId);
      if (res.success) {
        toast.success("Imagem removida com sucesso!");
        setAnexos((prev) => prev.filter((a) => a.id !== anexoId));
        if (onAnexoRemovido) onAnexoRemovido();
      } else {
        toast.error(res.error || "Erro ao excluir imagem.");
      }
    } catch {
      toast.error("Erro inesperado ao excluir anexo.");
    } finally {
      setIsDeleting(null);
    }
  };

  const activeImage = lightboxIndex !== null ? anexos[lightboxIndex] : null;

  return (
    <div className="space-y-3 bg-surface-1 border border-border-gold/30 rounded-2xl p-4 shadow-sm">
      {/* CABEÇALHO DA SEÇÃO */}
      <div className="flex items-center justify-between border-b border-border-subtle pb-2.5">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gold/15 text-gold border border-gold/30 flex items-center justify-center">
            <ImageIcon className="w-4 h-4" />
          </div>
          <div>
            <h4 className="font-heading text-sm font-bold text-text-main">
              Imagens anexadas
            </h4>
            <span className="text-[10px] text-text-muted">
              {anexos.length === 1
                ? "1 imagem anexada pelo cliente"
                : `${anexos.length} imagens anexadas pelo cliente`}
            </span>
          </div>
        </div>

        <button
          type="button"
          onClick={carregarAnexos}
          disabled={loading}
          className="text-text-muted hover:text-gold p-1.5 rounded-lg hover:bg-surface-2 transition-colors"
          title="Recarregar imagens"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin text-gold" : ""}`} />
        </button>
      </div>

      {/* CONTEÚDO */}
      {loading ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-text-muted text-xs">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
          <span>Carregando anexos da solicitação...</span>
        </div>
      ) : anexos.length === 0 ? (
        <div className="py-6 px-4 bg-surface-2/40 border border-border-subtle/50 rounded-xl text-center space-y-1.5">
          <FileQuestion className="w-7 h-7 mx-auto text-text-muted/60" />
          <p className="text-xs font-semibold text-text-main">
            Nenhuma imagem anexada
          </p>
          <p className="text-[11px] text-text-muted max-w-xs mx-auto">
            O cliente não enviou fotos nesta solicitação. O orçamento pode ser elaborado normalmente pelo histórico e descrição do serviço.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 pt-1">
          {anexos.map((anexo, idx) => (
            <div
              key={anexo.id}
              className="group relative bg-surface-2 border border-border-subtle hover:border-gold/60 rounded-xl overflow-hidden shadow-sm flex flex-col transition-all"
            >
              <div
                onClick={() => setLightboxIndex(idx)}
                className="relative aspect-video w-full bg-black/50 overflow-hidden cursor-zoom-in"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={anexo.url}
                  alt={anexo.nome_original}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 text-white transition-opacity">
                  <span className="p-1.5 rounded-full bg-black/60 hover:bg-gold hover:text-bg-base transition-colors">
                    <Eye className="w-4 h-4" />
                  </span>
                </div>

                <span className="absolute bottom-1 left-1.5 bg-black/75 text-[9px] text-white/90 px-1 py-0.2 rounded font-mono">
                  #{idx + 1}
                </span>
              </div>

              <div className="p-2 flex items-center justify-between text-[10px] text-text-muted bg-surface-1">
                <span className="truncate max-w-[90px]" title={anexo.nome_original}>
                  {anexo.nome_original}
                </span>
                <div className="flex items-center gap-1">
                  <span className="text-[9px] text-text-muted/80">
                    {formatarTamanhoArquivo(anexo.tamanho_bytes)}
                  </span>
                  <button
                    type="button"
                    disabled={isDeleting === anexo.id}
                    onClick={(e) => handleExcluir(anexo.id, anexo.nome_original, e)}
                    className="p-1 hover:text-destructive text-text-muted rounded transition-colors disabled:opacity-50"
                    title="Excluir imagem"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIGHTBOX / MODAL DE AMPLIAÇÃO PARA ANÁLISE DETALHADA PELO GILMAR */}
      {activeImage && (
        <div
          role="dialog"
          onClick={() => setLightboxIndex(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-200"
        >
          {/* BARRA SUPERIOR DO LIGHTBOX */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-4xl flex items-center justify-between pb-3 text-white text-xs font-medium"
          >
            <div className="flex items-center gap-2">
              <span className="bg-gold text-bg-base px-2 py-0.5 rounded-full font-bold text-[10px]">
                Imagem {lightboxIndex! + 1} de {anexos.length}
              </span>
              <span className="truncate max-w-xs">{activeImage.nome_original}</span>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={activeImage.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 bg-surface-2 hover:bg-surface-3 px-3 py-1.5 rounded-xl border border-border-subtle text-xs transition-colors"
                title="Abrir em nova aba"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir original</span>
              </a>
              <button
                type="button"
                onClick={() => setLightboxIndex(null)}
                className="w-8 h-8 rounded-full bg-surface-2 hover:bg-surface-3 text-white flex items-center justify-center transition-colors"
                title="Fechar (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* IMAGEM AMPLIADA */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative max-h-[80vh] max-w-[90vw] flex items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeImage.url}
              alt={activeImage.nome_original}
              className="max-h-[80vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-border-gold/40"
            />
          </div>

          {/* CONTROLES DE NAVEGAÇÃO ANTERIOR / PRÓXIMO */}
          {anexos.length > 1 && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="flex items-center gap-3 pt-3"
            >
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) =>
                    prev !== null && prev > 0 ? prev - 1 : anexos.length - 1
                  )
                }
                className="px-4 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-white text-xs border border-border-subtle"
              >
                &larr; Anterior
              </button>
              <button
                type="button"
                onClick={() =>
                  setLightboxIndex((prev) =>
                    prev !== null && prev < anexos.length - 1 ? prev + 1 : 0
                  )
                }
                className="px-4 py-1.5 rounded-xl bg-surface-2 hover:bg-surface-3 text-white text-xs border border-border-subtle"
              >
                Próxima &rarr;
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
