/**
 * Integração com o WhatsApp comercial da GS Elétrica e Manutenção.
 * Funções puras para montar a mensagem pré-preenchida enviada ao Gilmar.
 */
import { formatCurrency, getWhatsAppLink } from "@/lib/formatters";
import { formatDateFriendly, formatTimeSaoPaulo } from "@/lib/date/tz";

/** WhatsApp comercial: (32) 98871-4986 — pode ser sobrescrito por variável de ambiente */
export const WHATSAPP_COMERCIAL =
  (process.env.NEXT_PUBLIC_WHATSAPP_COMERCIAL || "32988714986").replace(/\D/g, "");

export interface ResumoPedidoItem {
  nome: string;
  quantidade: number;
  valorUnitario: number;
}

export interface ResumoPedido {
  id: string;
  numero: string;
  clienteNome: string;
  inicio: string | null;
  itens: ResumoPedidoItem[];
  desconto: number;
  valorTotal: number;
  observacao: string | null;
  anexosCount: number;
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
  linhas.push("Olá, Gilmar! Acabei de enviar uma solicitação pelo app da GS Elétrica e Manutenção.");
  linhas.push("");
  linhas.push(`*Cliente:* ${resumo.clienteNome}`);
  linhas.push(`*Pedido:* ${resumo.numero}`);

  if (resumo.inicio) {
    linhas.push(
      `*Data sugerida:* ${formatDateFriendly(resumo.inicio)}, às ${formatTimeSaoPaulo(resumo.inicio)}`
    );
  }

  if (resumo.itens.length > 0) {
    linhas.push("");
    linhas.push("*Serviços solicitados:*");
    for (const item of resumo.itens) {
      const subtotal = item.quantidade * item.valorUnitario;
      linhas.push(
        `• ${item.quantidade}x ${item.nome} — ${formatCurrency(item.valorUnitario)}` +
          (item.quantidade > 1 ? ` (subtotal ${formatCurrency(subtotal)})` : "")
      );
    }
  }

  if (resumo.desconto > 0) {
    linhas.push(`*Desconto:* ${formatCurrency(resumo.desconto)}`);
  }
  linhas.push(`*Valor de referência:* ${formatCurrency(resumo.valorTotal)}`);

  linhas.push("");
  linhas.push(
    resumo.anexosCount > 0
      ? `📷 *Imagens anexadas:* ${resumo.anexosCount} foto(s) no pedido.`
      : "📷 Nenhuma imagem anexada."
  );

  if (resumo.observacao?.trim()) {
    linhas.push("");
    linhas.push(`*Observações:* ${resumo.observacao.trim()}`);
  }

  if (linkPedido) {
    linhas.push("");
    linhas.push(`🔗 Ver pedido no app: ${linkPedido}`);
  }

  return linhas.join("\n");
}

export function linkWhatsAppPedido(resumo: ResumoPedido, linkPedido?: string | null): string {
  return getWhatsAppLink(WHATSAPP_COMERCIAL, montarMensagemPedido(resumo, linkPedido));
}
