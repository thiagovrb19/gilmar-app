/**
 * Utilitários de formatação e máscaras para moeda, telefone e datas
 */

const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Formata número para moeda brasileira R$ */
export function formatCurrency(valor: number): string {
  return currencyFormatter.format(valor || 0);
}

/** Formata string de dígitos no padrão (32) 99999-9999 */
export function formatPhone(val: string): string {
  if (!val) return "";
  const digits = val.replace(/\D/g, "");
  // Se já veio com DDI 55 na frente e tem 12 ou 13 dígitos
  const phone = digits.startsWith("55") && digits.length > 10 ? digits.slice(2) : digits;

  if (phone.length <= 2) {
    return `(${phone}`;
  }
  if (phone.length <= 6) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2)}`;
  }
  if (phone.length <= 10) {
    return `(${phone.slice(0, 2)}) ${phone.slice(2, 6)}-${phone.slice(6)}`;
  }
  return `(${phone.slice(0, 2)}) ${phone.slice(2, 7)}-${phone.slice(7, 11)}`;
}

/** Normaliza telefone para formato apenas dígitos incluindo DDI 55 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("55")) {
    return digits;
  }
  return `55${digits}`;
}

/** Gera o e-mail sintético para autenticação sem custo no Supabase Auth */
export function getSyntheticEmail(rawPhone: string): string {
  const normalized = normalizePhone(rawPhone);
  return `${normalized}@cliente.barbeariadoluiz.app`;
}

/** Gera link do WhatsApp com mensagem pré-preenchida */
export function getWhatsAppLink(phone: string, message: string): string {
  const normalized = normalizePhone(phone);
  const encoded = encodeURIComponent(message);
  return `https://wa.me/${normalized}?text=${encoded}`;
}
