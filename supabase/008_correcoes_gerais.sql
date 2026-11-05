-- ==============================================================================
-- MIGRATION 008: CORREÇÕES GERAIS DO BANCO (GS ELÉTRICA E MANUTENÇÃO)
-- ==============================================================================
-- COMO RODAR: Supabase > SQL Editor > New query > cole TUDO > Run.
-- É IDEMPOTENTE: pode rodar mais de uma vez sem duplicar nem perder dados.
-- Não apaga clientes, agendamentos, orçamentos nem serviços já existentes.
--
-- O que corrige:
--   1. Tabelas de apoio vazias (configuracoes e horario_funcionamento) -> agenda sem horários
--   2. Erro "no unique constraint matching ON CONFLICT" que derrubava scripts anteriores
--   3. Colunas da proposta comercial e tabela de estoque (caso 006 não tenha rodado)
--   4. Fuso horário errado (3h) em horarios_disponiveis e cancelar_agendamento
--   5. FALHA GRAVE: qualquer e-mail cadastrado virava ADMIN (trigger handle_new_auth_user)
--   6. Permissões abertas demais para o papel anônimo (anon) - dados de clientes expostos
--   7. Views que ignoravam o RLS (clientes e estoque visíveis publicamente)
--   8. Resíduos de barbearia no seed (combo fantasma)
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. HORÁRIO DE FUNCIONAMENTO: garantir 1 linha por dia e popular
-- ------------------------------------------------------------------------------
-- Remove duplicatas (mantém a mais antiga por dia) antes de criar a restrição
DELETE FROM public.horario_funcionamento h
USING public.horario_funcionamento h2
WHERE h.dia_semana = h2.dia_semana
  AND h.ctid > h2.ctid;

CREATE UNIQUE INDEX IF NOT EXISTS uq_horario_funcionamento_dia
  ON public.horario_funcionamento (dia_semana);

INSERT INTO public.horario_funcionamento (dia_semana, abre, fecha, ativo)
VALUES
  (0, '08:00', '12:00', false),  -- Domingo fechado
  (1, '07:00', '18:00', true),
  (2, '07:00', '18:00', true),
  (3, '07:00', '18:00', true),
  (4, '07:00', '18:00', true),
  (5, '07:00', '18:00', true),
  (6, '07:00', '13:00', true)    -- Sábado
ON CONFLICT (dia_semana) DO NOTHING;   -- não sobrescreve ajustes feitos pelo Gilmar

