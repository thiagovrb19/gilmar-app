-- ==============================================================================
-- MIGRATION 004: DIAS DE EXCEÇÃO (FERIADOS, FOLGAS E HORÁRIOS PERSONALIZADOS)
-- ==============================================================================

-- 1. Criar tabela de dias de exceção
CREATE TABLE IF NOT EXISTS public.dias_excecao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  data DATE NOT NULL UNIQUE,
  tipo TEXT NOT NULL CHECK (tipo IN ('fechado', 'personalizado')),
  motivo TEXT,
  abre TIME,
  fecha TIME,
  horarios_especificos TEXT[],
  criado_em TIMESTAMPTZ DEFAULT timezone('America/Sao_Paulo'::text, now()) NOT NULL
);

-- Índices para busca rápida por data
CREATE INDEX IF NOT EXISTS idx_dias_excecao_data ON public.dias_excecao (data);

-- 2. Habilitar RLS
ALTER TABLE public.dias_excecao ENABLE ROW LEVEL SECURITY;

-- Política de leitura: qualquer usuário (inclusive clientes não logados) pode ler para saber horários
DROP POLICY IF EXISTS "Leitura pública de dias de exceção" ON public.dias_excecao;
CREATE POLICY "Leitura pública de dias de exceção"
  ON public.dias_excecao
  FOR SELECT
  TO public
  USING (true);

-- Política de escrita: somente admin pode inserir, atualizar ou excluir
DROP POLICY IF EXISTS "Admin pode gerenciar dias de exceção" ON public.dias_excecao;
CREATE POLICY "Admin pode gerenciar dias de exceção"
  ON public.dias_excecao
  FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 3. Atualizar a função RPC horarios_disponiveis para respeitar dias de exceção
CREATE OR REPLACE FUNCTION public.horarios_disponiveis(p_data DATE)
RETURNS TABLE (
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  hora_formatada TEXT
)
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
  v_agora TIMESTAMPTZ;
  v_data_limite DATE;
  v_excecao_tipo TEXT;
  v_excecao_horarios TEXT[];
  v_hora_item TEXT;
BEGIN
  v_agora := timezone('America/Sao_Paulo'::text, now());
  v_dia_semana := EXTRACT(DOW FROM p_data);

  -- Carrega configurações
  SELECT 
    COALESCE(duracao_horario_min, 60),
    COALESCE(antecedencia_minima_horas, 1),
    COALESCE(janela_dias, 30)
  INTO v_duracao, v_antecedencia_horas, v_janela_dias
  FROM public.configuracoes
  WHERE id = 1;

  v_data_limite := (v_agora::DATE + v_janela_dias);

  -- Valida se a data está no passado ou além da janela configurada
  IF p_data < v_agora::DATE OR p_data > v_data_limite THEN
    RETURN;
  END IF;

  -- Verifica se existe registro de dia de exceção para a data
  SELECT tipo, abre, fecha, horarios_especificos
  INTO v_excecao_tipo, v_abre, v_fecha, v_excecao_horarios
  FROM public.dias_excecao
  WHERE data = p_data;

  -- Se for dia fechado (Feriado, imprevisto ou folga), retorna vazio
  IF v_excecao_tipo = 'fechado' THEN
    RETURN;
  END IF;

  -- Se for horário personalizado com lista explícita de horários
  IF v_excecao_tipo = 'personalizado' AND v_excecao_horarios IS NOT NULL AND array_length(v_excecao_horarios, 1) > 0 THEN
    FOREACH v_hora_item IN ARRAY v_excecao_horarios LOOP
      v_slot_inicio := (p_data || ' ' || v_hora_item || ':00')::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
      v_slot_fim := v_slot_inicio + (v_duracao || ' minutes')::INTERVAL;

      IF v_slot_inicio >= (v_agora + (v_antecedencia_horas || ' hours')::INTERVAL) THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.bloqueios b
          WHERE tstzrange(b.inicio, b.fim) && tstzrange(v_slot_inicio, v_slot_fim)
        ) AND NOT EXISTS (
          SELECT 1 FROM public.agendamentos a
          WHERE a.status NOT IN ('cancelado')
            AND tstzrange(a.inicio, a.fim) && tstzrange(v_slot_inicio, v_slot_fim)
        ) AND NOT EXISTS (
          SELECT 1 FROM public.horarios_fixos hf
          WHERE hf.ativo = true
            AND hf.dia_semana = v_dia_semana
            AND hf.hora = (v_slot_inicio AT TIME ZONE 'America/Sao_Paulo')::TIME
        ) THEN
          inicio := v_slot_inicio;
          fim := v_slot_fim;
          hora_formatada := TO_CHAR(v_slot_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
          RETURN NEXT;
        END IF;
      END IF;
    END LOOP;
    RETURN;
  END IF;

  -- Caso contrário, se v_abre e v_fecha não foram definidos pela exceção, buscar da grade semanal
  IF v_abre IS NULL OR v_fecha IS NULL THEN
    SELECT abre, fecha, ativo
    INTO v_abre, v_fecha, v_ativo
    FROM public.horario_funcionamento
    WHERE dia_semana = v_dia_semana;

    IF v_ativo IS NOT TRUE OR v_abre IS NULL OR v_fecha IS NULL THEN
      RETURN;
    END IF;
  END IF;

  -- Itera gerando os slots de duração configurada
  v_slot_inicio := (p_data || ' ' || v_abre)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
  
  WHILE v_slot_inicio + (v_duracao || ' minutes')::INTERVAL <= (p_data || ' ' || v_fecha)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' LOOP
    v_slot_fim := v_slot_inicio + (v_duracao || ' minutes')::INTERVAL;

    IF v_slot_inicio >= (v_agora + (v_antecedencia_horas || ' hours')::INTERVAL) THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.bloqueios b
        WHERE tstzrange(b.inicio, b.fim) && tstzrange(v_slot_inicio, v_slot_fim)
      ) AND NOT EXISTS (
        SELECT 1 FROM public.agendamentos a
        WHERE a.status NOT IN ('cancelado')
          AND tstzrange(a.inicio, a.fim) && tstzrange(v_slot_inicio, v_slot_fim)
      ) AND NOT EXISTS (
        SELECT 1 FROM public.horarios_fixos hf
        WHERE hf.ativo = true
          AND hf.dia_semana = v_dia_semana
          AND hf.hora = (v_slot_inicio AT TIME ZONE 'America/Sao_Paulo')::TIME
      ) THEN
        inicio := v_slot_inicio;
        fim := v_slot_fim;
        hora_formatada := TO_CHAR(v_slot_inicio AT TIME ZONE 'America/Sao_Paulo', 'HH24:MI');
        RETURN NEXT;
      END IF;
    END IF;

    v_slot_inicio := v_slot_fim;
  END LOOP;

  RETURN;
END;
$$;
