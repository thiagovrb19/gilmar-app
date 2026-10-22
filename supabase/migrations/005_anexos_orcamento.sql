-- ==============================================================================
-- MIGRATION 005: IMAGENS ANEXADAS ÀS SOLICITAÇÕES (SUPABASE STORAGE + REFERÊNCIAS)
-- ==============================================================================
-- Modelo de segurança:
--   * Os ARQUIVOS ficam no bucket PRIVADO "orcamento-anexos" do Supabase Storage.
--   * O BANCO guarda apenas a referência (caminho, tipo, tamanho) em
--     public.agendamento_anexos, vinculada ao pedido (agendamentos.id).
--   * O navegador NUNCA recebe a service_role. O upload é feito com uma
--     "signed upload URL" de uso único, emitida pelo servidor (Server Action)
--     somente depois de validar que o pedido pertence ao cliente da sessão.
--   * Por isso NÃO existe política de INSERT para anon/authenticated no bucket:
--     ninguém consegue gravar arquivos diretamente sem passar pelo servidor.
--   * Leitura: apenas administradores (is_admin) ou o próprio dono do pedido
--     autenticado no Supabase Auth. O painel usa URLs assinadas de curta duração.
-- ==============================================================================

-- 1. Tabela de referências dos anexos
CREATE TABLE IF NOT EXISTS public.agendamento_anexos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id UUID NOT NULL REFERENCES public.agendamentos(id) ON DELETE CASCADE,
  cliente_id UUID NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  bucket TEXT NOT NULL DEFAULT 'orcamento-anexos',
  storage_path TEXT NOT NULL UNIQUE,
  nome_original TEXT NOT NULL,
  mime_type TEXT NOT NULL
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
  tamanho_bytes INT NOT NULL
    CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 5242880), -- 5 MB
  -- 'pendente' = URL de upload emitida, arquivo ainda não validado
  -- 'enviado'  = arquivo confirmado no Storage e validado no servidor
  status TEXT NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'enviado')),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  enviado_em TIMESTAMPTZ,
  -- Garante que o arquivo fica sempre dentro da "pasta" do próprio pedido
  CONSTRAINT anexo_path_do_agendamento
    CHECK (storage_path LIKE 'agendamentos/' || agendamento_id::text || '/%')
);

CREATE INDEX IF NOT EXISTS idx_agendamento_anexos_agendamento
  ON public.agendamento_anexos (agendamento_id, status);
CREATE INDEX IF NOT EXISTS idx_agendamento_anexos_cliente
  ON public.agendamento_anexos (cliente_id);

-- 2. Limite de anexos por pedido (defesa em profundidade; o servidor também valida)
CREATE OR REPLACE FUNCTION public.limitar_anexos_por_agendamento()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.agendamento_anexos
    WHERE agendamento_id = NEW.agendamento_id
  ) >= 6 THEN
    RAISE EXCEPTION 'Limite de 6 imagens por solicitação atingido.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_limitar_anexos ON public.agendamento_anexos;
CREATE TRIGGER trg_limitar_anexos
  BEFORE INSERT ON public.agendamento_anexos
  FOR EACH ROW EXECUTE FUNCTION public.limitar_anexos_por_agendamento();

-- 3. RLS da tabela de referências
ALTER TABLE public.agendamento_anexos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia anexos" ON public.agendamento_anexos;
CREATE POLICY "Admin gerencia anexos"
  ON public.agendamento_anexos
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Cliente lê anexos dos seus pedidos" ON public.agendamento_anexos;
CREATE POLICY "Cliente lê anexos dos seus pedidos"
  ON public.agendamento_anexos
  FOR SELECT
  TO authenticated
  USING (
    status = 'enviado'
    AND cliente_id IN (SELECT id FROM public.clientes WHERE user_id = auth.uid())
  );
-- Sem políticas de INSERT/UPDATE/DELETE para clientes: essas operações são
-- feitas exclusivamente pelo servidor após validação.

-- 4. Bucket privado com limite de tamanho e tipos permitidos (validação no servidor do Storage)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'orcamento-anexos',
  'orcamento-anexos',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE
  SET public = false,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 5. Políticas de acesso ao Storage (storage.objects)
DROP POLICY IF EXISTS "Admin lê anexos de orçamento" ON storage.objects;
CREATE POLICY "Admin lê anexos de orçamento"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'orcamento-anexos' AND public.is_admin());

DROP POLICY IF EXISTS "Admin remove anexos de orçamento" ON storage.objects;
CREATE POLICY "Admin remove anexos de orçamento"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'orcamento-anexos' AND public.is_admin());

DROP POLICY IF EXISTS "Cliente lê anexos dos seus pedidos" ON storage.objects;
CREATE POLICY "Cliente lê anexos dos seus pedidos"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'orcamento-anexos'
    AND EXISTS (
      SELECT 1
      FROM public.agendamento_anexos an
      JOIN public.clientes c ON c.id = an.cliente_id
      WHERE an.storage_path = storage.objects.name
        AND an.status = 'enviado'
        AND c.user_id = auth.uid()
    )
  );
