"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode as QrIcon } from "lucide-react";
import { toast } from "sonner";
import { IconPix } from "@/components/icons/barber-icons";
import { generatePixCode } from "@/lib/pix/pix-generator";
import {
  PixTipoChave,
  formatarChavePix,
  inferirTipoChavePix,
  normalizarChavePix,
  rotuloTipoChavePix,
} from "@/lib/pix/chave";
import { formatCurrency } from "@/lib/formatters";

interface PixDisplayProps {
  valor?: number;
  chave?: string;
  /** Tipo da chave; quando ausente é deduzido do formato da chave */
  tipoChave?: PixTipoChave | null;
  nomeRecebedor?: string;
  cidade?: string;
  /** Imagem do QR Code fornecida pelo banco (opcional). Aparece como alternativa ao QR automático. */
  qrImagem?: string | null;
  txid?: string;
  descricao?: string;
}

export function PixDisplay({
  valor,
  chave = "",
  tipoChave,
  nomeRecebedor = "GILMAR SOUZA SALES",
  cidade = "Visconde do Rio Branco",
  qrImagem,
  txid = "***",
  descricao,
}: PixDisplayProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiado, setCopiado] = useState<"chave" | "codigo" | null>(null);
  const [aba, setAba] = useState<"automatico" | "banco">("automatico");

  const tipo = tipoChave || inferirTipoChavePix(chave);
  const chaveNoCodigo = normalizarChavePix(tipo, chave);
  const chaveExibida = formatarChavePix(tipo, chave);
  const temValor = valor !== undefined && valor > 0;
  const temQrBanco = Boolean(qrImagem);
  const mostrandoBanco = temQrBanco && aba === "banco";

  const pixCode = generatePixCode({
    chave: chaveNoCodigo,
    nomeRecebedor,
    cidade,
    valor,
    txid,
  });

  useEffect(() => {
    let ativo = true;
    QRCode.toDataURL(pixCode, {
      width: 280,
      margin: 1.5,
      color: {
        dark: "#0E0D0B",
        light: "#FFFFFF",
      },
    })
      .then((url) => {
        if (ativo) setQrCodeDataUrl(url);
      })
      .catch((err) => console.error("Erro ao gerar QR Code Pix:", err));
    return () => {
      ativo = false;
    };
  }, [pixCode]);

  const copiar = async (texto: string, qual: "chave" | "codigo") => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(qual);
      toast.success(qual === "chave" ? "Chave Pix copiada!" : "Código Pix Copia e Cola copiado!");
      setTimeout(() => setCopiado(null), 2500);
    } catch {
      toast.error("Não foi possível copiar. Selecione e copie manualmente.");
    }
  };

  return (
    <div className="bg-surface-1 border border-border-subtle rounded-2xl p-5 md:p-6 space-y-5 text-center">
      <div className="flex items-center justify-center gap-2 text-gold">
        <IconPix size={26} />
        <h3 className="font-heading text-lg text-text-main font-semibold">
          Pagamento via Pix
        </h3>
      </div>

      {descricao && (
        <p className="text-xs text-text-muted">{descricao}</p>
      )}

      {temValor && (
        <div className="bg-surface-2/60 border border-border-gold/30 rounded-xl py-3 px-4 inline-block">
          <span className="text-xs text-text-muted block">Valor exato</span>
          <span className="text-2xl font-bold font-heading text-gold">
            {formatCurrency(valor!)}
          </span>
        </div>
      )}

      {/* Escolha entre o QR automático (com valor) e o QR enviado pelo banco */}
      {temQrBanco && (
        <div className="grid grid-cols-2 gap-1.5 bg-surface-2/60 border border-border-subtle rounded-xl p-1 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setAba("automatico")}
            aria-pressed={aba === "automatico"}
            className={`py-2 px-2 rounded-lg transition-colors ${
              aba === "automatico" ? "bg-gold text-bg-base" : "text-text-muted hover:text-text-main"
            }`}
          >
            {temValor ? "QR Code com o valor" : "QR Code automático"}
          </button>
          <button
            type="button"
            onClick={() => setAba("banco")}
            aria-pressed={aba === "banco"}
            className={`py-2 px-2 rounded-lg transition-colors ${
              aba === "banco" ? "bg-gold text-bg-base" : "text-text-muted hover:text-text-main"
            }`}
          >
            QR Code do banco
          </button>
        </div>
      )}

      {/* QR Code com borda e contraste */}
      <div className="flex flex-col items-center justify-center">
        <div className="p-3 bg-white rounded-xl shadow-md border-2 border-gold/40 inline-block">
          {mostrandoBanco ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrImagem!}
              alt="QR Code Pix do banco"
              className="w-48 h-48 md:w-56 md:h-56 mx-auto object-contain rounded-lg"
            />
          ) : qrCodeDataUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={qrCodeDataUrl}
              alt="QR Code Pix para Pagamento"
              className="w-48 h-48 md:w-56 md:h-56 mx-auto object-contain rounded-lg"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-text-muted">
              <QrIcon className="w-8 h-8 animate-pulse text-gold" />
            </div>
          )}
        </div>
        <span className="text-[11px] text-text-muted mt-2 max-w-xs">
          {mostrandoBanco
            ? temValor
              ? `Aponte a câmera do app do seu banco e digite o valor de ${formatCurrency(valor!)}.`
              : "Abra o app do seu banco e aponte a câmera para o QR Code."
            : temValor
            ? "Abra o app do seu banco e aponte a câmera: o valor já vem preenchido."
            : "Abra o app do seu banco e aponte a câmera para o QR Code."}
        </span>
      </div>

      {/* Detalhes do Recebedor */}
      <div className="text-xs text-text-muted bg-surface-2/40 p-3 rounded-xl border border-border-subtle text-left space-y-1">
        <div className="flex justify-between gap-3">
          <span>Recebedor:</span>
          <span className="font-semibold text-text-main text-right">{nomeRecebedor}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Chave Pix ({rotuloTipoChavePix(tipo)}):</span>
          <span className="font-semibold text-text-main text-right break-all">{chaveExibida}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span>Cidade:</span>
          <span className="text-text-main text-right">{cidade}</span>
        </div>
      </div>

      {/* Botões de cópia */}
      <div className="pt-1 space-y-2">
        <button
          type="button"
          onClick={() => copiar(pixCode, "codigo")}
          className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold-hover text-bg-base font-bold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] shadow-md text-sm"
        >
          {copiado === "codigo" ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copiado === "codigo" ? "Código copiado!" : "Copiar Pix Copia e Cola"}</span>
        </button>
        <button
          type="button"
          onClick={() => copiar(chaveNoCodigo, "chave")}
          className="w-full flex items-center justify-center gap-2 bg-surface-2 hover:bg-surface-3 text-text-main border border-border-subtle font-semibold py-3 px-4 rounded-xl transition-all active:scale-[0.98] text-sm"
        >
          {copiado === "chave" ? <Check className="w-4 h-4 text-gold" /> : <Copy className="w-4 h-4 text-gold" />}
          <span className="break-all">
            {copiado === "chave" ? "Chave copiada!" : `Copiar chave ${rotuloTipoChavePix(tipo)}: ${chaveExibida}`}
          </span>
        </button>
      </div>
    </div>
  );
}
