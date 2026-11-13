// Testes das chaves Pix (CPF, celular etc.) e do BR Code contra o QR real do Mercado Pago.
// Rodar: npm run test:pix
import { calculateCRC16, generatePixCode } from "../src/lib/pix/pix-generator.ts";
import {
  cpfValido,
  cnpjValido,
  formatarChavePix,
  inferirTipoChavePix,
  normalizarChavePix,
  qrImagemValida,
  validarChavePix,
} from "../src/lib/pix/chave.ts";

let falhas = 0;
const ok = (cond, msg) => {
  console.log(`${cond ? "✔" : "✖ FALHOU:"} ${msg}`);
  if (!cond) falhas++;
};

console.log("=== TESTES DE CHAVE PIX ===");

// Conteúdo lido do QR Code oficial do Mercado Pago (chave CPF do Gilmar, sem valor)
const QR_BANCO =
  "00020126330014br.gov.bcb.pix0111112579506905204000053039865802BR5918Gilmar Souza Sales6009Sao Paulo62230519daqr2097884514496476304C863";

// 1. Nosso cálculo de CRC confere com o do banco
ok(calculateCRC16(QR_BANCO.slice(0, -4)) === QR_BANCO.slice(-4), "CRC16 do QR do Mercado Pago confere com o nosso cálculo");

// 2. Com os mesmos dados, geramos o MESMO código do banco (a única diferença é o nome em maiúsculas)
const nosso = generatePixCode({
  chave: normalizarChavePix("cpf", "112.579.506-90"),
  nomeRecebedor: "Gilmar Souza Sales",
  cidade: "Sao Paulo",
  txid: "daqr209788451449647",
});
ok(
  nosso.slice(0, -4).toUpperCase() === QR_BANCO.slice(0, -4).toUpperCase(),
  "Código gerado pelo app é igual ao do Mercado Pago (mesma chave, nome, cidade e identificador)"
);
ok(calculateCRC16(nosso.slice(0, -4)) === nosso.slice(-4), "CRC16 do código gerado é válido");

// 3. Código com valor: campo 54 presente e chave CPF só com números
const comValor = generatePixCode({
  chave: normalizarChavePix("cpf", "112.579.506-90"),
  nomeRecebedor: "GILMAR SOUZA SALES",
  cidade: "Visconde do Rio Branco",
  valor: 180,
});
ok(comValor.includes("0111" + "11257950690"), "Chave CPF vai no código com 11 dígitos, sem pontos");
ok(comValor.includes("5406180.00"), "Valor R$ 180,00 entra no código");
ok(comValor.includes("6015VISCONDE DO RIO"), "Cidade é limitada a 15 caracteres");
ok(calculateCRC16(comValor.slice(0, -4)) === comValor.slice(-4), "CRC16 do código com valor é válido");

// 4. Validação por tipo
ok(cpfValido("112.579.506-90") && cpfValido("11257950690"), "CPF válido aceito (com e sem pontos)");
ok(!cpfValido("112.579.506-91") && !cpfValido("111.111.111-11") && !cpfValido("123"), "CPF inválido recusado");
ok(cnpjValido("11.222.333/0001-81") && !cnpjValido("11.222.333/0001-82"), "CNPJ validado pelos dígitos verificadores");
ok(validarChavePix("cpf", "32988714986") !== null, "Celular digitado como CPF é recusado");
ok(validarChavePix("celular", "(32) 98871-4986") === null, "Celular com DDD aceito");
ok(validarChavePix("celular", "98871-4986") !== null, "Celular sem DDD recusado");
ok(validarChavePix("email", "gilmar@exemplo.com") === null && validarChavePix("email", "gilmar@") !== null, "E-mail validado");
ok(
  validarChavePix("aleatoria", "123e4567-e89b-12d3-a456-426614174000") === null &&
    validarChavePix("aleatoria", "123e4567") !== null,
  "Chave aleatória validada"
);
ok(validarChavePix("cpf", "") !== null, "Chave vazia recusada");

// 5. Normalização (o que vai no QR) e formatação (o que aparece na tela)
ok(normalizarChavePix("celular", "(32) 98871-4986") === "+5532988714986", "Celular ganha +55 automaticamente");
ok(normalizarChavePix("celular", "+55 32 98871-4986") === "+5532988714986", "Celular que já tem +55 não é duplicado");
ok(normalizarChavePix("celular", "5532988714986") === "+5532988714986", "Celular com 55 na frente é reconhecido");
ok(normalizarChavePix("email", " Gilmar@Exemplo.com ") === "gilmar@exemplo.com", "E-mail vai em minúsculas");
ok(formatarChavePix("cpf", "11257950690") === "112.579.506-90", "CPF exibido com pontos e traço");
ok(formatarChavePix("celular", "+5532988714986") === "(32) 98871-4986", "Celular exibido com DDD");
ok(formatarChavePix("cnpj", "11222333000181") === "11.222.333/0001-81", "CNPJ exibido formatado");

// 6. Dedução do tipo para bancos sem a coluna nova
ok(inferirTipoChavePix("11257950690") === "cpf", "11 dígitos com dígito verificador válido = CPF");
ok(inferirTipoChavePix("32988714986") === "celular", "11 dígitos que não formam CPF = celular");
ok(inferirTipoChavePix("+5532988714986") === "celular", "Começa com + = celular");
ok(inferirTipoChavePix("a@b.com") === "email", "Tem @ = e-mail");
ok(inferirTipoChavePix("11222333000181") === "cnpj", "14 dígitos = CNPJ");

// 7. Imagem do QR Code
ok(qrImagemValida("data:image/png;base64,iVBORw0KGgo="), "Imagem PNG em data URL aceita");
ok(!qrImagemValida("https://exemplo.com/qr.png") && !qrImagemValida("data:text/html;base64,PGI+"), "Endereço externo e HTML recusados");
ok(!qrImagemValida("data:image/png;base64," + "A".repeat(500_000)), "Imagem pesada demais recusada");

console.log(falhas === 0 ? "\n=== TODOS OS TESTES DE CHAVE PIX PASSARAM ===" : `\n=== ${falhas} TESTE(S) FALHARAM ===`);
process.exit(falhas === 0 ? 0 : 1);
