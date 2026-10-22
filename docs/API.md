# Contratos de API e Server Actions — Barbearia do Luiz

Este documento documenta todas as Server Actions e endpoints HTTP disponíveis na aplicação, com seus parâmetros, contratos de retorno e regras de negócio.

---

## 1. Server Actions: Agendamento (`src/actions/booking.ts`)

### `getServicos(): Promise<Servico[]>`
- **Descrição**: Retorna todos os serviços e combos ativos cadastrados, ordenados por prioridade.
- **Retorno**: Array de objetos `Servico`.

### `getConfiguracoes(): Promise<Configuracao>`
- **Descrição**: Retorna as configurações globais da barbearia (chave Pix, horários de cancelamento gratuito, regras de fidelidade, endereço, etc.).

### `getHorariosDisponiveisAction(dataStr: string, servicoIds: string[]): Promise<string[]>`
- **Descrição**: Calcula e retorna os horários livres para atendimento na data solicitada (`YYYY-MM-DD`), considerando:
  1. Horário de funcionamento do dia da semana (tabela `horarios_funcionamento`).
  2. Dias de exceção (tabela `dias_excecao` — feriados ou horários customizados).
  3. Bloqueios manuais realizados pelo Luiz.
  4. Horários fixos recorrentes semanais.
  5. Agendamentos já confirmados no intervalo de duração dos serviços.
  6. Janela de antecedência mínima configurada.
- **Parâmetros**:
  - `dataStr` (`string`): Data no formato `YYYY-MM-DD`.
  - `servicoIds` (`string[]`): Lista com os IDs dos serviços selecionados.
- **Retorno**: Array de strings no formato `["17:00", "18:00", "19:00", ...]`.

### `criarAgendamentoAction(params): Promise<{ success: boolean; agendamentoId?: string; error?: string }>`
- **Descrição**: Executa a criação atômica do agendamento, associando o cliente e os serviços.
- **Parâmetros**:
  - `clienteId` (`string`): Identificador do cliente.
  - `servicoIds` (`string[]`): Lista de IDs dos serviços contratados.
  - `inicio` (`string`): Timestamp ISO do início do atendimento.
  - `formaPagamento` (`FormaPagamento`): `'pix' | 'dinheiro' | 'cartao_credito' | 'cartao_debito'`.
  - `observacao` (`string`, opcional): Observações adicionais do cliente.

### `cancelarAgendamentoClienteAction(id: string, motivo?: string): Promise<{ success: boolean; multaGerada?: boolean; valorMulta?: number; error?: string }>`
- **Descrição**: Permite ao cliente cancelar seu atendimento futuro. Se o cancelamento for solicitado com antecedência inferior ao limite gratuito (`horas_cancelamento_gratis`), gera automaticamente uma multa de 50%.

---

## 2. Server Actions: Painel Administrativo (`src/actions/admin.ts`)

### `concluirAtendimentoAction(id, formaPagamento, pago, usarCredito): Promise<{ success: boolean; error?: string }>`
- **Descrição**: Finaliza o atendimento na agenda do dia:
  1. Altera o status do agendamento para `'concluido'`.
  2. Atualiza a forma de pagamento e a marcação de pago (`pago = true`).
  3. Se o pagamento foi realizado (e não foi por crédito pré-pago), cria automaticamente um lançamento de entrada no financeiro com a categoria `'Atendimento'`.
  4. Atualiza em tempo real as métricas de receita de hoje, total gasto do cliente e visitas.
  5. Revalida as páginas `/admin`, `/admin/agenda`, `/admin/financeiro` e `/admin/clientes`.

### `marcarNaoCompareceuAction(id: string): Promise<{ success: boolean; error?: string }>`
- **Descrição**: Registra que o cliente não compareceu ao corte agendado, gerando automaticamente uma multa pendente correspondente a 50% do valor do atendimento.

### `salvarDiaExcecaoAction(params): Promise<{ success: boolean; error?: string }>`
- **Descrição**: Cadastra ou altera uma exceção na rotina da barbearia para uma data específica (feriado fechado ou horários personalizados).

### `removerDiaExcecaoAction(dataStr: string): Promise<{ success: boolean; error?: string }>`
- **Descrição**: Remove a personalização da data, restaurando o expediente padrão semanal da barbearia.

### `getFinanceiroDados(): Promise<{ lancamentos: Lancamento[]; pendencias: Agendamento[]; multasPendentes: Multa[] }>`
- **Descrição**: Retorna o extrato financeiro completo, incluindo entradas e saídas, clientes com atendimentos pendentes de pagamento e multas em aberto.

### `criarLancamentoAction(data): Promise<{ success: boolean; error?: string }>`
- **Descrição**: Registra um lançamento manual de entrada ou despesa operacional na barbearia.

---

## 3. Server Actions: Autenticação (`src/actions/auth.ts`)

### `loginCliente(identificadorRaw, senha): Promise<AuthResponse>`
- **Descrição**: Autentica o cliente por número de WhatsApp, e-mail ou nome, sincronizando o cookie de sessão.

### `cadastrarCliente(data): Promise<AuthResponse>`
- **Descrição**: Realiza o cadastro inicial do cliente com nome, WhatsApp, data de nascimento e senha, gravando os dados com segurança.

### `getCurrentUser(): Promise<UserSession | null>`
- **Descrição**: Retorna os dados do usuário autenticado atual e sua ficha cadastral (com data de nascimento, total de visitas, etc.).

---

## 4. Endpoint HTTP: Keep-Alive Diário (`src/app/api/keepalive/route.ts`)

- **Método**: `GET`
- **Cabeçalho de Autorização**: `Authorization: Bearer <CRON_SECRET>`
- **Finalidade**: Chamado diariamente pelo Vercel Cron para executar uma leitura ultraleve na tabela `configuracoes` e evitar que a instância gratuita do Supabase entre em hibernação por inatividade.
- **Respostas**:
  - `200 OK`: `{ "success": true, "message": "Keep-alive executado com sucesso no Supabase", ... }`
  - `401 Unauthorized`: Caso o token Bearer seja inválido ou ausente.
