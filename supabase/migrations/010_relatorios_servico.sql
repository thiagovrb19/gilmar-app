-- ==============================================================================
-- MIGRATION 010: RELATÓRIO DE SERVIÇO EXECUTADO (FOTOS DE ANTES E DEPOIS)
-- ==============================================================================
-- Como executar:
--   Copie todo este conteúdo, cole no "SQL Editor" do painel do Supabase e clique
--   em "Run". O script é idempotente: pode ser rodado mais de uma vez sem
--   duplicar nada e NÃO altera nem apaga clientes, agendamentos ou propostas.
--
-- O que ele cria:
--   * Tabela public.relatorios_servico  -> textos do relatório + lista das fotos
--   * Bucket PRIVADO "relatorios-servico" -> arquivos das fotos de antes/depois
--
-- Modelo de segurança (igual ao dos anexos de orçamento, migration 005):
--   * Só o servidor do app (service_role) grava e lê; o painel do Gilmar recebe
--     URLs assinadas de curta duração. O navegador nunca recebe a service_role.
--   * RLS ligado: nenhum cliente (anon/authenticated comum) enxerga os relatórios.
-- ==============================================================================

BEGIN;

-- 1. Tabela dos relatórios
CREATE TABLE IF NOT EXISTS public.relatorios_servico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vínculo opcional com o orçamento/agendamento de origem
  agendamento_id UUID REFERENCES public.agendamentos(id) ON DELETE SET NULL,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  -- Dados do cliente copiados para o relatório (permite relatório avulso)
  cliente_nome TEXT NOT NULL,
  cliente_whatsapp TEXT,
  cliente_localidade TEXT,
  titulo TEXT NOT NULL DEFAULT 'Relatório de Serviço Executado',
  descricao TEXT,
  observacoes TEXT,
  data_servico DATE NOT NULL DEFAULT CURRENT_DATE,
  -- Lista de fotos: [{ "id": uuid, "tipo": "antes" | "depois", "legenda": texto, "path": caminho no bucket }]
  fotos JSONB NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(fotos) = 'array'),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_relatorios_servico_agendamento
  ON public.relatorios_servico (agendamento_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_servico_cliente
  ON public.relatorios_servico (cliente_id);
CREATE INDEX IF NOT EXISTS idx_relatorios_servico_data
  ON public.relatorios_servico (data_servico DESC, criado_em DESC);

-- 2. RLS: somente administradores (o servidor usa service_role, que ignora RLS)
ALTER TABLE public.relatorios_servico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia relatorios_servico" ON public.relatorios_servico;
CREATE POLICY "Admin gerencia relatorios_servico"
  ON public.relatorios_servico
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

REVOKE ALL ON public.relatorios_servico FROM anon;
GRANT ALL ON public.relatorios_servico TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.relatorios_servico TO authenticated;

-- 3. Bucket privado das fotos (5 MB por arquivo; apenas JPG, PNG ou WebP)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'relatorios-servico',
  'relatorios-servico',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Políticas do Storage: apenas administradores autenticados (além do servidor)
DROP POLICY IF EXISTS "Admin lê fotos de relatório" ON storage.objects;
CREATE POLICY "Admin lê fotos de relatório"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'relatorios-servico' AND public.is_admin());

DROP POLICY IF EXISTS "Admin remove fotos de relatório" ON storage.objects;
CREATE POLICY "Admin remove fotos de relatório"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'relatorios-servico' AND public.is_admin());

COMMIT;

-- Avisa a API do Supabase (PostgREST) para enxergar a tabela nova imediatamente
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- Verificação (opcional): as duas consultas abaixo devem retornar 1 linha cada.
--   SELECT to_regclass('public.relatorios_servico') AS tabela;
--   SELECT id, public, file_size_limit FROM storage.buckets WHERE id = 'relatorios-servico';
-- ==============================================================================
