/**
 * Gerador de Pix Estático (BR Code EMV) do Banco Central do Brasil
 * Padrão EMV QRCPS-MPM com CRC16-CCITT
 */

/**
 * Calcula o checksum CRC16-CCITT (polinômio 0x1021, init 0xFFFF)
 */
export function calculateCRC16(payload: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  // Retorna em hexadecimal maiúsculo com 4 dígitos preenchidos com zeros à esquerda
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Formata campo TLV (Tag, Length, Value) */
function formatTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

/** Remove acentos e caracteres especiais para compatibilidade com o padrão EMV */
export function sanitizeEMVString(str: string, maxLength: number): string {
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .substring(0, maxLength)
    .toUpperCase();
}

export interface PixOptions {
  chave: string;
  nomeRecebedor: string;
  cidade: string;
  valor?: number;
  txid?: string;
  infoAdicional?: string;
}

/**
 * Gera a string Pix Copia e Cola completa com checksum CRC16 válido
 */
export function generatePixCode({
  chave,
  nomeRecebedor,
  cidade,
  valor,
  txid = "***",
}: PixOptions): string {
  // 1. Merchant Account Information (Tag 26)
  const gui = formatTLV("00", "br.gov.bcb.pix");
  const key = formatTLV("01", chave.trim());
  const merchantAccountInfo = formatTLV("26", `${gui}${key}`);

  // 2. Additional Data Field Template (Tag 62)
  const sanitizedTxid = sanitizeEMVString(txid || "***", 25) || "***";
  const txidField = formatTLV("05", sanitizedTxid);
  const additionalDataField = formatTLV("62", txidField);

  // 3. Montagem das tags base
  const payloadFormatIndicator = formatTLV("00", "01"); // Versão do Payload
  const merchantCategoryCode = formatTLV("52", "0000"); // 0000 indica geral
  const transactionCurrency = formatTLV("53", "986"); // 986 = BRL
  const countryCode = formatTLV("58", "BR");
  const merchantName = formatTLV("59", sanitizeEMVString(nomeRecebedor, 25));
  const merchantCity = formatTLV("60", sanitizeEMVString(cidade, 15));

  let payload = `${payloadFormatIndicator}${merchantAccountInfo}${merchantCategoryCode}${transactionCurrency}`;

  // Se houver valor definido maior que zero
  if (valor && valor > 0) {
    const formattedAmount = valor.toFixed(2);
    payload += formatTLV("54", formattedAmount);
  }

  payload += `${countryCode}${merchantName}${merchantCity}${additionalDataField}`;

  // 4. Tag 63 (CRC16) sem os dígitos
  const payloadWithoutCRC = `${payload}6304`;

  // 5. Cálculo do CRC16
  const crc = calculateCRC16(payloadWithoutCRC);

  return `${payloadWithoutCRC}${crc}`;
}
