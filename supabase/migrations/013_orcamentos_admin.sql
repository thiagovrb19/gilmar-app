-- ==============================================================================
-- MIGRATION 013: ORÇAMENTOS CRIADOS PELO ADMIN (preço livre, sem ocupar a agenda)
-- ==============================================================================
-- Como executar: Supabase > SQL Editor > New query > cole TUDO > Run.
-- É idempotente (pode rodar mais de uma vez) e NÃO altera nada do que já existe.
--
-- O que cria/ajusta:
--   * Tabela public.orcamentos_admin, usada pela área "Orçamentos" do painel do Gilmar.
--   * Cada orçamento do admin ocupa a AGENDA: o app cria o agendamento ligado a ele
--     (colunas orcamento_admin_id em agendamentos e agendamento_id em orcamentos_admin).
--   * Quando o orçamento tem valor, o agendamento carrega esse valor e ele aparece no
--     FINANCEIRO (receita prevista; vira entrada de verdade ao concluir o atendimento).
--   * NÃO mexe nos preços fixos dos serviços.
--
-- Segurança: só o servidor do app (service_role, após validar o login do Gilmar)
-- lê e grava. Nenhum visitante (anon) enxerga nada.
-- ==============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.orcamentos_admin (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero BIGINT GENERATED ALWAYS AS IDENTITY,          -- nº sequencial (ORC-0001...)
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  cliente_nome TEXT NOT NULL CHECK (char_length(cliente_nome) BETWEEN 2 AND 160),
  cliente_whatsapp TEXT,
  cliente_localidade TEXT,
  subtitulo TEXT,
  objetivo TEXT,
  condicoes_pagamento TEXT,
  observacoes TEXT,
  -- como os valores aparecem no orçamento:
  --   por_item     = cada serviço tem seu preço; total = soma (ou valor final ajustado)
  --   total_unico  = serviços sem preço; um valor único no final
  --   a_combinar   = sem valor (a combinar com o cliente)
  modo_valores TEXT NOT NULL DEFAULT 'por_item'
    CHECK (modo_valores IN ('por_item', 'total_unico', 'a_combinar')),
  valor_total NUMERIC(12,2) CHECK (valor_total IS NULL OR valor_total >= 0),
  mostrar_sem_foto BOOLEAN NOT NULL DEFAULT false,
  validade_dias INT NOT NULL DEFAULT 10 CHECK (validade_dias BETWEEN 1 AND 365),
  itens JSONB NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(itens) = 'array'),
  agendamento_id UUID,                                   -- horário reservado na agenda
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_admin_listagem
  ON public.orcamentos_admin (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_orcamentos_admin_cliente
  ON public.orcamentos_admin (cliente_id);

-- Ligação com a agenda (idempotente; também atualiza quem já rodou a versão anterior)
ALTER TABLE public.orcamentos_admin
  ADD COLUMN IF NOT EXISTS agendamento_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_orcamentos_admin_agendamento') THEN
    ALTER TABLE public.orcamentos_admin
      ADD CONSTRAINT fk_orcamentos_admin_agendamento
      FOREIGN KEY (agendamento_id) REFERENCES public.agendamentos(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS orcamento_admin_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_agendamentos_orcamento_admin') THEN
    ALTER TABLE public.agendamentos
      ADD CONSTRAINT fk_agendamentos_orcamento_admin
      FOREIGN KEY (orcamento_admin_id) REFERENCES public.orcamentos_admin(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_orcamentos_admin_agendamento
  ON public.orcamentos_admin (agendamento_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_orcamento_admin
  ON public.agendamentos (orcamento_admin_id);

ALTER TABLE public.orcamentos_admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia orcamentos_admin" ON public.orcamentos_admin;
CREATE POLICY "Admin gerencia orcamentos_admin"
  ON public.orcamentos_admin FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.orcamentos_admin FROM anon;
GRANT ALL ON public.orcamentos_admin TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.orcamentos_admin TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- VERIFICAÇÃO (rode depois, uma por vez):
--   SELECT count(*) FROM public.orcamentos_admin;                       -- 0 no começo
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='agendamentos' AND column_name='orcamento_admin_id';  -- 1 linha
--   SELECT column_name FROM information_schema.columns
--     WHERE table_name='orcamentos_admin' AND column_name='agendamento_id';  -- 1 linha
