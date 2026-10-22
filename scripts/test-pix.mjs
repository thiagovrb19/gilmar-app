import { calculateCRC16, generatePixCode } from "../src/lib/pix/pix-generator.ts";

console.log("=== INICIANDO TESTES DO GERADOR PIX (BR CODE EMV) ===");

// 1. Vetor de teste CRC16-CCITT (0xFFFF, 0x1021)
const crcTest = calculateCRC16("123456789");
if (crcTest !== "29B1") {
  console.error(`ERRO: CRC16 esperado 29B1, obtido: ${crcTest}`);
  process.exit(1);
}
console.log("✔ Teste 1: Vetor de teste CRC16 padrão (123456789 -> 29B1) PASSOU!");

// 2. Geração de Pix do Luiz Fernando Gouveia com valor R$ 25,00
const pix25 = generatePixCode({
  chave: "+5532999311712",
  nomeRecebedor: "LUIZ FERNANDO GOUVEIA",
  cidade: "JUIZ DE FORA",
  valor: 25.0,
});

if (!pix25.startsWith("000201")) {
  console.error("ERRO: Prefixo EMV inválido");
  process.exit(1);
}
if (!pix25.includes("br.gov.bcb.pix") || !pix25.includes("+5532999311712")) {
  console.error("ERRO: Chave ou identificador Pix ausente");
  process.exit(1);
}

const body = pix25.slice(0, -4);
const expectedCrc = calculateCRC16(body);
const actualCrc = pix25.slice(-4);

if (expectedCrc !== actualCrc) {
  console.error(`ERRO: CRC calculado (${expectedCrc}) difere do payload (${actualCrc})`);
  process.exit(1);
}

console.log("✔ Teste 2: Geração completa do Pix do Luiz com valor de R$ 25,00 PASSOU!");
console.log(`Payload gerado: ${pix25}`);
console.log("=== TODOS OS TESTES PASSARAM COM SUCESSO! ===");
