/**
 * Compressão de fotos no navegador (cliente e admin).
 * Reduz a foto da câmera (vários MB) para um JPEG leve antes de enviar ao servidor,
 * para caber no limite das Server Actions e deixar o PDF rápido de abrir.
 */

export interface ImagemComprimida {
  dataUrl: string;
  blob: Blob;
  largura: number;
  altura: number;
}

interface OpcoesCompressao {
  /** Maior lado da imagem final, em pixels */
  maxDim?: number;
  /** Qualidade inicial do JPEG (0 a 1) */
  qualidade?: number;
  /** Tamanho máximo do arquivo final; a qualidade vai caindo até caber */
  maxBytes?: number;
}

function carregarImagem(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(
        new Error(
          `Não foi possível ler a foto "${file.name}". Use uma imagem JPG ou PNG (no iPhone, tire a foto pela câmera do próprio app ou escolha "Mais compatível" nos ajustes da câmera).`
        )
      );
    };
    img.src = url;
  });
}

function canvasParaBlob(canvas: HTMLCanvasElement, qualidade: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/jpeg", qualidade));
}

function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Falha ao processar a foto."));
    reader.readAsDataURL(blob);
  });
}

/**
 * Redimensiona e converte a foto para JPEG. Nunca devolve o arquivo original:
 * se o navegador não conseguir abrir a imagem, lança um erro com mensagem amigável.
 */
export async function comprimirImagem(file: File, opcoes: OpcoesCompressao = {}): Promise<ImagemComprimida> {
  const { maxDim = 1000, qualidade = 0.78, maxBytes = 300 * 1024 } = opcoes;

  const tipo = (file.type || "").toLowerCase();
  if (tipo && !tipo.startsWith("image/")) {
    throw new Error(`O arquivo "${file.name}" não é uma imagem.`);
  }

  const img = await carregarImagem(file);
  let w = img.naturalWidth || img.width;
  let h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error(`A foto "${file.name}" está vazia ou corrompida.`);

  if (w > maxDim || h > maxDim) {
    if (w >= h) {
      h = Math.round((h * maxDim) / w);
      w = maxDim;
    } else {
      w = Math.round((w * maxDim) / h);
      h = maxDim;
    }
  }

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a foto.");
  // Fundo branco: PNG com transparência não vira preto ao converter para JPEG
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  let q = qualidade;
  let blob = await canvasParaBlob(canvas, q);
  while (blob && blob.size > maxBytes && q > 0.4) {
    q = Math.round((q - 0.1) * 100) / 100;
    blob = await canvasParaBlob(canvas, q);
  }
  if (!blob) throw new Error("Seu navegador não conseguiu processar a foto.");

  return { dataUrl: await blobParaDataUrl(blob), blob, largura: w, altura: h };
}
