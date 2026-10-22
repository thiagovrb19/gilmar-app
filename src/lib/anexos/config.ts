/**
 * Regras compartilhadas (cliente + servidor) para imagens anexadas às solicitações.
 * Funções puras: podem ser importadas tanto em componentes quanto em Server Actions.
 */

/** Nome do bucket PRIVADO no Supabase Storage */
export const ANEXOS_BUCKET = "orcamento-anexos";

/** Tipos aceitos após o processamento (o que realmente é armazenado) */
export const ANEXO_MIME_PERMITIDOS = ["image/jpeg", "image/png", "image/webp"] as const;
export type AnexoMime = (typeof ANEXO_MIME_PERMITIDOS)[number];

/** Tipos que o seletor aceita (HEIC/HEIF do iPhone são convertidos para JPEG no navegador) */
export const ANEXO_ACCEPT_INPUT = "image/jpeg,image/png,image/webp,image/heic,image/heif";

/** Tamanho máximo do arquivo armazenado (5 MB) — o bucket também impõe esse limite */
export const ANEXO_MAX_BYTES = 5 * 1024 * 1024;

/** Tamanho máximo da foto original selecionada, antes da compressão (25 MB) */
export const ANEXO_MAX_BYTES_ORIGINAL = 25 * 1024 * 1024;

/** Quantidade máxima de imagens por solicitação — o banco também impõe esse limite */
export const ANEXO_MAX_POR_PEDIDO = 6;

/** Janela após a criação do pedido em que o cliente ainda pode anexar imagens */
export const ANEXO_JANELA_UPLOAD_MS = 2 * 60 * 60 * 1000;

/** Validade das URLs assinadas para visualização no painel (segundos) */
export const ANEXO_SIGNED_URL_TTL = 60 * 10;

export function isMimePermitido(mime: string): mime is AnexoMime {
  return (ANEXO_MIME_PERMITIDOS as readonly string[]).includes(mime);
}

export function extensaoDoMime(mime: AnexoMime): string {
  switch (mime) {
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

/**
 * Detecta o tipo real do arquivo pela assinatura binária ("magic bytes"),
 * sem confiar na extensão nem no Content-Type informado pelo navegador.
 */
export function detectarMimePorAssinatura(bytes: Uint8Array): AnexoMime | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46 && // F
    bytes[8] === 0x57 && // W
    bytes[9] === 0x45 && // E
    bytes[10] === 0x42 && // B
    bytes[11] === 0x50 // P
  ) {
    return "image/webp";
  }
  return null;
}

/** Remove caminhos e caracteres problemáticos do nome original do arquivo */
export function sanitizarNomeArquivo(nome: string): string {
  const base = (nome || "imagem").split(/[\\/]/).pop() || "imagem";
  const limpo = base.replace(/[^a-zA-Z0-9\u00C0-\u00FF._ -]/g, "_").trim();
  return (limpo || "imagem").slice(0, 120);
}

export function formatarTamanhoArquivo(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
