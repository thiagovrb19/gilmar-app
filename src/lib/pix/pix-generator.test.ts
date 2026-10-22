import { calculateCRC16, generatePixCode } from "./pix-generator";

export function runPixTests(): { passed: boolean; message: string } {
  // Teste 1: Validação de CRC16 clássico
  // Para a string "123456789", o CRC16-CCITT (0xFFFF, 0x1021) resulta em 0x29B1
  const testInput = "123456789";
  const crcResult = calculateCRC16(testInput);
  if (crcResult !== "29B1") {
    return {
      passed: false,
      message: `Falha no CRC16 de teste: esperado 29B1, recebido ${crcResult}`,
    };
  }

  // Teste 2: Geração completa do Pix do Luiz com R$ 25,00
  const pixCode = generatePixCode({
    chave: "+5532999311712",
    nomeRecebedor: "LUIZ FERNANDO GOUVEIA",
    cidade: "VISCONDE DO RIO BRANCO",
    valor: 25.0,
  });

  if (!pixCode.startsWith("000201")) {
    return {
      passed: false,
      message: "Código Pix não inicia com Payload Format Indicator 000201",
    };
  }

  if (!pixCode.includes("br.gov.bcb.pix")) {
    return {
      passed: false,
      message: "Código Pix não contém o GUI oficial br.gov.bcb.pix",
    };
  }

  if (!pixCode.includes("+5532999311712")) {
    return {
      passed: false,
      message: "Código Pix não contém a chave do Luiz (+5532999311712)",
    };
  }

  // Verifica se o CRC16 final de 4 dígitos confere com o cálculo sobre o corpo
  const body = pixCode.slice(0, -4);
  const expectedCrc = calculateCRC16(body);
  const actualCrc = pixCode.slice(-4);

  if (expectedCrc !== actualCrc) {
    return {
      passed: false,
      message: `Checksum final incorreto: esperado ${expectedCrc}, recebido ${actualCrc}`,
    };
  }

  return {
    passed: true,
    message: `Todos os testes de CRC16 e BR Code passaram com sucesso! Pix gerado: ${pixCode}`,
  };
}
