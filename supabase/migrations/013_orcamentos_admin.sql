-- ==============================================================================
-- MIGRATION 013: ORÇAMENTOS CRIADOS PELO ADMIN (preço livre, sem ocupar a agenda)
-- ==============================================================================
-- Como executar: Supabase > SQL Editor > New query > cole TUDO > Run.
-- É idempotente (pode rodar mais de uma vez) e NÃO altera nada do que já existe.
--
-- O que cria: tabela public.orcamentos_admin, usada pela nova área "Orçamentos"
-- do painel do Gilmar. Esses orçamentos NÃO entram na agenda (não bloqueiam horário)
-- e NÃO mexem nos preços fixos dos serviços.
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
  status TEXT NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'enviado', 'aprovado', 'recusado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_orcamentos_admin_listagem
  ON public.orcamentos_admin (criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_orcamentos_admin_cliente
  ON public.orcamentos_admin (cliente_id);

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

-- VERIFICAÇÃO (rode depois): deve retornar 0 no começo
--   SELECT count(*) FROM public.orcamentos_admin;
