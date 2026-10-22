-- ==============================================================================
-- MIGRATION 001: EXTENSÕES E TABELAS BASE (BARBEARIA DO LUIZ)
-- ==============================================================================

-- 1. Ativar extensões necessárias
CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Tabela de Perfis de Usuário (vinculado a auth.users do Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente', 'admin')),
  cliente_id UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- 3. Tabela de Clientes
CREATE TABLE IF NOT EXISTS public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  whatsapp TEXT NOT NULL UNIQUE,
  data_nascimento DATE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  observacoes TEXT,
  aceite_lgpd_em TIMESTAMPTZ,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- Adicionar foreign key de profiles para clientes (se ainda não existir)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_profiles_cliente'
  ) THEN
    ALTER TABLE public.profiles 
      ADD CONSTRAINT fk_profiles_cliente 
      FOREIGN KEY (cliente_id) REFERENCES public.clientes(id) ON DELETE SET NULL;
  END IF;
END $$;

-- 4. Tabela de Serviços e Combos
CREATE TABLE IF NOT EXISTS public.servicos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL CHECK (preco >= 0),
  duracao_min INT NOT NULL DEFAULT 60,
  icone TEXT NOT NULL DEFAULT 'corte',
  tipo TEXT NOT NULL DEFAULT 'avulso' CHECK (tipo IN ('avulso', 'combo')),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INT NOT NULL DEFAULT 0,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- 5. Itens que compõem cada Combo
CREATE TABLE IF NOT EXISTS public.combo_itens (
  combo_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE CASCADE,
  PRIMARY KEY (combo_id, servico_id)
);

-- 6. Tabela de Horário de Funcionamento semanal (0 = Domingo, 1 = Segunda, etc.)
CREATE TABLE IF NOT EXISTS public.horario_funcionamento (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  abre TIME NOT NULL,
  fecha TIME NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT check_horario_valido CHECK (abre < fecha)
);

-- 7. Bloqueios de Agenda (Férias, compromissos, folgas)
CREATE TABLE IF NOT EXISTS public.bloqueios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  motivo TEXT NOT NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now()),
  CONSTRAINT check_bloqueio_valido CHECK (inicio < fim)
);

-- 8. Horários Fixos Semanais (Recorrência)
CREATE TABLE IF NOT EXISTS public.horarios_fixos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  dia_semana INT NOT NULL CHECK (dia_semana BETWEEN 0 AND 6),
  hora TIME NOT NULL,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- 9. Tabela de Agendamentos (com EXCLUSION CONSTRAINT Anti-Sobreposição)
CREATE TABLE IF NOT EXISTS public.agendamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE RESTRICT,
  inicio TIMESTAMPTZ NOT NULL,
  fim TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'agendado' 
    CHECK (status IN ('agendado', 'confirmado', 'concluido', 'cancelado', 'nao_compareceu')),
  origem TEXT NOT NULL DEFAULT 'app' 
    CHECK (origem IN ('app', 'admin', 'fixo')),
  horario_fixo_id UUID REFERENCES public.horarios_fixos(id) ON DELETE SET NULL,
  valor_total NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (valor_total >= 0),
  desconto NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (desconto >= 0),
  pago BOOLEAN NOT NULL DEFAULT false,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('pix', 'dinheiro', 'debito', 'credito', 'credito_pre_pago', 'outro')),
  usou_credito BOOLEAN NOT NULL DEFAULT false,
  cancelado_em TIMESTAMPTZ,
  cancelado_por TEXT,
  motivo_cancelamento TEXT,
  observacao TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now()),
  CONSTRAINT check_agendamento_periodo CHECK (inicio < fim),
  -- CONSTRAINT CRÍTICA ANTI-CONFLITO: Impede qualquer sobreposição temporal para agendamentos não cancelados
  CONSTRAINT agendamentos_sem_conflito_horario 
    EXCLUDE USING gist (
      tstzrange(inicio, fim) WITH &&
    ) WHERE (status NOT IN ('cancelado'))
);

