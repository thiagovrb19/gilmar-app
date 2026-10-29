-- ==============================================================================
-- MIGRATION 006: PROPOSTA COMERCIAL EM PDF + CONTROLE DE ESTOQUE (GILMAR.XLSX)
-- ==============================================================================
-- Como executar:
--   Copie todo este conteúdo, cole no "SQL Editor" do seu painel Supabase
--   e clique em "Run". Este script é 100% idempotente (pode ser rodado mais de
--   uma vez com segurança sem duplicar dados).
-- ==============================================================================

-- 1. Atualizar WhatsApp Comercial oficial do Gilmar (+55 32 8871-4986)
UPDATE public.configuracoes
SET whatsapp_contato = '553288714986',
    atualizado_em = now()
WHERE id = 1;

-- 2. Adicionar campos da Proposta Comercial Completa na tabela public.agendamentos
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS proposta_subtitulo TEXT,
  ADD COLUMN IF NOT EXISTS proposta_objetivo TEXT,
  ADD COLUMN IF NOT EXISTS proposta_condicoes_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS cliente_localidade TEXT,
  ADD COLUMN IF NOT EXISTS proposta_itens_json JSONB DEFAULT '[]'::jsonb;

-- 3. Criar tabela de Controle de Estoque do Admin (Baseada na planilha Gilmar.xlsx)
CREATE TABLE IF NOT EXISTS public.estoque_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Material Elétrico',
  valor_unitario NUMERIC(10, 2) NOT NULL DEFAULT 0 CHECK (valor_unitario >= 0),
  quantidade INT NOT NULL DEFAULT 0 CHECK (quantidade >= 0),
  estoque_minimo INT NOT NULL DEFAULT 1 CHECK (estoque_minimo >= 0),
  unidade TEXT NOT NULL DEFAULT 'un',
  observacao TEXT,
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estoque_pecas_ordem
  ON public.estoque_pecas (ativo, ordem, nome);

-- 4. View auxiliar consolidada do Estoque (calcula RECEITA = VALOR * ESTOQUE igual à planilha)
CREATE OR REPLACE VIEW public.v_estoque_receita AS
SELECT
  id,
  nome AS item,
  categoria,
  valor_unitario AS valor,
  quantidade AS estoque,
  ROUND(valor_unitario * quantidade, 2) AS receita,
  estoque_minimo,
  unidade,
  observacao,
  ordem,
  ativo,
  atualizado_em
FROM public.estoque_pecas
WHERE ativo = true
ORDER BY ordem ASC, nome ASC;

-- 5. Habilitar Row Level Security (RLS) restrito exclusivamente ao Admin (Gilmar)
ALTER TABLE public.estoque_pecas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia estoque_pecas" ON public.estoque_pecas;
CREATE POLICY "Admin gerencia estoque_pecas"
  ON public.estoque_pecas
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

GRANT ALL ON public.estoque_pecas TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_pecas TO authenticated;
GRANT SELECT ON public.v_estoque_receita TO authenticated, service_role;

