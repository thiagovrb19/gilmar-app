"use client";

import React, { useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode as QrIcon } from "lucide-react";
import { toast } from "sonner";
import { IconPix } from "@/components/icons/barber-icons";
import { generatePixCode } from "@/lib/pix/pix-generator";
import { formatCurrency } from "@/lib/formatters";

interface PixDisplayProps {
  valor?: number;
  chave?: string;
  nomeRecebedor?: string;
  cidade?: string;
  txid?: string;
  descricao?: string;
}

export function PixDisplay({
  valor,
  chave = "+5532999311712",
  nomeRecebedor = "LUIZ FERNANDO GOUVEIA",
  cidade = "Visconde do Rio Branco",
  txid = "***",
  descricao,
}: PixDisplayProps) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>("");
  const [copiedKey, setCopiedKey] = useState(false);

  const pixCode = generatePixCode({
    chave,
    nomeRecebedor,
    cidade: "VISCONDE DO RIO BRANCO",
    valor,
    txid,
  });

  useEffect(() => {
    QRCode.toDataURL(pixCode, {
      width: 280,
      margin: 1.5,
      color: {
        dark: "#0E0D0B",
        light: "#FFFFFF",
      },
    })
      .then((url) => setQrCodeDataUrl(url))
      .catch((err) => console.error("Erro ao gerar QR Code Pix:", err));
  }, [pixCode]);

  const handleCopyKey = async () => {
    try {
      await navigator.clipboard.writeText(chave);
      setCopiedKey(true);
      toast.success("Chave Pix copiada com sucesso!");
      setTimeout(() => setCopiedKey(false), 2500);
    } catch {
      toast.error("Não foi possível copiar a chave.");
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

      {valor !== undefined && valor > 0 && (
        <div className="bg-surface-2/60 border border-border-gold/30 rounded-xl py-3 px-4 inline-block">
          <span className="text-xs text-text-muted block">Valor exato</span>
          <span className="text-2xl font-bold font-heading text-gold">
            {formatCurrency(valor)}
          </span>
        </div>
      )}

      {/* QR Code com borda e contraste */}
      <div className="flex flex-col items-center justify-center">
        <div className="p-3 bg-white rounded-xl shadow-md border-2 border-gold/40 inline-block">
          {qrCodeDataUrl ? (
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
        <span className="text-[11px] text-text-muted mt-2">
          Abra o app do seu banco e aponte a câmera para o QR Code
        </span>
      </div>

      {/* Detalhes do Recebedor */}
      <div className="text-xs text-text-muted bg-surface-2/40 p-3 rounded-xl border border-border-subtle text-left space-y-1">
        <div className="flex justify-between">
          <span>Recebedor:</span>
          <span className="font-semibold text-text-main">{nomeRecebedor}</span>
        </div>
        <div className="flex justify-between">
          <span>Chave (Celular):</span>
          <span className="font-semibold text-text-main">(32) 99931-1712</span>
        </div>
        <div className="flex justify-between">
          <span>Cidade:</span>
          <span className="text-text-main">{cidade}</span>
        </div>
      </div>

      {/* Botão de Copiar Chave Pix */}
      <div className="pt-1">
        <button
          type="button"
          onClick={handleCopyKey}
          className="w-full flex items-center justify-center gap-2 bg-gold hover:bg-gold-hover text-bg-base font-bold py-3.5 px-4 rounded-xl transition-all active:scale-[0.98] shadow-md text-sm"
        >
          {copiedKey ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          <span>{copiedKey ? "Chave copiada!" : "Copiar Chave Pix: (32) 99931-1712"}</span>
        </button>
      </div>
    </div>
  );
}