-- 10. Serviços Vinculados ao Agendamento
CREATE TABLE IF NOT EXISTS public.agendamento_servicos (
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  preco_cobrado NUMERIC(10,2) NOT NULL CHECK (preco_cobrado >= 0),
  PRIMARY KEY (agendamento_id, servico_id)
);

-- 11. Multas por Cancelamento Fora do Prazo ou Não Comparecimento
CREATE TABLE IF NOT EXISTS public.multas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  valor NUMERIC(10,2) NOT NULL CHECK (valor >= 0),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'paga', 'perdoada')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now()),
  pago_em TIMESTAMPTZ
);

-- 12. Lançamentos Financeiros (Entradas e Saídas)
CREATE TABLE IF NOT EXISTS public.lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL CHECK (valor > 0),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pagamento TEXT CHECK (forma_pagamento IN ('pix', 'dinheiro', 'debito', 'credito', 'credito_pre_pago', 'outro')),
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  multa_id UUID REFERENCES public.multas(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- 13. Créditos Pré-pagos de Clientes
CREATE TABLE IF NOT EXISTS public.creditos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  servico_id UUID NOT NULL REFERENCES public.servicos(id) ON DELETE RESTRICT,
  quantidade INT NOT NULL CHECK (quantidade > 0),
  saldo INT NOT NULL CHECK (saldo >= 0),
  valor_pago NUMERIC(10,2) NOT NULL CHECK (valor_pago >= 0),
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- 14. Avaliações dos Atendimentos
CREATE TABLE IF NOT EXISTS public.avaliacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID NOT NULL UNIQUE REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nota INT NOT NULL CHECK (nota BETWEEN 1 AND 5),
  comentario TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- 15. Configurações Globais (Tabela de Linha Única)
CREATE TABLE IF NOT EXISTS public.configuracoes (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  nome_barbearia TEXT NOT NULL DEFAULT 'Barbearia do Luiz',
  whatsapp_contato TEXT NOT NULL DEFAULT '32999311712',
  endereco TEXT,
  link_maps TEXT,
  instagram TEXT,
  pix_chave TEXT NOT NULL DEFAULT '+5532999311712',
  pix_nome TEXT NOT NULL DEFAULT 'LUIZ FERNANDO GOUVEIA',
  pix_cidade TEXT NOT NULL DEFAULT 'Visconde do Rio Branco',
  duracao_horario_min INT NOT NULL DEFAULT 60,
  antecedencia_minima_horas INT NOT NULL DEFAULT 1,
  janela_dias INT NOT NULL DEFAULT 30,
  horas_cancelamento_gratis INT NOT NULL DEFAULT 3,
  multa_percentual NUMERIC(5,2) NOT NULL DEFAULT 50.00,
  bloquear_se_multa_pendente BOOLEAN NOT NULL DEFAULT false,
  desconto_aniversario_ativo BOOLEAN NOT NULL DEFAULT false,
  desconto_aniversario_percentual NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  desconto_aniversario_regra TEXT NOT NULL DEFAULT 'semana' CHECK (desconto_aniversario_regra IN ('dia', 'semana', 'mes')),
  dias_cliente_sumido INT NOT NULL DEFAULT 15,
  fidelidade_ativo BOOLEAN NOT NULL DEFAULT false,
  fidelidade_a_cada_visitas INT NOT NULL DEFAULT 10,
  fidelidade_servico_premio_id UUID REFERENCES public.servicos(id) ON DELETE SET NULL,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT timezone('America/Sao_Paulo'::text, now())
);

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_agendamentos_cliente_inicio ON public.agendamentos (cliente_id, inicio);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status_inicio ON public.agendamentos (status, inicio);
CREATE INDEX IF NOT EXISTS idx_clientes_whatsapp ON public.clientes (whatsapp);
CREATE INDEX IF NOT EXISTS idx_lancamentos_data ON public.lancamentos (data);
CREATE INDEX IF NOT EXISTS idx_multas_cliente_status ON public.multas (cliente_id, status);
