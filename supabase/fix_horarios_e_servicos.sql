-- ==============================================================================
-- CORREÇÃO DEFINITIVA: FUSO HORÁRIO DE CLIENTES & RECARGA DE SCHEMA
-- GS Elétrica e Manutenção - Gilmar Sales (Executar no SQL Editor do Supabase)
-- ==============================================================================

-- 1. Atualizar a RPC horarios_disponiveis com o fuso horário correto de Brasília (America/Sao_Paulo)
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

-- 2. Permissões explícitas de execução
GRANT EXECUTE ON FUNCTION public.horarios_disponiveis(DATE) TO anon, authenticated, service_role;

-- 3. Garantir permissões completas na tabela de serviços
GRANT ALL ON TABLE public.servicos TO postgres, anon, authenticated, service_role;
GRANT ALL ON TABLE public.combo_itens TO postgres, anon, authenticated, service_role;

-- 4. Garantir que os serviços padrão existem no banco (sem sobrescrever nenhuma alteração já feita)
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
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  preco = EXCLUDED.preco,
  tipo = EXCLUDED.tipo,
  ordem = EXCLUDED.ordem,
  icone = EXCLUDED.icone;

-- 5. Notificar o PostgREST para recarregar o cache do schema imediatamente
NOTIFY pgrst, 'reload schema';

