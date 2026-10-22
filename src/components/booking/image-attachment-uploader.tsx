"use client";

import React, { useRef, useState, useEffect } from "react";
import {
  UploadCloud,
  Image as ImageIcon,
  X,
  AlertCircle,
  CheckCircle2,
  FileWarning,
  Eye,
} from "lucide-react";
import {
  ANEXO_ACCEPT_INPUT,
  ANEXO_MAX_BYTES,
  ANEXO_MAX_BYTES_ORIGINAL,
  ANEXO_MAX_POR_PEDIDO,
  formatarTamanhoArquivo,
} from "@/lib/anexos/config";

export interface SelectedImage {
  id: string;
  file: File;
  previewUrl: string;
  nome: string;
  tamanhoFormatado: string;
}

interface ImageAttachmentUploaderProps {
  images: SelectedImage[];
  onChange: (images: SelectedImage[]) => void;
  maxFiles?: number;
  disabled?: boolean;
}

export function ImageAttachmentUploader({
  images,
  onChange,
  maxFiles = ANEXO_MAX_POR_PEDIDO,
  disabled = false,
}: ImageAttachmentUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // Limpeza de URLs temporárias criadas para preview ao desmontar
  useEffect(() => {
    return () => {
      images.forEach((img) => {
        try {
          URL.revokeObjectURL(img.previewUrl);
        } catch {
          // ignora
        }
      });
    };
  }, []);

  const handleFiles = (incomingFiles: FileList | File[]) => {
    setErrorMessage(null);
    const filesArray = Array.from(incomingFiles);

    if (images.length + filesArray.length > maxFiles) {
      setErrorMessage(
        `Você pode anexar no máximo ${maxFiles} imagens por solicitação. Você já tem ${images.length} selecionada(s).`
      );
      return;
    }

    const novas: SelectedImage[] = [];

    for (const file of filesArray) {
      // 1. Valida tamanho original antes de processar
      if (file.size > ANEXO_MAX_BYTES_ORIGINAL) {
        setErrorMessage(
          `A foto "${file.name}" é muito pesada (acima de 25 MB). Por favor, tire uma nova foto ou reduza a resolução.`
        );
        return;
      }

      if (file.size > ANEXO_MAX_BYTES) {
        setErrorMessage(
          `A imagem "${file.name}" (${formatarTamanhoArquivo(
            file.size
          )}) excede o tamanho máximo de 5 MB.`
        );
        return;
      }

      // 2. Valida tipo MIME inicial
      const tipo = (file.type || "").toLowerCase();
      const ehImagem =
        tipo.startsWith("image/") ||
        /\.(jpe?g|png|webp|heic|heif)$/i.test(file.name);

      if (!ehImagem) {
        setErrorMessage(
          `O arquivo "${file.name}" não é um formato de imagem suportado (JPG, PNG ou WebP).`
        );
        return;
      }

      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);

      novas.push({
        id,
        file,
        previewUrl,
        nome: file.name,
        tamanhoFormatado: formatarTamanhoArquivo(file.size),
      });
    }

    if (novas.length > 0) {
      onChange([...images, ...novas]);
    }
  };

  const handleRemove = (idToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const item = images.find((img) => img.id === idToRemove);
    if (item) {
      try {
        URL.revokeObjectURL(item.previewUrl);
      } catch {
        // ignora
      }
    }
    onChange(images.filter((img) => img.id !== idToRemove));
    setErrorMessage(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const triggerSelect = () => {
    if (disabled) return;
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-text-main flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-gold" />
          <span>Fotos do local ou serviço (opcional):</span>
        </label>
        <span className="text-[11px] text-text-muted">
          {images.length} de {maxFiles} foto(s)
        </span>
      </div>

      <p className="text-[11px] text-text-muted leading-relaxed">
        Mostre ao Gilmar o quadro de distribuição, fiação, tomadas ou aparelhos que precisam de reparo para agilizar a elaboração do seu orçamento.
      </p>

      {/* ÁREA DE DROP / CLIQUE */}
      {images.length < maxFiles && (
        <div
          onClick={triggerSelect}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all select-none ${
            isDragging
              ? "border-gold bg-gold/10 scale-[1.01]"
              : disabled
              ? "opacity-50 cursor-not-allowed border-border-subtle bg-surface-1"
              : "border-border-gold/30 hover:border-gold/60 bg-surface-1/70 hover:bg-surface-2/60"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={ANEXO_ACCEPT_INPUT}
            multiple
            disabled={disabled}
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) {
                handleFiles(e.target.files);
                e.target.value = "";
              }
            }}
          />

          <div className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-surface-2 border border-border-gold/40 text-gold flex items-center justify-center shadow-md">
              <UploadCloud className="w-6 h-6 stroke-[2]" />
            </div>

            <div>
              <p className="text-xs font-bold text-text-main">
                Clique para tirar foto ou selecionar da galeria
              </p>
              <p className="text-[11px] text-text-muted mt-0.5">
                PNG, JPG ou WebP até 5 MB por imagem (máx. {maxFiles} fotos)
              </p>
            </div>
          </div>
        </div>
      )}

      {/* MENSAGEM DE ERRO */}
      {errorMessage && (
        <div className="flex items-start gap-2 bg-destructive/15 border border-destructive/40 text-destructive text-xs p-3 rounded-xl animate-in fade-in">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="leading-snug">{errorMessage}</p>
        </div>
      )}

      {/* MINIATURAS DAS IMAGENS SELECIONADAS */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-1">
          {images.map((item, idx) => (
            <div
              key={item.id}
              className="group relative bg-surface-2 rounded-2xl border border-border-subtle overflow-hidden shadow-md flex flex-col"
            >
              <div className="relative aspect-video w-full bg-black/40 overflow-hidden flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={item.previewUrl}
                  alt={item.nome}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                />

                {/* Botão de Ampliar */}
                <button
                  type="button"
                  onClick={() => setLightboxUrl(item.previewUrl)}
                  className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white transition-opacity"
                  title="Ampliar imagem"
                >
                  <Eye className="w-5 h-5 drop-shadow" />
                </button>

                {/* Botão de Remover */}
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => handleRemove(item.id, e)}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/70 hover:bg-destructive text-white flex items-center justify-center shadow-lg transition-colors z-10"
                    title="Remover imagem"
                  >
                    <X className="w-4 h-4 stroke-[2.5]" />
                  </button>
                )}

                <span className="absolute bottom-1.5 left-2 bg-black/70 text-[10px] text-white/90 px-1.5 py-0.5 rounded-md font-mono">
                  #{idx + 1}
                </span>
              </div>

              <div className="p-2 text-[11px] flex items-center justify-between gap-1 text-text-muted bg-surface-1">
                <span className="truncate" title={item.nome}>
                  {item.nome}
                </span>
                <span className="shrink-0 text-[10px] text-text-muted/80">
                  {item.tamanhoFormatado}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* LIGHTBOX / MODAL DE AMPLIAÇÃO */}
      {lightboxUrl && (
        <div
          role="dialog"
          onClick={() => setLightboxUrl(null)}
          className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <button
            type="button"
            onClick={() => setLightboxUrl(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-surface-2 hover:bg-surface-3 text-text-main flex items-center justify-center shadow-2xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={lightboxUrl}
            alt="Foto ampliada"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-2xl shadow-2xl border border-border-gold/40"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
