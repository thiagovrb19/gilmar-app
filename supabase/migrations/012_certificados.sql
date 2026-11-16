-- ==============================================================================
-- MIGRATION 012: CERTIFICADOS E NRs DO GILMAR (PDFs públicos para os clientes)
-- ==============================================================================
-- Como executar: Supabase > SQL Editor > New query > cole TUDO > Run.
-- É idempotente (pode rodar mais de uma vez) e NÃO altera nada do que já existe.
--
-- O que cria:
--   * Tabela public.certificados  -> título, descrição e caminho do PDF
--   * Bucket PÚBLICO "certificados" -> os PDFs (qualquer visitante pode abrir/baixar)
--   * Tempo real (Realtime) na tabela, para a lista do cliente atualizar sozinha
--
-- Segurança:
--   * O cliente (anon) só LÊ certificados ativos. Ninguém além do servidor do app
--     (service_role, após validar o login do Gilmar) consegue enviar/editar/apagar.
--   * O bucket só aceita PDF, até 20 MB por arquivo.
-- ==============================================================================

BEGIN;

-- 1. Tabela
CREATE TABLE IF NOT EXISTS public.certificados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL CHECK (char_length(titulo) BETWEEN 2 AND 160),
  descricao TEXT CHECK (descricao IS NULL OR char_length(descricao) <= 600),
  arquivo_path TEXT NOT NULL UNIQUE,      -- caminho dentro do bucket "certificados"
  arquivo_nome TEXT NOT NULL,             -- nome original (usado ao baixar)
  tamanho_bytes BIGINT NOT NULL CHECK (tamanho_bytes > 0),
  ordem INT NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_certificados_listagem
  ON public.certificados (ativo, ordem, criado_em DESC);

-- 2. RLS
ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura pública de certificados ativos" ON public.certificados;
CREATE POLICY "Leitura pública de certificados ativos"
  ON public.certificados FOR SELECT
  TO anon, authenticated
  USING (ativo = true OR public.is_admin());

DROP POLICY IF EXISTS "Admin gerencia certificados" ON public.certificados;
CREATE POLICY "Admin gerencia certificados"
  ON public.certificados FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.certificados FROM anon;
GRANT SELECT ON public.certificados TO anon;
GRANT ALL ON public.certificados TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.certificados TO authenticated;

-- 3. Bucket público só para PDF (20 MB). Sem políticas de escrita: só o servidor grava.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('certificados', 'certificados', true, 20971520, ARRAY['application/pdf'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Tempo real: a lista do cliente atualiza assim que o Gilmar adiciona/remove
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (
       SELECT 1 FROM pg_publication_tables
       WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'certificados'
     ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.certificados;
  END IF;
END $$;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- VERIFICAÇÃO (rode depois):
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'certificados';   -- 1 linha, public = true
--   SELECT count(*) FROM public.certificados;                                              -- 0 no começo
--   SELECT tablename FROM pg_publication_tables WHERE pubname='supabase_realtime' AND tablename='certificados'; -- 1 linha
