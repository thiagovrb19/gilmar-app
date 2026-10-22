-- ==============================================================================
-- CORREÇÃO IMEDIATA: PERMISSÕES E RECARREGAMENTO DE CACHE DO POSTGREST
-- Execute este script no SQL Editor do Supabase para corrigir o erro PGRST125
-- ("Invalid path specified in request URL")
-- ==============================================================================

-- 1. Garante permissões completas no schema public para os papéis de API
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

-- 2. Permissão explícita de execução para as Stored Procedures utilizadas pelo App
GRANT EXECUTE ON FUNCTION public.criar_agendamento(UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.horarios_disponiveis(DATE) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_agendamento(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.concluir_agendamento(UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated, service_role;

-- 3. Notifica o motor de API do Supabase (PostgREST) para atualizar o cache de rotas e tabelas
NOTIFY pgrst, 'reload schema';
