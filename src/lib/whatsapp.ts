/**
 * Integração com o WhatsApp comercial da GS Elétrica e Manutenção.
 * Funções puras para montar a mensagem pré-preenchida enviada ao Gilmar.
 * Sem emojis ou símbolos especiais que possam gerar caracteres inválidos no WhatsApp.
 */
import { formatCurrency, getWhatsAppLink } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo } from "@/lib/date/tz";

/** WhatsApp comercial: +55 32 8871-4986 — pode ser sobrescrito por variável de ambiente */
export const WHATSAPP_COMERCIAL =
  (process.env.NEXT_PUBLIC_WHATSAPP_COMERCIAL || "553288714986").replace(/\D/g, "");

export const WHATSAPP_GILMAR_DISPLAY = "+55 32 8871-4986";

export interface ResumoPedidoItem {
  nome: string;
  quantidade: number;
  valorUnitario: number;
  identificacao?: string;
  escopo?: string;
  temFoto?: boolean;
}

export interface ResumoPedido {
  id: string;
  numero: string;
  clienteNome: string;
  clienteLocalidade?: string | null;
  inicio: string | null;
  itens: ResumoPedidoItem[];
  desconto: number;
  valorTotal: number;
  observacao: string | null;
  anexosCount: number;
  subtitulo?: string | null;
  objetivo?: string | null;
  condicoesPagamento?: string | null;
  pdfGerado?: boolean;
}

/** Número curto e legível do pedido, derivado do ID (ex: #3F9A1C2B) */
export function numeroDoPedido(id: string): string {
  const limpo = (id || "").replace(/[^a-zA-Z0-9]/g, "");
  return `#${limpo.slice(-8).toUpperCase() || "PEDIDO"}`;
}

/** Agrupa serviços repetidos somando a quantidade */
export function agruparItens(
  servicos: { nome: string; preco: number }[]
): ResumoPedidoItem[] {
  const mapa = new Map<string, ResumoPedidoItem>();
  for (const s of servicos) {
    const chave = `${s.nome}::${s.preco}`;
    const atual = mapa.get(chave);
    if (atual) {
      atual.quantidade += 1;
    } else {
      mapa.set(chave, { nome: s.nome, quantidade: 1, valorUnitario: Number(s.preco) || 0 });
    }
  }
  return Array.from(mapa.values());
}

export function montarMensagemPedido(resumo: ResumoPedido, linkPedido?: string | null): string {
  const linhas: string[] = [];
  linhas.push("*SOLICITACAO DE ORCAMENTO - GS ELETRICA E MANUTENCAO*");
  linhas.push("Olá, Gilmar! Acabei de gerar minha *Proposta Comercial de Serviços em PDF* pelo sistema.");
  linhas.push("");

  const cliLabel = resumo.clienteLocalidade?.trim()
    ? `${resumo.clienteNome} / ${resumo.clienteLocalidade.trim()}`
    : resumo.clienteNome;

  linhas.push(`*Cliente:* ${cliLabel}`);
  linhas.push(`*Proposta / Pedido:* ${resumo.numero}`);

  if (resumo.inicio) {
    linhas.push(
      `*Data sugerida:* ${formatDateFriendly(resumo.inicio)}, às ${formatTimeSaoPaulo(resumo.inicio)}`
    );
  }

  if (resumo.subtitulo?.trim()) {
    linhas.push(`*Tipo de Serviço:* ${resumo.subtitulo.trim()}`);
  }

  if (resumo.objetivo?.trim()) {
    linhas.push("");
    linhas.push(`*Objetivo da Proposta:*`);
    linhas.push(`${resumo.objetivo.trim()}`);
  }

  if (resumo.itens.length > 0) {
    linhas.push("");
    linhas.push("*Escopo dos Serviços Solicitados:*");
    resumo.itens.forEach((item, idx) => {
      const subtotal = item.quantidade * item.valorUnitario;
      const numStr = String(idx + 1).padStart(2, "0");
      const prefixo = item.identificacao ? `${item.identificacao} - ` : "";
      linhas.push(
        `- *${numStr}.* ${prefixo}${item.quantidade}x ${item.nome} - *${formatCurrency(subtotal)}*`
      );
    });
  }

  if (resumo.desconto > 0) {
    linhas.push(`*Desconto:* ${formatCurrency(resumo.desconto)}`);
  }

  linhas.push("");
  linhas.push(`*Valor Total da Proposta:* ${formatCurrency(resumo.valorTotal)}`);

  if (resumo.condicoesPagamento?.trim()) {
    linhas.push(`*Condições de Pagamento:* ${resumo.condicoesPagamento.trim()}`);
  }

  linhas.push(
    resumo.anexosCount > 0
      ? `*Fotos no Orçamento:* ${resumo.anexosCount} item(ns) com foto`
      : "*Fotos no Orçamento:* SEM FOTO"
  );

  if (resumo.observacao?.trim()) {
    linhas.push("");
    linhas.push(`*Observações:* ${resumo.observacao.trim()}`);
  }

  linhas.push("");
  linhas.push("*Estou encaminhando em anexo o arquivo PDF completo do orçamento gerado.*");

  if (linkPedido) {
    linhas.push(`*Link no sistema:* ${linkPedido}`);
  }

  return linhas.join("\n");
}

export function linkWhatsAppPedido(resumo: ResumoPedido, linkPedido?: string | null): string {
  return getWhatsAppLink(WHATSAPP_COMERCIAL, montarMensagemPedido(resumo, linkPedido));
}
