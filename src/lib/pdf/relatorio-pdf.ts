import { esc, fotoSegura, formatarDataBR } from "@/lib/pdf/proposta-pdf";
import { RelatorioFotoTipo } from "@/lib/supabase/types";

export interface FotoRelatorioPDF {
  tipo: RelatorioFotoTipo;
  legenda?: string | null;
  url: string;
}

export interface DadosRelatorioPDF {
  clienteNome: string;
  clienteLocalidade?: string | null;
  /** YYYY-MM-DD */
  dataServico?: string | null;
  /** Ex.: "#A1B2C3" — número do orçamento de origem, quando houver */
  referencia?: string | null;
  titulo?: string | null;
  descricao?: string | null;
  observacoes?: string | null;
  fotos: FotoRelatorioPDF[];
}

function dataBR(iso?: string | null): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : formatarDataBR(new Date());
}

/** Texto digitado -> HTML seguro, preservando as quebras de linha */
function paragrafo(v?: string | null): string {
  return esc((v || "").trim()).replace(/\r?\n/g, "<br />");
}

function celulaFoto(foto: { tipo: RelatorioFotoTipo; legenda: string; url: string } | undefined, n: number): string {
  if (!foto) return `<div class="foto-cell foto-vazia"></div>`;
  const rotulo = foto.tipo === "antes" ? "ANTES" : "DEPOIS";
  return `
    <div class="foto-cell">
      <div class="foto-tag foto-tag-${foto.tipo}">${rotulo}${n > 0 ? ` ${String(n).padStart(2, "0")}` : ""}</div>
      <div class="foto-frame"><img src="${foto.url}" alt="${rotulo}" /></div>
      ${foto.legenda ? `<div class="foto-legenda">${foto.legenda}</div>` : ""}
    </div>`;
}

/**
 * Gera o HTML do Relatório de Serviço Executado no mesmo padrão visual
 * da Proposta Comercial (logo GS no topo, títulos azuis, rodapé e assinatura).
 */
