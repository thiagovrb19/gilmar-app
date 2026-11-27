"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, ExternalLink, Loader2, Minus, Plus } from "lucide-react";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist/legacy/build/pdf.mjs";

interface Props {
  url: string;
  titulo: string;
  nomeArquivo?: string;
  onClose: () => void;
}

const ZOOMS = [1, 1.5, 2, 3];

/** Uma página do PDF desenhada num <canvas> na largura pedida */
function PaginaPdf({ pdf, numero, larguraCss }: { pdf: PDFDocumentProxy; numero: number; larguraCss: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (larguraCss <= 0) return;
    let cancelado = false;
    let tarefa: RenderTask | null = null;

    (async () => {
      const pagina = await pdf.getPage(numero);
      const canvas = canvasRef.current;
      if (cancelado || !canvas) return;
      const base = pagina.getViewport({ scale: 1 });
      const escalaCss = larguraCss / base.width;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const viewport = pagina.getViewport({ scale: escalaCss * dpr });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${Math.floor(larguraCss)}px`;
      canvas.style.height = `${Math.floor(viewport.height / dpr)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      tarefa = pagina.render({ canvasContext: ctx, viewport });
      await tarefa.promise;
    })().catch(() => {
      /* render cancelado ao trocar o zoom: normal */
    });

    return () => {
      cancelado = true;
      tarefa?.cancel();
    };
  }, [pdf, numero, larguraCss]);

  return <canvas ref={canvasRef} className="bg-white rounded-md shadow-lg block" data-pagina={numero} />;
}

/**
 * Visualizador de PDF dentro do app: botão "Voltar" sempre visível, zoom e download.
 * O gesto/botão de voltar do celular fecha o visualizador (e não sai da página).
 */
export function PdfViewerModal({ url, titulo, nomeArquivo, onClose }: Props) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [erro, setErro] = useState(false);
  const [zoomIdx, setZoomIdx] = useState(0);
  const [largura, setLargura] = useState(0);
  const rolagemRef = useRef<HTMLDivElement>(null);
  const voltarRef = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const entradaNoHistorico = useRef(false);

  // Gesto de voltar do celular = fechar o visualizador
  useEffect(() => {
    window.history.pushState({ visualizadorPdf: true }, "");
    entradaNoHistorico.current = true;
    const aoVoltar = () => {
      entradaNoHistorico.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", aoVoltar);
    return () => window.removeEventListener("popstate", aoVoltar);
  }, []);

  const fechar = useCallback(() => {
    if (entradaNoHistorico.current && window.history.state?.visualizadorPdf) {
      window.history.back(); // dispara o popstate acima, que chama onClose
    } else {
      onCloseRef.current();
    }
  }, []);

  // Esc fecha, trava a rolagem da página por baixo e foca no Voltar
  useEffect(() => {
    const aoTeclar = (e: KeyboardEvent) => e.key === "Escape" && fechar();
    document.addEventListener("keydown", aoTeclar);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    voltarRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", aoTeclar);
      document.body.style.overflow = overflow;
    };
  }, [fechar]);

  // Carrega o PDF (a biblioteca só é baixada quando alguém abre um certificado)
  useEffect(() => {
    let cancelado = false;
    let tarefa: { promise: Promise<PDFDocumentProxy>; destroy: () => void } | null = null;

    (async () => {
      try {
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/legacy/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
        tarefa = pdfjs.getDocument({ url });
        const doc = await tarefa.promise;
        if (cancelado) {
          void doc.destroy();
          return;
        }
        setPdf(doc);
      } catch {
        if (!cancelado) setErro(true);
      }
    })();

    return () => {
      cancelado = true;
      tarefa?.destroy();
    };
  }, [url]);

  // Largura útil da tela para encaixar a página
  useEffect(() => {
    const el = rolagemRef.current;
    if (!el) return;
    const medir = () => setLargura(Math.max(0, el.clientWidth - 24));
    medir();
    const obs = new ResizeObserver(medir);
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const zoom = ZOOMS[zoomIdx];
  const urlDownload = `${url}?download=${encodeURIComponent(nomeArquivo || "certificado.pdf")}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Certificado: ${titulo}`}
      className="fixed inset-0 z-[90] bg-black/95 flex flex-col"
    >
      {/* Barra superior */}
      <div
        className="flex items-center gap-2 px-3 pb-2.5 border-b border-white/10 bg-surface-1 shrink-0"
        style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))" }}
      >
        <button
          ref={voltarRef}
          type="button"
          onClick={fechar}
          className="inline-flex items-center gap-1.5 metallic-gold-btn font-bold text-sm px-4 py-2.5 rounded-xl shrink-0"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar
        </button>
        <h2 className="flex-1 min-w-0 text-xs font-semibold text-text-main leading-snug line-clamp-2 px-1">{titulo}</h2>
        <a
          href={urlDownload}
          className="inline-flex items-center justify-center bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle p-2.5 rounded-xl shrink-0"
          aria-label="Baixar PDF"
          title="Baixar PDF"
        >
          <Download className="w-4 h-4" />
        </a>
      </div>

      {/* Zoom */}
      <div className="flex items-center justify-center gap-2 py-2 bg-surface-1/80 border-b border-white/5 shrink-0">
        <button
          type="button"
          onClick={() => setZoomIdx((i) => Math.max(0, i - 1))}
          disabled={zoomIdx === 0}
          className="p-2 rounded-lg bg-surface-2 text-text-main disabled:opacity-40"
          aria-label="Diminuir zoom"
        >
          <Minus className="w-4 h-4" />
        </button>
        <span className="text-xs text-text-muted w-12 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={() => setZoomIdx((i) => Math.min(ZOOMS.length - 1, i + 1))}
          disabled={zoomIdx === ZOOMS.length - 1}
          className="p-2 rounded-lg bg-surface-2 text-text-main disabled:opacity-40"
          aria-label="Aumentar zoom"
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Páginas */}
      <div ref={rolagemRef} className="flex-1 overflow-auto overscroll-contain p-3">
        {erro ? (
          <div className="max-w-sm mx-auto mt-12 text-center space-y-3">
            <p className="text-sm text-text-main font-semibold">Não foi possível mostrar o certificado aqui.</p>
            <p className="text-xs text-text-muted">Você pode abri-lo no visualizador do seu celular.</p>
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 metallic-gold-btn font-bold text-sm px-5 py-3 rounded-xl"
            >
              <ExternalLink className="w-4 h-4" /> Abrir em outra aba
            </a>
          </div>
        ) : !pdf ? (
          <div className="flex flex-col items-center gap-2 mt-16 text-text-muted" role="status">
            <Loader2 className="w-6 h-6 animate-spin text-gold" />
            <span className="text-xs">Carregando certificado...</span>
          </div>
        ) : (
          <div className="min-w-full w-max flex flex-col items-center gap-3">
            {Array.from({ length: pdf.numPages }, (_, i) => (
              <PaginaPdf key={i + 1} pdf={pdf} numero={i + 1} larguraCss={Math.floor(largura * zoom)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
