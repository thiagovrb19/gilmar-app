"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, X, Download, ArrowRight } from "lucide-react";

const IMAGEM = "/brand/seguranca-info-gs.jpg";

/** Card "Segurança": ao tocar, abre a imagem informativa (NR-12 / NR-10) em tela cheia */
export function SegurancaInfoCard() {
  const [aberto, setAberto] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [aberto]);

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="electric-glass rounded-2xl p-4 text-center space-y-2 transition-transform hover:-translate-y-1 active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold w-full"
        aria-haspopup="dialog"
      >
        <div className="w-10 h-10 mx-auto rounded-xl bg-purple-500/15 text-purple-400 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <h3 className="font-heading font-bold text-sm text-text-main">Segurança</h3>
        <p className="text-[11px] text-text-muted">Padrão CEMIG e quadros de disjuntores</p>
      </button>

      {aberto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Informativo de segurança NR-12 e NR-10"
          className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-sm flex items-start sm:items-center justify-center p-3 overflow-y-auto"
          onClick={() => setAberto(false)}
        >
          <div className="relative w-full max-w-lg my-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-2 mb-2">
              <a
                href={IMAGEM}
                download="seguranca-info-gs.jpg"
                className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs font-semibold px-3 py-2 rounded-xl"
              >
                <Download className="w-3.5 h-3.5" /> Baixar imagem
              </a>
              <button
                type="button"
                onClick={() => setAberto(false)}
                className="inline-flex items-center gap-1.5 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle text-xs font-semibold px-3 py-2 rounded-xl"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" /> Fechar
              </button>
            </div>

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={IMAGEM}
              alt="Fiscalização pode chegar: informativo sobre NR-12 e NR-10 da GS Elétrica e Manutenção"
              className="w-full h-auto rounded-2xl border border-border-gold/40 shadow-2xl"
            />

            <Link
              href="/agendar"
              className="mt-3 w-full inline-flex items-center justify-center gap-2 metallic-gold-btn font-bold text-sm py-3.5 rounded-xl shadow-lg"
            >
              Solicitar orçamento <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
