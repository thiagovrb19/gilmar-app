/**
 * Tipos de chave Pix: validação, formatação para exibição e normalização para o BR Code.
 * Funções puras, usadas no navegador e no servidor.
 */

export type PixTipoChave = "cpf" | "cnpj" | "celular" | "email" | "aleatoria";

export const PIX_TIPOS_CHAVE: {
  valor: PixTipoChave;
  rotulo: string;
  exemplo: string;
  dica: string;
}[] = [
  { valor: "cpf", rotulo: "CPF", exemplo: "123.456.789-09", dica: "Digite os 11 números do CPF (com ou sem pontos)." },
  { valor: "cnpj", rotulo: "CNPJ", exemplo: "12.345.678/0001-95", dica: "Digite os 14 números do CNPJ (com ou sem pontos)." },
  { valor: "celular", rotulo: "Celular", exemplo: "(32) 98871-4986", dica: "Digite o celular com DDD. O +55 é colocado automaticamente." },
  { valor: "email", rotulo: "E-mail", exemplo: "nome@exemplo.com", dica: "Digite o e-mail cadastrado como chave no banco." },
  { valor: "aleatoria", rotulo: "Chave aleatória", exemplo: "123e4567-e89b-12d3-a456-426614174000", dica: "Cole a chave aleatória exatamente como aparece no app do banco." },
];

const soDigitos = (v: string) => (v || "").replace(/\D/g, "");

export function rotuloTipoChavePix(tipo: PixTipoChave): string {
  return PIX_TIPOS_CHAVE.find((t) => t.valor === tipo)?.rotulo || "Chave";
}

export function ehTipoChavePix(v: unknown): v is PixTipoChave {
  return PIX_TIPOS_CHAVE.some((t) => t.valor === v);
}

export function cpfValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (base: string) => {
    let soma = 0;
    for (let i = 0; i < base.length; i++) soma += Number(base[i]) * (base.length + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(d.slice(0, 9)) === Number(d[9]) && digito(d.slice(0, 10)) === Number(d[10]);
}

export function cnpjValido(valor: string): boolean {
  const d = soDigitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const digito = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    const soma = base.split("").reduce((acc, n, i) => acc + Number(n) * pesos[i], 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  return digito(d.slice(0, 12)) === Number(d[12]) && digito(d.slice(0, 13)) === Number(d[13]);
}

/** Celular brasileiro sem o código do país: DDD + número (10 ou 11 dígitos) */
function celularNacional(valor: string): string {
  let d = soDigitos(valor);
  if (d.length > 11 && d.startsWith("55")) d = d.slice(2);
  return d;
}

/**
 * Descobre o tipo quando ele não está gravado (bancos que ainda não rodaram a migration 011).
 * 11 dígitos podem ser CPF ou celular: vale o CPF quando os dígitos verificadores conferem.
 */
export function inferirTipoChavePix(chave: string): PixTipoChave {
  const v = (chave || "").trim();
  if (v.includes("@")) return "email";
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)) return "aleatoria";
  if (v.startsWith("+")) return "celular";
  const d = soDigitos(v);
  if (d.length === 14) return "cnpj";
  if (d.length === 11 && cpfValido(d)) return "cpf";
  return "celular";
}

/** Devolve a mensagem de erro, ou null quando a chave é válida para o tipo */
export function validarChavePix(tipo: PixTipoChave, chave: string): string | null {
  const v = (chave || "").trim();
  if (!v) return "Informe a chave Pix.";
  switch (tipo) {
    case "cpf":
      return cpfValido(v) ? null : "CPF inválido. Confira os 11 números da chave.";
    case "cnpj":
      return cnpjValido(v) ? null : "CNPJ inválido. Confira os 14 números da chave.";
    case "celular": {
      const d = celularNacional(v);
      return d.length === 10 || d.length === 11 ? null : "Celular inválido. Digite o número com DDD, por exemplo (32) 98871-4986.";
    }
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) && v.length <= 77 ? null : "E-mail inválido.";
    case "aleatoria":
      return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v)
        ? null
        : "Chave aleatória inválida. Cole a chave completa, com os traços.";
  }
}

/** Valor exato que vai dentro do QR Code / Pix Copia e Cola (formato exigido pelo Banco Central) */
export function normalizarChavePix(tipo: PixTipoChave, chave: string): string {
  const v = (chave || "").trim();
  switch (tipo) {
    case "cpf":
    case "cnpj":
      return soDigitos(v);
    case "celular":
      return `+55${celularNacional(v)}`;
    case "email":
      return v.toLowerCase();
    case "aleatoria":
      return v.toLowerCase();
  }
}

/** Chave formatada para leitura (o que o cliente vê na tela) */
export function formatarChavePix(tipo: PixTipoChave, chave: string): string {
  const v = (chave || "").trim();
  switch (tipo) {
    case "cpf": {
      const d = soDigitos(v);
      return d.length === 11 ? `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}` : v;
    }
    case "cnpj": {
      const d = soDigitos(v);
      return d.length === 14
        ? `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
        : v;
    }
    case "celular": {
      const d = celularNacional(v);
      if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
      if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
      return v;
    }
    default:
      return v;
  }
}

/** Só aceita imagem de QR Code em data URL comum e de tamanho razoável (~300 KB) */
export function qrImagemValida(v: unknown): v is string {
  return (
    typeof v === "string" &&
    v.length <= 420_000 &&
    /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(v)
  );
}