export function gerarHTMLRelatorioServico(dados: DadosRelatorioPDF, originUrl: string): string {
  const clienteNome = esc(dados.clienteNome.trim() || "Cliente");
  const localidade = esc((dados.clienteLocalidade || "").trim());
  const clienteDisplay = localidade ? `${clienteNome} / ${localidade}` : clienteNome;
  const titulo = esc((dados.titulo || "").trim());
  const referencia = esc((dados.referencia || "").trim());
  const dataServico = dataBR(dados.dataServico);
  const bannerUrl = `${originUrl}/brand/gs-logo.jpg?v=2`;

  // Só entram fotos com endereço seguro (data:image ou https)
  const fotos = (dados.fotos || [])
    .map((f) => ({ tipo: f.tipo, legenda: esc((f.legenda || "").trim()), url: fotoSegura(f.url) }))
    .filter((f): f is { tipo: RelatorioFotoTipo; legenda: string; url: string } => Boolean(f.url));
  const antes = fotos.filter((f) => f.tipo === "antes");
  const depois = fotos.filter((f) => f.tipo === "depois");

  let fotosHtml = "";
  if (antes.length > 0 && depois.length > 0) {
    // Comparativo lado a lado: a 1ª foto de "antes" ao lado da 1ª de "depois", e assim por diante
    const linhas = Math.max(antes.length, depois.length);
    const numerar = linhas > 1;
    for (let i = 0; i < linhas; i++) {
      fotosHtml += `
        <div class="foto-row">
          ${celulaFoto(antes[i], numerar ? i + 1 : 0)}
          ${celulaFoto(depois[i], numerar ? i + 1 : 0)}
        </div>`;
    }
  } else {
    const unicas = antes.length > 0 ? antes : depois;
    for (let i = 0; i < unicas.length; i += 2) {
      fotosHtml += `
        <div class="foto-row">
          ${celulaFoto(unicas[i], unicas.length > 1 ? i + 1 : 0)}
          ${celulaFoto(unicas[i + 1], i + 2)}
        </div>`;
    }
  }

  const tituloFotos =
    antes.length > 0 && depois.length > 0
      ? "REGISTRO FOTOGRÁFICO — ANTES E DEPOIS"
      : "REGISTRO FOTOGRÁFICO DO SERVIÇO";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Relatório de Serviço - ${clienteDisplay} - GS Elétrica e Manutenção</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: Arial, Helvetica, "Segoe UI", sans-serif;
      color: #1f2937;
      background: #e5e7eb;
      line-height: 1.4;
    }
    .toolbar-no-print {
      position: sticky;
      top: 0;
      z-index: 100;
      background: #0c121d;
      color: #ffffff;
      padding: 12px 20px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      border-bottom: 2px solid #eab308;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }
    .toolbar-title { font-size: 14px; font-weight: 700; color: #fde047; }
    .btn-toolbar {
      border: none;
      cursor: pointer;
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      background: #eab308;
      color: #0c121d;
      white-space: nowrap;
    }
    .pdf-sheet {
      width: 210mm;
      max-width: 100%;
      margin: 14px auto;
      background: #ffffff;
      padding: 10mm 14mm 12mm 14mm;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
    }
    .banner-header {
      width: 100%;
      border-radius: 6px;
      overflow: hidden;
      margin-bottom: 14px;
      border: 1.5px solid #0e74bc;
      line-height: 0;
    }
    .banner-header img { width: 100%; height: auto; display: block; }
    .main-title {
      text-align: center;
      font-size: 20px;
      font-weight: 800;
      color: #1f2937;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      margin-top: 2px;
    }
    .main-subtitle {
      text-align: center;
      font-size: 11.5px;
      color: #6b7280;
      margin-top: 3px;
      margin-bottom: 12px;
    }
    .meta-box {
      display: grid;
      grid-template-columns: 1.5fr 1fr 0.9fr;
      background: #f3f4f6;
      border: 1px solid #d1d5db;
      margin-bottom: 14px;
    }
    .meta-cell { padding: 8px 12px; border-right: 1px solid #d1d5db; }
    .meta-cell:last-child { border-right: none; }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-value { font-size: 12px; font-weight: 600; color: #111827; }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0e74bc;
      text-transform: uppercase;
      margin-top: 14px;
      margin-bottom: 6px;
      letter-spacing: 0.2px;
    }
    .section-text {
      font-size: 11.5px;
      color: #1f2937;
      line-height: 1.5;
      margin-bottom: 8px;
    }
    .foto-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .foto-cell {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      overflow: hidden;
      background: #f8fafc;
    }
    .foto-vazia { border: none; background: transparent; }
    .foto-tag {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.6px;
      color: #ffffff;
      padding: 5px 10px;
    }
    .foto-tag-antes { background: #b91c1c; }
    .foto-tag-depois { background: #15803d; }
    .foto-frame {
      height: 82mm;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #f1f5f9;
      padding: 4px;
    }
    .foto-frame img {
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      display: block;
    }
    .foto-legenda {
      font-size: 10.8px;
      color: #1f2937;
      padding: 6px 10px;
      border-top: 1px solid #e2e8f0;
      background: #ffffff;
    }
    .signature {
      margin-top: 34px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-line { border-top: 1px solid #374151; width: 60%; margin: 0 auto 8px auto; }
    .sig-provider-name { font-size: 11.5px; font-weight: 800; color: #111827; text-transform: uppercase; }
    .sig-provider-meta { font-size: 10.5px; color: #374151; line-height: 1.45; margin-top: 3px; }
    .page-footer {
      border-top: 1px solid #d1d5db;
      padding-top: 6px;
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      color: #6b7280;
    }
    @media print {
      @page { size: A4 portrait; margin: 10mm 12mm; }
      body { background: #ffffff !important; }
      .toolbar-no-print { display: none !important; }
      .pdf-sheet {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
    }
  </style>
</head>
<body>
  <!-- BARRA SUPERIOR (não sai na impressão/PDF) -->
  <div class="toolbar-no-print">
    <div>
      <div class="toolbar-title">Relatório de Serviço Executado — GS Elétrica e Manutenção</div>
      <div style="font-size: 11px; color: #cbd5e1;">
        Clique em "Salvar / Baixar em PDF" (escolha "Salvar como PDF") e envie o arquivo para o cliente pelo WhatsApp.
      </div>
    </div>
    <button type="button" class="btn-toolbar" onclick="window.print()">Salvar / Baixar em PDF</button>
  </div>

  <div class="pdf-sheet">
    <div class="banner-header">
      <img src="${bannerUrl}" alt="GS Elétrica e Manutenção Industrial e Residencial - Gilmar Sales" />
    </div>

    <h1 class="main-title">RELATÓRIO DE SERVIÇO EXECUTADO</h1>
    <div class="main-subtitle">${titulo || "Registro do serviço realizado, com fotos de antes e depois"}</div>

    <div class="meta-box">
      <div class="meta-cell">
        <div class="meta-label">CLIENTE</div>
        <div class="meta-value">${clienteDisplay}</div>
      </div>
      <div class="meta-cell">
        <div class="meta-label">DATA DO SERVIÇO</div>
        <div class="meta-value">${dataServico}</div>
      </div>
      <div class="meta-cell">
        <div class="meta-label">${referencia ? "ORÇAMENTO" : "RESPONSÁVEL"}</div>
        <div class="meta-value">${referencia || "Gilmar Sales"}</div>
      </div>
    </div>

    ${
      dados.descricao?.trim()
        ? `<h2 class="section-title">SERVIÇO EXECUTADO</h2>
    <p class="section-text">${paragrafo(dados.descricao)}</p>`
        : ""
    }

    ${
      fotosHtml
        ? `<h2 class="section-title">${tituloFotos}</h2>
    ${fotosHtml}`
        : ""
    }

    ${
      dados.observacoes?.trim()
        ? `<h2 class="section-title">OBSERVAÇÕES E RECOMENDAÇÕES</h2>
    <p class="section-text">${paragrafo(dados.observacoes)}</p>`
        : ""
    }

    <h2 class="section-title">GARANTIA E RESPONSÁVEL</h2>
    <p class="section-text">
      Garantia de 60 dias sobre os serviços executados, observadas as condições normais de uso. Gilmar Sales — Elétrica e Manutenção &bull; WhatsApp: (32) 98871-4986 &bull; Atendimento em Visconde do Rio Branco - MG e região.
    </p>

    <div class="signature">
      <div class="sig-line"></div>
      <div class="sig-provider-name">GILMAR SALES &middot; Responsável pelo serviço</div>
      <div class="sig-provider-meta">
        <div>CPF: 112.579.506-90 &bull; Tel.: (32) 98871-4986</div>
      </div>
    </div>

    <div class="page-footer">
      <span>GILMAR SALES — ELÉTRICA E MANUTENÇÃO</span>
      <span>Relatório de Serviço Executado</span>
    </div>
  </div>

  <script>
    window.addEventListener("load", function () {
      var imgs = Array.prototype.slice.call(document.images || []);
      var pending = imgs.filter(function (img) { return !img.complete; });
      var imprimir = function () {
        setTimeout(function () { window.focus(); window.print(); }, 300);
      };
      if (pending.length === 0) { imprimir(); return; }
      var loaded = 0;
      var done = function () {
        loaded++;
        if (loaded >= pending.length) imprimir();
      };
      pending.forEach(function (img) {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      });
    });
  </script>
</body>
</html>`;
}

/**
 * Abre a janela do relatório IMEDIATAMENTE (ainda dentro do clique do usuário, para o
 * navegador não bloquear o pop-up) com um aviso de carregamento. Depois de salvar e
 * enviar as fotos, chame `escreverRelatorioNaJanela` para preencher o documento.
 */
export function abrirJanelaRelatorio(): Window | null {
  if (typeof window === "undefined") return null;
  const win = window.open("", "_blank");
  if (!win) return null;
  win.document.open();
  win.document.write(
    `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8" /><title>Gerando relatório...</title></head>` +
      `<body style="font-family: Arial, sans-serif; background: #0c121d; color: #fde047; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">` +
      `<p style="font-size: 16px; font-weight: 700;">Salvando as fotos e gerando o relatório...</p></body></html>`
  );
  win.document.close();
  return win;
}

export function escreverRelatorioNaJanela(win: Window, dados: DadosRelatorioPDF): void {
  const html = gerarHTMLRelatorioServico(dados, window.location.origin);
  win.document.open();
  win.document.write(html);
  win.document.close();
}