-- ------------------------------------------------------------------------------
-- 2. CONFIGURAÇÕES GLOBAIS (linha única)
-- ------------------------------------------------------------------------------
INSERT INTO public.configuracoes (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

UPDATE public.configuracoes
SET whatsapp_contato = '553288714986'
WHERE id = 1 AND whatsapp_contato IN ('32988714986', '');

-- ------------------------------------------------------------------------------
-- 3. SERVIÇOS PADRÃO (não sobrescreve preço/descrição editados pelo admin)
-- ------------------------------------------------------------------------------
INSERT INTO public.servicos (id, nome, descricao, preco, duracao_min, icone, tipo, ativo, ordem)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Troca de lâmpadas e luminárias', 'Troca de lâmpadas, luminárias simples e spots.', 50.00, 45, 'lampada', 'avulso', true, 1),
  ('c0000000-0000-0000-0000-000000000002', 'Troca de chuveiro', 'Desinstalação do chuveiro antigo e instalação do novo.', 120.00, 60, 'chuveiro', 'avulso', true, 2),
  ('c0000000-0000-0000-0000-000000000003', 'Troca de tomadas e interruptores', 'Troca de tomadas ou interruptores simples.', 40.00, 30, 'tomada', 'avulso', true, 3),
  ('c0000000-0000-0000-0000-000000000004', 'Troca de disjuntor', 'Substituição de disjuntor no quadro de distribuição.', 60.00, 45, 'quadro', 'avulso', true, 4),
  ('c0000000-0000-0000-0000-000000000005', 'Instalação de tomadas e interruptores', 'Instalação de novos pontos de tomadas ou interruptores.', 90.00, 60, 'tomada', 'avulso', true, 5),
  ('c0000000-0000-0000-0000-000000000006', 'Instalação de ventiladores e luminárias', 'Instalação completa de ventiladores ou luminárias.', 120.00, 90, 'lampada', 'avulso', true, 6),
  ('c0000000-0000-0000-0000-000000000007', 'Ligação de padrão (monofásico)', 'Instalação do padrão de entrada monofásico.', 450.00, 180, 'padrao', 'avulso', true, 7),
  ('c0000000-0000-0000-0000-000000000008', 'Ligação de padrão (trifásico)', 'Instalação do padrão de entrada trifásico.', 750.00, 240, 'padrao', 'avulso', true, 8),
  ('c0000000-0000-0000-0000-000000000009', 'Montagem de quadro de distribuição', 'Montagem completa de quadro de distribuição.', 600.00, 180, 'quadro', 'avulso', true, 9),
  ('c0000000-0000-0000-0000-000000000010', 'Manutenção elétrica industrial', 'Manutenção preventiva e corretiva em máquinas e painéis industriais (R$ 60,00/h).', 60.00, 60, 'industrial', 'avulso', true, 10),
  ('c0000000-0000-0000-0000-000000000011', 'Instalação de motores elétricos', 'Instalação e ligação de motores monofásicos ou trifásicos.', 250.00, 120, 'industrial', 'avulso', true, 11),
  ('c0000000-0000-0000-0000-000000000012', 'Instalação de inversores de frequência', 'Instalação e parametrização básica de inversores de frequência.', 400.00, 120, 'industrial', 'avulso', true, 12)
ON CONFLICT (id) DO NOTHING;

-- Remove o "combo" fantasma criado pelo seed antigo (Montagem de quadro não é combo)
DELETE FROM public.combo_itens
WHERE combo_id = 'c0000000-0000-0000-0000-000000000009';

-- ------------------------------------------------------------------------------
-- 4. PROPOSTA COMERCIAL (006) E ESTOQUE - garante que existem
-- ------------------------------------------------------------------------------
ALTER TABLE public.agendamentos
  ADD COLUMN IF NOT EXISTS proposta_subtitulo TEXT,
  ADD COLUMN IF NOT EXISTS proposta_objetivo TEXT,
  ADD COLUMN IF NOT EXISTS proposta_condicoes_pagamento TEXT,
  ADD COLUMN IF NOT EXISTS cliente_localidade TEXT,
  ADD COLUMN IF NOT EXISTS proposta_itens_json JSONB DEFAULT '[]'::jsonb;

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
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_ordem ON public.estoque_pecas (ativo, ordem, nome);
ALTER TABLE public.estoque_pecas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin gerencia estoque_pecas" ON public.estoque_pecas;
CREATE POLICY "Admin gerencia estoque_pecas" ON public.estoque_pecas
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE OR REPLACE VIEW public.v_estoque_receita AS
SELECT id, nome AS item, categoria, valor_unitario AS valor, quantidade AS estoque,
       ROUND(valor_unitario * quantidade, 2) AS receita, estoque_minimo, unidade,
       observacao, ordem, ativo, atualizado_em
FROM public.estoque_pecas
WHERE ativo = true
ORDER BY ordem ASC, nome ASC;

-- ------------------------------------------------------------------------------
-- 5. VIEW DE ESTATÍSTICAS DE CLIENTES (versão com orçamentos) - respeitando RLS
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS public.v_clientes_estatisticas;
CREATE VIEW public.v_clientes_estatisticas
WITH (security_invoker = true) AS
SELECT
  c.id, c.nome, c.whatsapp, c.data_nascimento, c.user_id, c.observacoes, c.criado_em,
  COALESCE(ag.visitas, 0)::INT AS visitas,
  COALESCE(ag.total_gasto, 0)::NUMERIC(10,2) AS total_gasto,
  ag.ultima_visita,
  CASE WHEN ag.ultima_visita IS NOT NULL
       THEN EXTRACT(DAY FROM (now() - ag.ultima_visita))::INT END AS dias_sem_vir,
  COALESCE(mu.qtd, 0)::INT AS multas_pendentes_qtd,
  COALESCE(mu.valor, 0)::NUMERIC(10,2) AS multas_pendentes_valor,
  COALESCE(ag.total_orcamentos, 0)::INT AS total_orcamentos,
  COALESCE(ag.valor_total_orcamentos, 0)::NUMERIC(10,2) AS valor_total_orcamentos
FROM public.clientes c
LEFT JOIN LATERAL (
  SELECT
    COUNT(*) FILTER (WHERE a.status = 'concluido') AS visitas,
    SUM(a.valor_total) FILTER (WHERE a.status = 'concluido') AS total_gasto,
    MAX(a.inicio) FILTER (WHERE a.status <> 'cancelado') AS ultima_visita,
    COUNT(*) FILTER (WHERE a.status <> 'cancelado') AS total_orcamentos,
    SUM(a.valor_total) FILTER (WHERE a.status <> 'cancelado') AS valor_total_orcamentos
  FROM public.agendamentos a WHERE a.cliente_id = c.id
) ag ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS qtd, SUM(m.valor) AS valor
  FROM public.multas m WHERE m.cliente_id = c.id AND m.status = 'pendente'
) mu ON true;

