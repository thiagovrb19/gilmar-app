import { formatCurrency } from "@/lib/formatters";
import { PropostaItemDetalhe } from "@/lib/supabase/types";

export interface DadosPropostaPDF {
  numeroPedido?: string;
  clienteNome: string;
  clienteLocalidade?: string | null;
  clienteWhatsapp?: string | null;
  dataProposta?: string; // DD/MM/YYYY
  validadeProposta?: string; // DD/MM/YYYY
  subtitulo?: string | null;
  objetivo?: string | null;
  condicoesPagamento?: string | null;
  observacaoValores?: string | null;
  observacaoCliente?: string | null;
  itens: PropostaItemDetalhe[];
  valorTotal: number;
  desconto?: number;
}

/** Formata data em DD/MM/YYYY */
export function formatarDataBR(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

/** Calcula data de validade (+10 dias por padrão, igual ao modelo do Gilmar) */
export function calcularValidadeBR(baseDate: Date = new Date(), dias: number = 10): string {
  const validade = new Date(baseDate.getTime() + dias * 24 * 60 * 60 * 1000);
  return formatarDataBR(validade);
}

/**
 * Gera o documento HTML completo da Proposta Comercial de Serviços
 * fiel ao modelo do Gilmar Sales (GS Elétrica e Manutenção),
 * com a nova logo inteira no topo, sem imagem ilustrativa, "SEM FOTO" em vermelho
 * quando não houver foto anexada no item, e paginação limpa sem folhas em branco.
 */
export function gerarHTMLPropostaComercial(dados: DadosPropostaPDF, originUrl: string): string {
  const hoje = new Date();
  const dataProposta = dados.dataProposta || formatarDataBR(hoje);
  const validadeProposta = dados.validadeProposta || calcularValidadeBR(hoje, 10);

  const clienteDisplay = dados.clienteLocalidade?.trim()
    ? `${dados.clienteNome.trim()} / ${dados.clienteLocalidade.trim()}`
    : dados.clienteNome.trim() || "Cliente";

  const subtitulo =
    dados.subtitulo?.trim() ||
    "Instalação de comandos elétricos, manutenção e dispositivos de segurança";

  const nomesServicosResumo = dados.itens
    .map((i) => i.servicoNome.toLowerCase())
    .slice(0, 4)
    .join(", ");

  const objetivoPadrao =
    dados.objetivo?.trim() ||
    `Executar instalações e manutenções elétricas nas máquinas/ambientes indicados pelo cliente, contemplando ${
      nomesServicosResumo || "adequações elétricas, comando e proteção"
    }, conforme o escopo individual descrito abaixo.`;

  const metadeValor = (dados.valorTotal || 0) / 2;
  const condicoesPagamento =
    dados.condicoesPagamento?.trim() ||
    `Entrada de ${formatCurrency(metadeValor)} (50%) na aprovação da proposta e saldo de ${formatCurrency(
      (dados.valorTotal || 0) - metadeValor
    )} (50%) após a conclusão dos serviços.`;

  const observacaoValores =
    dados.observacaoValores?.trim() ||
    "Os valores individuais já incluem materiais, componentes e mão de obra necessários à execução dos serviços descritos.";

  // Nova logo oficial gs-logo (inteira, sem cortes)
  const bannerUrl = `${originUrl}/brand/gs-logo.jpg?v=2`;

  const renderCardReferencia = (item: PropostaItemDetalhe, idx: number) => {
    const numFmt = item.numero || String(idx + 1).padStart(2, "0");
    const temFoto = Boolean(item.fotoUrl && item.fotoUrl.trim().length > 0);

    const conteudoFotoHtml = temFoto
      ? `
        <div class="visual-photo-container">
          <img src="${item.fotoUrl}" alt="${item.identificacao}" class="ref-photo" />
        </div>
      `
      : `
        <div class="visual-no-photo-container">
          <span class="sem-foto-text">SEM FOTO</span>
        </div>
      `;

    return `
      <div class="visual-card">
        <div class="visual-card-top">
          <div class="visual-col-title">
            <span class="visual-badge-num">${numFmt}</span>
            <span>${item.identificacao.toUpperCase()}</span>
          </div>
          ${conteudoFotoHtml}
        </div>
        <div class="visual-card-footer">
          <div class="visual-service-info">
            <div><strong>Serviço:</strong> ${item.servicoNome}</div>
            <div><strong>Descrição:</strong> ${item.descricao}</div>
          </div>
          <div class="visual-service-price">
            ${formatCurrency(item.valorTotal)}
          </div>
        </div>
      </div>
    `;
  };

  const escopoRowsHtml = dados.itens
    .map(
      (item, idx) => `
      <tr>
        <td class="scope-num">${item.numero || String(idx + 1).padStart(2, "0")}</td>
        <td class="scope-desc">${item.escopo}</td>
      </tr>
    `
    )
    .join("");

  const investimentoRowsHtml = dados.itens
    .map(
      (item) => `
      <tr>
        <td>${item.identificacao} — ${item.servicoNome}</td>
        <td>${item.quantidade} serviço${item.quantidade > 1 ? "s" : ""}</td>
        <td>${item.quantidade > 1 ? formatCurrency(item.valorUnitario) : "—"}</td>
        <td>${formatCurrency(item.valorTotal)}</td>
      </tr>
    `
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposta Comercial - ${clienteDisplay} - GS Elétrica e Manutenção</title>
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
    .toolbar-title {
      font-size: 14px;
      font-weight: 700;
      color: #fde047;
    }
    .toolbar-actions {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .btn-toolbar {
      border: none;
      cursor: pointer;
      padding: 9px 16px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 700;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .btn-print {
      background: #eab308;
      color: #0c121d;
    }
    .pdf-sheet {
      width: 210mm;
      margin: 14px auto;
      background: #ffffff;
      padding: 10mm 14mm 12mm 14mm;
      box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
    }
    /* Nova Logo GS inteira e sem cortes */
    .banner-header {
      width: 100%;
      background: #05080f;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
      border: 1px solid #1e293b;
      text-align: center;
    }
    .banner-header img {
      width: 100%;
      height: auto;
      max-height: 165px;
      object-fit: contain;
      display: block;
      margin: 0 auto;
    }
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
    .meta-cell {
      padding: 8px 12px;
      border-right: 1px solid #d1d5db;
    }
    .meta-cell:last-child {
      border-right: none;
    }
    .meta-label {
      font-size: 10px;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      margin-bottom: 2px;
    }
    .meta-value {
      font-size: 12px;
      font-weight: 600;
      color: #111827;
    }
    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0e74bc;
      text-transform: uppercase;
      margin-top: 12px;
      margin-bottom: 6px;
      letter-spacing: 0.2px;
    }
    .section-text {
      font-size: 11.3px;
      color: #1f2937;
      line-height: 1.45;
      margin-bottom: 8px;
    }
    .scope-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 12px;
    }
    .scope-table tr {
      border-bottom: 1px solid #e5e7eb;
    }
    .scope-table tr:first-child {
      border-top: 1px solid #e5e7eb;
    }
    .scope-num {
      width: 38px;
      background: #1b80c4;
      color: #ffffff;
      font-weight: 800;
      font-size: 11px;
      text-align: center;
      padding: 6px 4px;
      border-bottom: 1px solid #ffffff;
    }
    .scope-desc {
      padding: 6px 10px;
      font-size: 11.3px;
      color: #1f2937;
      background: #ffffff;
      border-right: 1px solid #e5e7eb;
    }
    /* Cards de Referência Visual (sem foto ilustrativa) */
    .visual-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      margin-bottom: 10px;
      page-break-inside: avoid;
      break-inside: avoid;
      overflow: hidden;
      background: #ffffff;
    }
    .visual-card-top {
      background: #f8fafc;
      padding: 9px 12px;
    }
    .visual-col-title {
      font-size: 11.5px;
      font-weight: 800;
      color: #0e74bc;
      text-transform: uppercase;
      margin-bottom: 7px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .visual-badge-num {
      background: #1b80c4;
      color: #ffffff;
      font-size: 10px;
      font-weight: 800;
      padding: 2px 6px;
      border-radius: 3px;
    }
    .visual-photo-container {
      display: flex;
      align-items: center;
      justify-content: flex-start;
      padding: 4px 0;
    }
    .ref-photo {
      max-height: 155px;
      max-width: 100%;
      object-fit: contain;
      border-radius: 3px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
    }
    .visual-no-photo-container {
      padding: 10px 12px;
      background: #fef2f2;
      border: 1px dashed #fca5a5;
      border-radius: 4px;
      display: inline-block;
    }
    .sem-foto-text {
      color: #dc2626;
      font-weight: 800;
      font-size: 12.5px;
      letter-spacing: 0.6px;
      text-transform: uppercase;
    }
    .visual-card-footer {
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      padding: 8px 12px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 14px;
    }
    .visual-service-info {
      font-size: 11px;
      color: #1f2937;
      line-height: 1.4;
    }
    .visual-service-price {
      font-size: 14.5px;
      font-weight: 800;
      color: #0e74bc;
      white-space: nowrap;
    }
    /* Seção Final de Investimento, Condições e Assinaturas */
    .investment-section {
      page-break-before: always;
      break-before: page;
    }
    .inv-table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 8px;
      margin-bottom: 16px;
    }
    .inv-table th {
      background: #1b80c4;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      text-align: left;
      padding: 8px 10px;
      border: 1px solid #1b80c4;
    }
    .inv-table td {
      padding: 8px 10px;
      font-size: 11.3px;
      color: #1f2937;
      border-bottom: 1px solid #e5e7eb;
      border-left: 1px solid #f3f4f6;
      border-right: 1px solid #f3f4f6;
    }
    .inv-table tr:nth-child(even) td {
      background: #f9fafb;
    }
    .inv-total-row td {
      background: #e6f3fb !important;
      border-top: 2px solid #1b80c4 !important;
      border-bottom: 1px solid #bfdbfe !important;
      font-weight: 800;
      font-size: 12px;
      color: #111827;
      padding: 9px 10px;
    }
    /* Bloco de Assinaturas */
    .signatures-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
      margin-top: 42px;
      padding-top: 10px;
      text-align: center;
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .sig-line {
      border-top: 1px solid #374151;
      width: 88%;
      margin: 0 auto 8px auto;
    }
    .sig-client-name {
      font-size: 11.5px;
      font-weight: 700;
      color: #374151;
      text-transform: uppercase;
      margin-bottom: 10px;
    }
    .sig-client-date {
      font-size: 12.5px;
      color: #111827;
    }
    .sig-provider-name {
      font-size: 11.5px;
      font-weight: 800;
      color: #111827;
      text-transform: uppercase;
      margin-bottom: 4px;
    }
    .sig-provider-meta {
      font-size: 10.5px;
      color: #374151;
      line-height: 1.45;
    }
    /* Rodapé de Página */
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
      @page {
        size: A4 portrait;
        margin: 10mm 12mm;
      }
      body {
        background: #ffffff !important;
      }
      .toolbar-no-print {
        display: none !important;
      }
      .pdf-sheet {
        width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
      }
      .investment-section {
        page-break-before: always;
        break-before: page;
        padding-top: 2mm;
      }
    }
  </style>
</head>
<body>
  <!-- BARRA SUPERIOR INTERATIVA (Não sai na impressão/PDF) -->
  <div class="toolbar-no-print">
    <div>
      <div class="toolbar-title">Proposta Comercial de Serviços — GS Elétrica e Manutenção</div>
      <div style="font-size: 11px; color: #cbd5e1;">
        Clique em "Salvar / Baixar em PDF" (escolha "Salvar como PDF") e encaminhe para o WhatsApp do Gilmar (+55 32 8871-4986).
      </div>
    </div>
    <div class="toolbar-actions">
      <button type="button" class="btn-toolbar btn-print" onclick="window.print()">
        Salvar / Baixar em PDF
      </button>
    </div>
  </div>

  <div class="pdf-sheet">
    <!-- ===================================================================== -->
    <!-- PARTE 1: LOGO, CABEÇALHO, OBJETIVO, ESCOPO E DETALHAMENTO DOS ITENS -->
    <!-- ===================================================================== -->
    <div>
      <div class="banner-header">
        <img src="${bannerUrl}" alt="GS Elétrica e Manutenção Industrial e Residencial - Gilmar Sales" />
      </div>

      <h1 class="main-title">PROPOSTA COMERCIAL DE SERVIÇOS</h1>
      <div class="main-subtitle">${subtitulo}</div>

      <div class="meta-box">
        <div class="meta-cell">
          <div class="meta-label">CLIENTE</div>
          <div class="meta-value">${clienteDisplay}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-label">DATA DA PROPOSTA</div>
          <div class="meta-value">${dataProposta}</div>
        </div>
        <div class="meta-cell">
          <div class="meta-label">VALIDADE</div>
          <div class="meta-value">${validadeProposta}</div>
        </div>
      </div>

      <h2 class="section-title">OBJETIVO DA PROPOSTA</h2>
      <p class="section-text">${objetivoPadrao}</p>

      <h2 class="section-title">ESCOPO DOS SERVIÇOS</h2>
      <table class="scope-table">
        <tbody>
          ${escopoRowsHtml}
        </tbody>
      </table>

      <h2 class="section-title">DETALHAMENTO E REGISTRO FOTOGRÁFICO DOS ITENS</h2>
      <div class="cards-stack">
        ${dados.itens.map((item, idx) => renderCardReferencia(item, idx)).join("")}
      </div>

      <div class="page-footer">
        <span>GILMAR SALES — ELÉTRICA E MANUTENÇÃO</span>
        <span>Proposta Comercial</span>
      </div>
    </div>

    <!-- ===================================================================== -->
    <!-- PARTE 2: INVESTIMENTO, CONDIÇÕES E ACEITE COM ASSINATURAS -->
    <!-- ===================================================================== -->
    <div class="investment-section">
      <h1 class="main-title" style="margin-top: 4px;">INVESTIMENTO, CONDIÇÕES E ACEITE</h1>
      <div class="main-subtitle" style="margin-bottom: 14px;">Cliente: ${clienteDisplay}</div>

      <table class="inv-table">
        <thead>
          <tr>
            <th style="width: 52%;">ITEM</th>
            <th style="width: 16%;">QTD.</th>
            <th style="width: 16%;">VALOR UNITÁRIO</th>
            <th style="width: 16%;">VALOR TOTAL</th>
          </tr>
        </thead>
        <tbody>
          ${investimentoRowsHtml}
          <tr class="inv-total-row">
            <td colspan="3">VALOR TOTAL DA PROPOSTA</td>
            <td>${formatCurrency(dados.valorTotal)}</td>
          </tr>
        </tbody>
      </table>

      <h2 class="section-title">CONDIÇÕES DE PAGAMENTO</h2>
      <p class="section-text">${condicoesPagamento}</p>

      <h2 class="section-title">OBSERVAÇÃO SOBRE OS VALORES</h2>
      <p class="section-text">${observacaoValores}</p>

      <h2 class="section-title">GARANTIA E RESPONSÁVEL</h2>
      <p class="section-text">
        Garantia de 60 dias sobre os serviços executados, observadas as condições normais de uso. Gilmar Sales — Elétrica e Manutenção &bull; WhatsApp: (32) 98871-4986 &bull; Atendimento em Visconde do Rio Branco - MG e região.
      </p>

      <h2 class="section-title">ACEITE DA PROPOSTA</h2>
      <p class="section-text">
        Ao assinar abaixo, as partes declaram estar de acordo com o escopo, valores e condições descritos nesta proposta.
      </p>

      <div class="signatures-grid">
        <div>
          <div class="sig-line"></div>
          <div class="sig-client-name">${clienteDisplay} — Cliente</div>
          <div class="sig-client-date">Data: ____/____/________</div>
        </div>

        <div>
          <div class="sig-line"></div>
          <div class="sig-provider-name">GILMAR SALES &middot; Prestador</div>
          <div class="sig-provider-meta">
            <div>CPF: 112.579.506-90</div>
            <div>Tel.: (32) 98871-4986</div>
            <div style="margin-top: 4px; font-size: 12.5px; color: #111827;">Data: ____/____/________</div>
          </div>
        </div>
      </div>

      <div class="page-footer">
        <span>GILMAR SALES — ELÉTRICA E MANUTENÇÃO</span>
        <span>Investimento e Aceite</span>
      </div>
    </div>
  </div>

  <script>
    window.addEventListener("load", function () {
      var imgs = Array.prototype.slice.call(document.images || []);
      var pending = imgs.filter(function (img) { return !img.complete; });
      if (pending.length === 0) {
        setTimeout(function () {
          window.focus();
          window.print();
        }, 250);
        return;
      }
      var loadedCount = 0;
      var done = function () {
        loadedCount++;
        if (loadedCount >= pending.length) {
          setTimeout(function () {
            window.focus();
            window.print();
          }, 250);
        }
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
 * Abre a janela da Proposta Comercial e aciona a geração/impressão em PDF
 */
export function abrirPropostaPDF(dados: DadosPropostaPDF): boolean {
  if (typeof window === "undefined") return false;
  const origin = window.location.origin;
  const html = gerarHTMLPropostaComercial(dados, origin);

  const printWin = window.open("", "_blank");
  if (!printWin) {
    return false;
  }

  printWin.document.open();
  printWin.document.write(html);
  printWin.document.close();
  return true;
}
