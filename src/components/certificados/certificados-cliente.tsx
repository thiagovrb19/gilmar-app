"use client";

import React, { useState } from "react";
import { Award, Download, ExternalLink, FileText, ShieldCheck } from "lucide-react";
import { CertificadoView } from "@/lib/supabase/types";
import { formatarTamanho } from "@/lib/certificados/config";
import { useRealtimeSync } from "@/hooks/use-realtime-sync";
import { PdfViewerModal } from "./pdf-viewer-modal";

/**
 * Lista pública de certificados. Atualiza sozinha (Supabase Realtime + verificação a cada 30 s
 * + ao voltar para a aba), então um certificado novo do Gilmar aparece sem recarregar a página.
 */
export function CertificadosCliente({ certificados }: { certificados: CertificadoView[] }) {
  useRealtimeSync({ tables: ["certificados"], pollIntervalMs: 30000 });
  const [aberto, setAberto] = useState<CertificadoView | null>(null);

  if (certificados.length === 0) {
    return (
      <div className="electric-glass rounded-2xl p-8 text-center space-y-3">
        <div className="w-12 h-12 mx-auto rounded-xl bg-gold/15 text-gold flex items-center justify-center">
          <Award className="w-6 h-6" />
        </div>
        <h2 className="font-heading font-bold text-base text-text-main">Certificados em breve</h2>
        <p className="text-xs text-text-muted max-w-xs mx-auto">
          Os certificados e NRs do Gilmar serão publicados aqui. Volte em instantes.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] text-text-muted">
        {certificados.length} {certificados.length === 1 ? "documento disponível" : "documentos disponíveis"}
      </p>

      {certificados.map((c) => (
        <article key={c.id} className="electric-glass rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3.5">
          <div className="flex items-start gap-3.5 flex-1 min-w-0">
            <div className="w-11 h-11 rounded-xl bg-gold/15 text-gold flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="min-w-0 space-y-1">
              <h2 className="font-heading font-bold text-sm text-text-main leading-snug break-words">{c.titulo}</h2>
              {c.descricao && <p className="text-[12px] text-text-muted leading-relaxed">{c.descricao}</p>}
              <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                <FileText className="w-3 h-3" /> PDF · {formatarTamanho(c.tamanho_bytes)}
              </span>
            </div>
          </div>

          <div className="flex gap-2 sm:shrink-0">
            <button
              type="button"
              onClick={() => setAberto(c)}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 metallic-gold-btn font-bold text-xs px-4 py-2.5 rounded-xl"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Visualizar
            </button>
            <a
              href={`${c.url}?download=${encodeURIComponent(c.arquivo_nome)}`}
              className="inline-flex items-center justify-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle font-semibold text-xs px-3.5 py-2.5 rounded-xl"
              aria-label={`Baixar ${c.titulo}`}
            >
              <Download className="w-3.5 h-3.5" />
            </a>
          </div>
        </article>
      ))}

      {aberto && (
        <PdfViewerModal
          url={aberto.url}
          titulo={aberto.titulo}
          nomeArquivo={aberto.arquivo_nome}
          onClose={() => setAberto(null)}
        />
      )}
    </div>
  );
}