ALTER VIEW public.v_estoque_receita SET (security_invoker = true);

-- ------------------------------------------------------------------------------
-- 6. FUSO HORÁRIO: horarios_disponiveis e cancelar_agendamento
--    (antes: timezone('America/Sao_Paulo', now()) gerava um horário 3h ATRASADO)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.horarios_disponiveis(p_data DATE)
RETURNS TABLE (inicio TIMESTAMPTZ, fim TIMESTAMPTZ, hora_formatada TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_dia_semana INT;
  v_abre TIME;
  v_fecha TIME;
  v_ativo BOOLEAN;
  v_duracao INT;
  v_antecedencia_horas INT;
  v_janela_dias INT;
  v_slot_inicio TIMESTAMPTZ;
  v_slot_fim TIMESTAMPTZ;
  v_agora TIMESTAMPTZ := now();
  v_hoje DATE := (now() AT TIME ZONE 'America/Sao_Paulo')::DATE;
  v_excecao_tipo TEXT;
  v_excecao_horarios TEXT[];
  v_hora_item TEXT;
BEGIN
  v_dia_semana := EXTRACT(DOW FROM p_data);

  SELECT COALESCE(duracao_horario_min, 60), COALESCE(antecedencia_minima_horas, 1), COALESCE(janela_dias, 30)
  INTO v_duracao, v_antecedencia_horas, v_janela_dias
  FROM public.configuracoes WHERE id = 1;

  v_duracao := COALESCE(v_duracao, 60);
  v_antecedencia_horas := COALESCE(v_antecedencia_horas, 1);
  v_janela_dias := COALESCE(v_janela_dias, 30);

  IF p_data < v_hoje OR p_data > v_hoje + v_janela_dias THEN
    RETURN;
  END IF;

  SELECT tipo, abre, fecha, horarios_especificos
  INTO v_excecao_tipo, v_abre, v_fecha, v_excecao_horarios
  FROM public.dias_excecao WHERE data = p_data;

  IF v_excecao_tipo = 'fechado' THEN
    RETURN;
  END IF;

  -- Horários personalizados em lista
  IF v_excecao_tipo = 'personalizado' AND v_excecao_horarios IS NOT NULL AND array_length(v_excecao_horarios, 1) > 0 THEN
    FOREACH v_hora_item IN ARRAY v_excecao_horarios LOOP
      v_slot_inicio := (p_data::TEXT || ' ' || v_hora_item || ':00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
      v_slot_fim := v_slot_inicio + (v_duracao || ' minutes')::INTERVAL;
      IF v_slot_inicio >= (v_agora + (v_antecedencia_horas || ' hours')::INTERVAL)
         AND NOT EXISTS (SELECT 1 FROM public.bloqueios b WHERE tstzrange(b.inicio, b.fim) && tstzrange(v_slot_inicio, v_slot_fim))
         AND NOT EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.status <> 'cancelado' AND tstzrange(a.inicio, a.fim) && tstzrange(v_slot_inicio, v_slot_fim))
         AND NOT EXISTS (SELECT 1 FROM public.horarios_fixos hf WHERE hf.ativo AND hf.dia_semana = v_dia_semana AND hf.hora = (v_slot_inicio AT TIME ZONE 'America/Sao_Paulo')::TIME)
      THEN
        inicio := v_slot_inicio; fim := v_slot_fim;
        hora_formatada := TO_CHAR(v_slot_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
        RETURN NEXT;
      END IF;
    END LOOP;
    RETURN;
  END IF;

  -- Grade semanal (ou abre/fecha da exceção)
  IF v_abre IS NULL OR v_fecha IS NULL THEN
    SELECT abre, fecha, ativo INTO v_abre, v_fecha, v_ativo
    FROM public.horario_funcionamento WHERE dia_semana = v_dia_semana;
    IF v_ativo IS NOT TRUE OR v_abre IS NULL OR v_fecha IS NULL THEN
      RETURN;
    END IF;
  END IF;

  v_slot_inicio := (p_data::TEXT || ' ' || v_abre::TEXT)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';

  WHILE v_slot_inicio + (v_duracao || ' minutes')::INTERVAL <= (p_data::TEXT || ' ' || v_fecha::TEXT)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' LOOP
    v_slot_fim := v_slot_inicio + (v_duracao || ' minutes')::INTERVAL;
    IF v_slot_inicio >= (v_agora + (v_antecedencia_horas || ' hours')::INTERVAL)
       AND NOT EXISTS (SELECT 1 FROM public.bloqueios b WHERE tstzrange(b.inicio, b.fim) && tstzrange(v_slot_inicio, v_slot_fim))
       AND NOT EXISTS (SELECT 1 FROM public.agendamentos a WHERE a.status <> 'cancelado' AND tstzrange(a.inicio, a.fim) && tstzrange(v_slot_inicio, v_slot_fim))
       AND NOT EXISTS (SELECT 1 FROM public.horarios_fixos hf WHERE hf.ativo AND hf.dia_semana = v_dia_semana AND hf.hora = (v_slot_inicio AT TIME ZONE 'America/Sao_Paulo')::TIME)
    THEN
      inicio := v_slot_inicio; fim := v_slot_fim;
      hora_formatada := TO_CHAR(v_slot_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
      RETURN NEXT;
    END IF;
    v_slot_inicio := v_slot_fim;
  END LOOP;
  RETURN;
END;
$$;

CREATE OR REPLACE FUNCTION public.cancelar_agendamento(
  p_id UUID, p_motivo TEXT DEFAULT NULL, p_cancelado_por TEXT DEFAULT 'cliente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_agendamento RECORD;
  v_horas_limite INT;
  v_multa_pct NUMERIC(5,2);
  v_diferenca_horas NUMERIC;
  v_multa_valor NUMERIC(10,2) := 0;
  v_gerou_multa BOOLEAN := false;
  v_agora TIMESTAMPTZ := now();
BEGIN
  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;
  IF v_agendamento.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento já se encontra cancelado');
  END IF;

  SELECT COALESCE(horas_cancelamento_gratis, 3), COALESCE(multa_percentual, 50.0)
  INTO v_horas_limite, v_multa_pct FROM public.configuracoes WHERE id = 1;
  v_horas_limite := COALESCE(v_horas_limite, 3);
  v_multa_pct := COALESCE(v_multa_pct, 50.0);

  v_diferenca_horas := EXTRACT(EPOCH FROM (v_agendamento.inicio - v_agora)) / 3600.0;

  IF v_diferenca_horas < v_horas_limite THEN
    v_multa_valor := (v_agendamento.valor_total * (v_multa_pct / 100.0));
    v_gerou_multa := true;
    INSERT INTO public.multas (cliente_id, agendamento_id, valor, status)
    VALUES (v_agendamento.cliente_id, v_agendamento.id, v_multa_valor, 'pendente');
  END IF;

  UPDATE public.agendamentos
  SET status = 'cancelado', cancelado_em = v_agora, cancelado_por = p_cancelado_por, motivo_cancelamento = p_motivo
  WHERE id = p_id;

  RETURN jsonb_build_object('success', true, 'gerou_multa', v_gerou_multa, 'valor_multa', v_multa_valor);
END;
$$;

-- ------------------------------------------------------------------------------
-- 7. FALHA GRAVE: novo usuário com e-mail comum virava ADMIN. Agora vira 'cliente'.
--    Para criar um admin, use o bloco comentado no final deste arquivo.
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_phone TEXT;
  v_cliente_id UUID;
BEGIN
  IF NEW.email LIKE '%@cliente.gseletrica.app' OR NEW.email LIKE '%@cliente.barbeariadoluiz.app' THEN
    v_phone := split_part(NEW.email, '@', 1);
    SELECT id INTO v_cliente_id FROM public.clientes WHERE whatsapp = v_phone LIMIT 1;

    IF v_cliente_id IS NOT NULL THEN
      UPDATE public.clientes
      SET user_id = NEW.id,
          nome = COALESCE(NEW.raw_user_meta_data->>'nome', nome),
          data_nascimento = COALESCE(NULLIF(NEW.raw_user_meta_data->>'data_nascimento', '')::DATE, data_nascimento)
      WHERE id = v_cliente_id;
    ELSE
      INSERT INTO public.clientes (nome, whatsapp, user_id, data_nascimento)
      VALUES (COALESCE(NEW.raw_user_meta_data->>'nome', 'Cliente'), v_phone, NEW.id,
              NULLIF(NEW.raw_user_meta_data->>'data_nascimento', '')::DATE)
      RETURNING id INTO v_cliente_id;
    END IF;

    INSERT INTO public.profiles (id, role, cliente_id)
    VALUES (NEW.id, 'cliente', v_cliente_id)
    ON CONFLICT (id) DO UPDATE SET cliente_id = v_cliente_id;
  ELSE
    -- Qualquer outro e-mail NUNCA vira admin automaticamente
    INSERT INTO public.profiles (id, role) VALUES (NEW.id, 'cliente')
    ON CONFLICT (id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Cadastro de cliente: só pode criar ficha vinculada ao próprio usuário logado
DROP POLICY IF EXISTS "Permitir inserção de novo cliente durante cadastro" ON public.clientes;
CREATE POLICY "Permitir inserção de novo cliente durante cadastro"
  ON public.clientes FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_admin());

-- Bloqueios podem conter motivos privados: só admin lê (o servidor usa service_role)
DROP POLICY IF EXISTS "Leitura pública de bloqueios" ON public.bloqueios;

-- ------------------------------------------------------------------------------
-- 8. PERMISSÕES: fechar o que estava aberto para o papel anônimo (anon)
-- ------------------------------------------------------------------------------
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;

-- O site público precisa ler apenas estas tabelas:
GRANT SELECT ON public.servicos, public.combo_itens, public.horario_funcionamento,
               public.configuracoes, public.dias_excecao, public.avaliacoes TO anon;

-- Funções sensíveis: só o servidor (service_role) pode executar
REVOKE EXECUTE ON FUNCTION public.criar_agendamento(UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.cancelar_agendamento(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.concluir_agendamento(UUID, TEXT, BOOLEAN, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.marcar_nao_compareceu(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gerar_agendamentos_fixos(INT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.criar_agendamento(UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_agendamento(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.concluir_agendamento(UUID, TEXT, BOOLEAN, BOOLEAN) TO service_role;
GRANT EXECUTE ON FUNCTION public.marcar_nao_compareceu(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.gerar_agendamentos_fixos(INT) TO service_role;

-- Consulta de horários é pública (não expõe dados privados)
GRANT EXECUTE ON FUNCTION public.horarios_disponiveis(DATE) TO anon, authenticated, service_role;

-- service_role e usuários logados mantêm acesso (o RLS continua protegendo os logados)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

COMMIT;

NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- VERIFICAÇÕES (rode separadamente depois, são só consultas)
-- ==============================================================================
-- a) Deve retornar 7 linhas:
--    SELECT * FROM public.horario_funcionamento ORDER BY dia_semana;
-- b) Deve retornar 1 linha:
--    SELECT id, whatsapp_contato, janela_dias FROM public.configuracoes;
-- c) Deve retornar horários (troque a data por um dia útil futuro):
--    SELECT * FROM public.horarios_disponiveis(CURRENT_DATE + 2);
-- d) QUEM É ADMIN HOJE? Confira se só aparecem pessoas esperadas (se aparecer
--    alguém desconhecido, rebaixe: UPDATE public.profiles SET role='cliente' WHERE id='...'):
--    SELECT p.id, u.email, p.role, p.criado_em FROM public.profiles p
--    JOIN auth.users u ON u.id = p.id WHERE p.role = 'admin';
--
-- COMO CRIAR/PROMOVER UM ADMIN (substitua o e-mail):
--    UPDATE public.profiles SET role = 'admin'
--    WHERE id = (SELECT id FROM auth.users WHERE email = 'email-do-admin@exemplo.com');
-- ==============================================================================
