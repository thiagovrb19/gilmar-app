-- ==============================================================================
-- RESET TOTAL DO BANCO (GS ELÉTRICA) - APAGA TUDO DO APP. SEM VOLTA.
-- Apaga: clientes, agendamentos, orçamentos, anexos (registros), financeiro,
--        estoque, serviços, configurações, funções, trigger e políticas do app,
--        e TODOS os usuários do Authentication (admins e clientes).
-- Depois rode, UM POR UM e nesta ordem, os arquivos de supabase/migrations/:
--   001, 002, 003, 004, 005, 006, 007 e por último 008_correcoes_gerais.sql
-- (no 001, apague a linha "CREATE EXTENSION IF NOT EXISTS pg_cron;")
-- Os ARQUIVOS de imagem do Storage não são apagados por SQL: esvazie o bucket
-- "orcamento-anexos" em Storage, se quiser.
-- ==============================================================================

BEGIN;

-- 1. Trigger de cadastro no Auth
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- 2. Views
DROP VIEW IF EXISTS public.v_clientes_estatisticas CASCADE;
DROP VIEW IF EXISTS public.v_estoque_receita CASCADE;

-- 3. Tabelas do app
DROP TABLE IF EXISTS
  public.agendamento_anexos,
  public.agendamento_servicos,
  public.avaliacoes,
  public.multas,
  public.lancamentos,
  public.creditos,
  public.agendamentos,
  public.horarios_fixos,
  public.bloqueios,
  public.dias_excecao,
  public.horario_funcionamento,
  public.combo_itens,
  public.estoque_pecas,
  public.configuracoes,
  public.servicos,
  public.profiles,
  public.clientes
CASCADE;

-- 4. Funções do app
DROP FUNCTION IF EXISTS public.horarios_disponiveis(DATE) CASCADE;
DROP FUNCTION IF EXISTS public.criar_agendamento(UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.cancelar_agendamento(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.marcar_nao_compareceu(UUID) CASCADE;
DROP FUNCTION IF EXISTS public.concluir_agendamento(UUID, TEXT, BOOLEAN, BOOLEAN) CASCADE;
DROP FUNCTION IF EXISTS public.gerar_agendamentos_fixos(INT) CASCADE;
DROP FUNCTION IF EXISTS public.limitar_anexos_por_agendamento() CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_auth_user() CASCADE;
DROP FUNCTION IF EXISTS public.is_admin() CASCADE;

-- 5. Políticas do Storage criadas pelo app
DROP POLICY IF EXISTS "Admin lê anexos de orçamento" ON storage.objects;
DROP POLICY IF EXISTS "Admin remove anexos de orçamento" ON storage.objects;
DROP POLICY IF EXISTS "Cliente lê anexos dos seus pedidos" ON storage.objects;

-- 6. Usuários do Authentication (admins e clientes)
DELETE FROM auth.users;

COMMIT;

NOTIFY pgrst, 'reload schema';
