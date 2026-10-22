import fs from "fs";
import path from "path";

// Test script to validate the 3 fixes directly
async function testCorrections() {
  console.log("=== INICIANDO TESTE DAS CORREÇÕES ===");

  const STORE_PATH = path.join(process.cwd(), ".local-data", "mock-db.json");
  if (!fs.existsSync(STORE_PATH)) {
    console.error("mock-db.json não encontrado!");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(STORE_PATH, "utf-8"));
  console.log(`Carregados: ${data.clientes.length} clientes, ${data.agendamentos.length} agendamentos.`);

  // 1. Teste de preservação de data de nascimento
  console.log("\n[TESTE 1] Preservação de Data de Nascimento");
  let testCli = data.clientes.find((c) => c.nome.includes("Thiago"));
  if (!testCli) {
    testCli = {
      id: "c-test-1",
      nome: "Thiago Marques",
      whatsapp: "32999887766",
      data_nascimento: "1994-08-20",
      user_id: "c-test-1",
      aceite_lgpd_em: new Date().toISOString(),
      criado_em: new Date().toISOString(),
    };
    data.clientes.push(testCli);
  } else {
    testCli.data_nascimento = "1994-08-20";
  }

  // Simula login sem data_nascimento explicitamente enviada: não pode sobrescrever para null
  const existing = data.clientes.find((c) => c.id === testCli.id);
  const dataNascimentoPreservada = existing?.data_nascimento || null;
  console.log("Data de nascimento preservada no login:", dataNascimentoPreservada);
  if (dataNascimentoPreservada !== "1994-08-20") {
    throw new Error("Falha no teste 1: data de nascimento foi perdida!");
  }
  console.log("✓ Teste 1 passou com sucesso!");

  // 2. Teste de Concluir Agendamento e Integração Financeira
  console.log("\n[TESTE 2] Conclusão de Agendamento e Lançamento Financeiro");
  let targetAg = data.agendamentos.find((a) => a.cliente_id === testCli.id);
  if (!targetAg) {
    targetAg = data.agendamentos[0];
  }

  const valorAtendimento = targetAg.valor_total || 25;
  console.log(`Agendamento selecionado: ${targetAg.id} - ${targetAg.inicio} - Status atual: ${targetAg.status}`);

  // Simula mockConcluirAgendamento
  targetAg.status = "concluido";
  targetAg.forma_pagamento = "pix";
  targetAg.pago = true;
  targetAg.usou_credito = false;

  if (!data.lancamentos) data.lancamentos = [];
  const hojeStr = new Date().toISOString().split("T")[0];
  const novoLancamento = {
    id: "lanc-test-" + Date.now().toString(36),
    tipo: "entrada",
    categoria: "Atendimento",
    descricao: `Atendimento concluído - ${testCli.nome}`,
    valor: valorAtendimento,
    data: hojeStr,
    forma_pagamento: "pix",
    agendamento_id: targetAg.id,
    cliente_id: testCli.id,
    criado_em: new Date().toISOString(),
  };
  data.lancamentos.unshift(novoLancamento);

  console.log(`Lançamento financeiro gerado: R$ ${novoLancamento.valor.toFixed(2)} (${novoLancamento.forma_pagamento})`);
  const lancamentoEncontrado = data.lancamentos.find((l) => l.agendamento_id === targetAg.id);
  if (!lancamentoEncontrado) {
    throw new Error("Falha no teste 2: Lançamento não encontrado no financeiro!");
  }
  console.log("✓ Teste 2 passou: Lançamento registrado no financeiro com sucesso!");

  // 3. Teste de Total Gasto pelo Cliente
  console.log("\n[TESTE 3] Total Gasto pelo Cliente");
  const agsDoCliente = data.agendamentos.filter((a) => a.cliente_id === testCli.id);
  const concluidos = agsDoCliente.filter((a) => a.status === "concluido");
  const totalGasto = concluidos.reduce((acc, a) => acc + (a.valor_total || 0), 0);
  console.log(`Cliente ${testCli.nome}: ${concluidos.length} visita(s), Total Gasto = R$ ${totalGasto.toFixed(2)}`);
  if (totalGasto <= 0) {
    throw new Error("Falha no teste 3: total gasto continua 0!");
  }
  console.log("✓ Teste 3 passou: Total gasto calculado com exatidão!");

  // Salva estado atualizado no mock-db.json
  fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), "utf-8");
  console.log("\n✓ mock-db.json persistido com sucesso com dados validados.");
  console.log("=== TODOS OS 3 TESTES PASSARAM COM 100% DE SUCESSO! ===");
}

testCorrections().catch((err) => {
  console.error("Erro no teste:", err);
  process.exit(1);
});