-- 6. Popular as 44 peças originais da planilha Gilmar.xlsx (somente se a tabela estiver vazia)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.estoque_pecas LIMIT 1) THEN
    INSERT INTO public.estoque_pecas (nome, categoria, valor_unitario, quantidade, estoque_minimo, unidade, ordem)
    VALUES
      ('REFLETOR', 'Iluminação', 30.00, 1, 1, 'un', 1),
      ('BARRA DE COBRE', 'Barramento e Aterramento', 30.00, 3, 1, 'un', 2),
      ('TOMADA MACHO', 'Tomadas e Plugues', 10.00, 2, 2, 'un', 3),
      ('TOMADA FÊMEA', 'Tomadas e Plugues', 10.00, 2, 2, 'un', 4),
      ('CAIXA DE BOTÃO EMG.', 'Comando e Botão', 50.00, 5, 1, 'un', 5),
      ('ISOLADOR', 'Barramento e Aterramento', 20.00, 9, 2, 'un', 6),
      ('CONTATORA', 'Comando e Automação', 120.00, 5, 2, 'un', 7),
      ('FITA ISOLANTE', 'Isolação e Fitas', 5.00, 2, 3, 'un', 8),
      ('CONTATORA WEG CWM9', 'Comando e Automação', 130.00, 1, 1, 'un', 9),
      ('FITA AUTO FUSÃO', 'Isolação e Fitas', 15.00, 2, 1, 'un', 10),
      ('TOMADA DUPLA', 'Tomadas e Plugues', 15.00, 2, 2, 'un', 11),
      ('RELÉ TÉRMICO', 'Comando e Automação', 100.00, 3, 1, 'un', 12),
      ('CHAVE FIM DE CURSO', 'Sensores e Fim de Curso', 50.00, 3, 1, 'un', 13),
      ('CONECTOR DE LOUÇA', 'Conectores e Terminais', 15.00, 11, 3, 'un', 14),
      ('RELÉ FALTA DE FASE', 'Comando e Automação', 120.00, 0, 1, 'un', 15),
      ('DISJUNTOR BIPOLAR C32', 'Disjuntores e Proteção', 50.00, 1, 1, 'un', 16),
      ('FONTE 12V', 'Fontes e Transformadores', 35.00, 1, 1, 'un', 17),
      ('RELÉ TEMPORIZADOR', 'Comando e Automação', 90.00, 1, 1, 'un', 18),
      ('CHAVE SELETORA', 'Comando e Botão', 40.00, 2, 1, 'un', 19),
      ('BOTÃO DE PULSO', 'Comando e Botão', 25.00, 4, 2, 'un', 20),
      ('BOTÃO DE EMERGÊNCIA', 'Comando e Botão', 35.00, 2, 1, 'un', 21),
      ('SINALEIRO LED', 'Comando e Botão', 15.00, 6, 2, 'un', 22),
      ('DISJUNTOR UNIPOLAR C16', 'Disjuntores e Proteção', 20.00, 4, 2, 'un', 23),
      ('DISJUNTOR UNIPOLAR C20', 'Disjuntores e Proteção', 20.00, 3, 2, 'un', 24),
      ('DISJUNTOR TRIPOLAR C40', 'Disjuntores e Proteção', 75.00, 2, 1, 'un', 25),
      ('DISJUNTOR TRIPOLAR C63', 'Disjuntores e Proteção', 90.00, 1, 1, 'un', 26),
      ('DISJUNTOR MOTOR', 'Disjuntores e Proteção', 150.00, 2, 1, 'un', 27),
      ('DPS (PROTETOR DE SURTO)', 'Disjuntores e Proteção', 45.00, 4, 2, 'un', 28),
      ('IDR / DR TETRAPOLAR', 'Disjuntores e Proteção', 140.00, 1, 1, 'un', 29),
      ('CABO FLEXÍVEL 2,5MM (ROLO)', 'Cabos e Condutores', 180.00, 1, 1, 'un', 30),
      ('CABO FLEXÍVEL 4,0MM (ROLO)', 'Cabos e Condutores', 260.00, 1, 1, 'un', 31),
      ('CABO PP 4X2,5MM (METRO)', 'Cabos e Condutores', 15.00, 10, 5, 'm', 32),
      ('TERMINAL ILHÓS (KIT)', 'Conectores e Terminais', 30.00, 2, 1, 'kit', 33),
      ('CONECTOR WAGO', 'Conectores e Terminais', 5.00, 12, 5, 'un', 34),
      ('PRENSA CABO', 'Infraestrutura e Quadros', 5.00, 10, 4, 'un', 35),
      ('CANALETA RECORTADA 30X30', 'Infraestrutura e Quadros', 25.00, 4, 2, 'un', 36),
      ('TRILHO DIN', 'Infraestrutura e Quadros', 15.00, 4, 2, 'un', 37),
      ('CAIXA DE PASSAGEM PVC', 'Infraestrutura e Quadros', 25.00, 3, 1, 'un', 38),
      ('QUADRO DE COMANDO METÁLICO', 'Infraestrutura e Quadros', 220.00, 1, 1, 'un', 39),
      ('PLUG INDUSTRIAL 3P+T 32A', 'Tomadas e Plugues', 45.00, 2, 1, 'un', 40),
      ('TOMADA INDUSTRIAL 3P+T 32A', 'Tomadas e Plugues', 55.00, 2, 1, 'un', 41),
      ('VENTOINHA / COOLER PAINEL', 'Infraestrutura e Quadros', 60.00, 2, 1, 'un', 42),
      ('FUSÍVEL DIAZED / NH', 'Disjuntores e Proteção', 15.00, 6, 2, 'un', 43),
      ('SENSOR INDUTIVO', 'Sensores e Fim de Curso', 80.00, 1, 1, 'un', 44);
  END IF;
END $$;

-- 7. Recarregar o cache do schema do Supabase (PostgREST)
NOTIFY pgrst, 'reload schema';

