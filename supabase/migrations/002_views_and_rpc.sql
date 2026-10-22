-- ==============================================================================
-- MIGRATION 002: VIEWS E FUNÇÕES RPC SEGURAS (GS ELÉTRICA E MANUTENÇÃO - GILMAR SALES)
-- ==============================================================================

-- 1. View Estatísticas dos Clientes (para o painel de clientes, ranking e sumidos)
CREATE OR REPLACE VIEW public.v_clientes_estatisticas AS
SELECT 
  c.id,
  c.nome,
  c.whatsapp,
  c.data_nascimento,
  c.user_id,
  c.observacoes,
  c.criado_em,
  COUNT(a.id) FILTER (WHERE a.status = 'concluido')::INT AS visitas,
  COALESCE(SUM(a.valor_total) FILTER (WHERE a.status = 'concluido'), 0)::NUMERIC(10,2) AS total_gasto,
  MAX(a.inicio) FILTER (WHERE a.status = 'concluido') AS ultima_visita,
  CASE 
    WHEN MAX(a.inicio) FILTER (WHERE a.status = 'concluido') IS NULL THEN NULL
    ELSE EXTRACT(DAY FROM (timezone('America/Sao_Paulo'::text, now()) - MAX(a.inicio) FILTER (WHERE a.status = 'concluido')))::INT
  END AS dias_sem_vir,
  COUNT(m.id) FILTER (WHERE m.status = 'pendente')::INT AS multas_pendentes_qtd,
  COALESCE(SUM(m.valor) FILTER (WHERE m.status = 'pendente'), 0)::NUMERIC(10,2) AS multas_pendentes_valor,
  (
    SELECT s.nome 
    FROM public.agendamento_servicos asv
    JOIN public.agendamentos ag ON ag.id = asv.agendamento_id
    JOIN public.servicos s ON s.id = asv.servico_id
    WHERE ag.cliente_id = c.id AND ag.status = 'concluido'
    GROUP BY s.nome
    ORDER BY COUNT(*) DESC
    LIMIT 1
  ) AS servico_mais_usado
FROM public.clientes c
LEFT JOIN public.agendamentos a ON a.cliente_id = c.id
LEFT JOIN public.multas m ON m.cliente_id = c.id
GROUP BY c.id;

-- 2. RPC: Horários Disponíveis para uma Data Específica
-- Retorna slots livres no fuso America/Sao_Paulo sem expor dados privados
CREATE OR REPLACE FUNCTION public.horarios_disponiveis(p_data DATE)
RETURNS TABLE (
  inicio TIMESTAMPTZ,
  fim TIMESTAMPTZ,
  hora_formatada TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
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
BEGIN
  v_agora := timezone('America/Sao_Paulo'::text, now());
  
  -- Extrai dia da semana (0 = Domingo .. 6 = Sábado)
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

  -- Busca o horário de funcionamento para o dia da semana
  SELECT abre, fecha, ativo
  INTO v_abre, v_fecha, v_ativo
  FROM public.horario_funcionamento
  WHERE dia_semana = v_dia_semana;

  -- Se não funciona no dia, retorna vazio
  IF v_ativo IS NOT TRUE OR v_abre IS NULL OR v_fecha IS NULL THEN
    RETURN;
  END IF;

  -- Itera gerando os slots de duração configurada
  v_slot_inicio := (p_data || ' ' || v_abre)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
  
  WHILE v_slot_inicio + (v_duracao || ' minutes')::INTERVAL <= (p_data || ' ' || v_fecha)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo' LOOP
    v_slot_fim := v_slot_inicio + (v_duracao || ' minutes')::INTERVAL;

    -- 1. Ignorar se o slot já passou ou está dentro da antecedência mínima
    IF v_slot_inicio >= (v_agora + (v_antecedencia_horas || ' hours')::INTERVAL) THEN

      -- 2. Verificar se colide com algum bloqueio do Gilmar
      IF NOT EXISTS (
        SELECT 1 FROM public.bloqueios b
        WHERE tstzrange(b.inicio, b.fim) && tstzrange(v_slot_inicio, v_slot_fim)
      ) THEN

        -- 3. Verificar se colide com agendamento existente ativo
        IF NOT EXISTS (
          SELECT 1 FROM public.agendamentos a
          WHERE a.status NOT IN ('cancelado')
            AND tstzrange(a.inicio, a.fim) && tstzrange(v_slot_inicio, v_slot_fim)
        ) THEN

          -- 4. Verificar se colide com horário fixo de cliente
          IF NOT EXISTS (
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
      END IF;
    END IF;

    v_slot_inicio := v_slot_fim;
  END LOOP;

  RETURN;
END;
$$;

-- 3. RPC: Criar Agendamento Seguro (Calcula valor no banco, aplica regras de negócio)
CREATE OR REPLACE FUNCTION public.criar_agendamento(
  p_cliente_id UUID,
  p_servicos UUID[],
  p_inicio TIMESTAMPTZ,
  p_origem TEXT DEFAULT 'app',
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_duracao INT;
  v_fim TIMESTAMPTZ;
  v_bloquear_multa BOOLEAN;
  v_tem_multa_pendente BOOLEAN;
  v_valor_bruto NUMERIC(10,2) := 0;
  v_desconto NUMERIC(10,2) := 0;
  v_valor_final NUMERIC(10,2) := 0;
  v_agendamento_id UUID;
  v_servico RECORD;
  v_aniversario DATE;
  v_desconto_niver_ativo BOOLEAN;
  v_desconto_niver_pct NUMERIC(5,2);
  v_desconto_niver_regra TEXT;
  v_agora TIMESTAMPTZ;
  v_eh_aniversario BOOLEAN := false;
  v_combo_cabelo_barba_id UUID;
  v_combo_especial_id UUID;
  v_tem_corte BOOLEAN := false;
  v_tem_barba BOOLEAN := false;
  v_tem_sobrancelha BOOLEAN := false;
  v_tem_cavanhaque BOOLEAN := false;
BEGIN
  v_agora := timezone('America/Sao_Paulo'::text, now());

  -- Carrega configurações
  SELECT 
    COALESCE(duracao_horario_min, 60),
    bloquear_se_multa_pendente,
    desconto_aniversario_ativo,
    desconto_aniversario_percentual,
    desconto_aniversario_regra
  INTO 
    v_duracao,
    v_bloquear_multa,
    v_desconto_niver_ativo,
    v_desconto_niver_pct,
    v_desconto_niver_regra
  FROM public.configuracoes
  WHERE id = 1;

  v_fim := p_inicio + (v_duracao || ' minutes')::INTERVAL;

  -- Validação de multas pendentes
  IF v_bloquear_multa THEN
    SELECT EXISTS (
      SELECT 1 FROM public.multas 
      WHERE cliente_id = p_cliente_id AND status = 'pendente'
    ) INTO v_tem_multa_pendente;

    IF v_tem_multa_pendente THEN
      RAISE EXCEPTION 'Não é possível realizar novo agendamento com multas pendentes.';
    END IF;
  END IF;

  -- Identificação de itens para combo automático
  FOR v_servico IN 
    SELECT id, nome, preco, tipo FROM public.servicos WHERE id = ANY(p_servicos)
  LOOP
    v_valor_bruto := v_valor_bruto + v_servico.preco;
    IF lower(v_servico.nome) LIKE '%corte%' THEN v_tem_corte := true; END IF;
    IF lower(v_servico.nome) LIKE '%barba%' THEN v_tem_barba := true; END IF;
    IF lower(v_servico.nome) LIKE '%sobrancelha%' THEN v_tem_sobrancelha := true; END IF;
    IF lower(v_servico.nome) LIKE '%cavanhaque%' THEN v_tem_cavanhaque := true; END IF;
  END LOOP;

  -- Aplicação do Combo Especial (Corte 25 + Sobrancelha 5 + Cavanhaque 5 = 35 -> Combo 30 = Desc 5)
  IF v_tem_corte AND v_tem_sobrancelha AND v_tem_cavanhaque THEN
    v_desconto := v_desconto + 5.00;
  -- Aplicação do Combo Cabelo + Barba (Corte 25 + Barba 20 = 45 -> Combo 40 = Desc 5)
  ELSIF v_tem_corte AND v_tem_barba THEN
    v_desconto := v_desconto + 5.00;
  END IF;

  -- Validação de Aniversário
  SELECT data_nascimento INTO v_aniversario FROM public.clientes WHERE id = p_cliente_id;
  IF v_desconto_niver_ativo AND v_aniversario IS NOT NULL THEN
    IF v_desconto_niver_regra = 'mes' AND EXTRACT(MONTH FROM v_aniversario) = EXTRACT(MONTH FROM p_inicio) THEN
      v_eh_aniversario := true;
    ELSIF v_desconto_niver_regra = 'dia' AND 
          EXTRACT(MONTH FROM v_aniversario) = EXTRACT(MONTH FROM p_inicio) AND 
          EXTRACT(DAY FROM v_aniversario) = EXTRACT(DAY FROM p_inicio) THEN
      v_eh_aniversario := true;
    ELSIF v_desconto_niver_regra = 'semana' AND 
          EXTRACT(MONTH FROM v_aniversario) = EXTRACT(MONTH FROM p_inicio) AND 
          abs(EXTRACT(DAY FROM v_aniversario) - EXTRACT(DAY FROM p_inicio)) <= 3 THEN
      v_eh_aniversario := true;
    END IF;

    IF v_eh_aniversario THEN
      v_desconto := v_desconto + (v_valor_bruto * (v_desconto_niver_pct / 100.0));
    END IF;
  END IF;

  v_valor_final := GREATEST(0, v_valor_bruto - v_desconto);

  -- Inserir agendamento (a exclusion constraint do Postgres garante que não há sobreposição)
  INSERT INTO public.agendamentos (
    cliente_id,
    inicio,
    fim,
    status,
    origem,
    valor_total,
    desconto,
    observacao
  ) VALUES (
    p_cliente_id,
    p_inicio,
    v_fim,
    'agendado',
    p_origem,
    v_valor_final,
    v_desconto,
    p_observacao
  ) RETURNING id INTO v_agendamento_id;

  -- Vincular serviços agendados
  INSERT INTO public.agendamento_servicos (agendamento_id, servico_id, preco_cobrado)
  SELECT v_agendamento_id, s.id, s.preco
  FROM public.servicos s
  WHERE s.id = ANY(p_servicos);

  RETURN jsonb_build_object(
    'success', true,
    'agendamento_id', v_agendamento_id,
    'valor_total', v_valor_final,
    'desconto', v_desconto
  );
EXCEPTION
  WHEN exclusion_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Este horário acabou de ser reservado por outro cliente. Por favor, escolha outro horário.'
    );
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- 4. RPC: Cancelamento com Regra de 3h e Multa Automática de 50%
CREATE OR REPLACE FUNCTION public.cancelar_agendamento(
  p_id UUID,
  p_motivo TEXT DEFAULT NULL,
  p_cancelado_por TEXT DEFAULT 'cliente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agendamento RECORD;
  v_horas_limite INT;
  v_multa_pct NUMERIC(5,2);
  v_diferenca_horas NUMERIC;
  v_multa_valor NUMERIC(10,2) := 0;
  v_gerou_multa BOOLEAN := false;
  v_agora TIMESTAMPTZ;
BEGIN
  v_agora := timezone('America/Sao_Paulo'::text, now());

  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  IF v_agendamento.status = 'cancelado' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento já se encontra cancelado');
  END IF;

  SELECT 
    COALESCE(horas_cancelamento_gratis, 3),
    COALESCE(multa_percentual, 50.0)
  INTO v_horas_limite, v_multa_pct
  FROM public.configuracoes
  WHERE id = 1;

  -- Calcula antecedência em horas
  v_diferenca_horas := EXTRACT(EPOCH FROM (v_agendamento.inicio - v_agora)) / 3600.0;

  -- Se cancelou com menos de X horas (ou já passou do horário)
  IF v_diferenca_horas < v_horas_limite THEN
    v_multa_valor := (v_agendamento.valor_total * (v_multa_pct / 100.0));
    v_gerou_multa := true;

    INSERT INTO public.multas (cliente_id, agendamento_id, valor, status)
    VALUES (v_agendamento.cliente_id, v_agendamento.id, v_multa_valor, 'pendente');
  END IF;

  UPDATE public.agendamentos
  SET 
    status = 'cancelado',
    cancelado_em = v_agora,
    cancelado_por = p_cancelado_por,
    motivo_cancelamento = p_motivo
  WHERE id = p_id;

  RETURN jsonb_build_object(
    'success', true,
    'gerou_multa', v_gerou_multa,
    'valor_multa', v_multa_valor
  );
END;
$$;

-- 5. RPC: Marcar Não Compareceu (Gera multa automaticamente pelo admin)
CREATE OR REPLACE FUNCTION public.marcar_nao_compareceu(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agendamento RECORD;
  v_multa_pct NUMERIC(5,2);
  v_multa_valor NUMERIC(10,2);
BEGIN
  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  SELECT COALESCE(multa_percentual, 50.0) INTO v_multa_pct FROM public.configuracoes WHERE id = 1;
  v_multa_valor := (v_agendamento.valor_total * (v_multa_pct / 100.0));

  UPDATE public.agendamentos
  SET status = 'nao_compareceu'
  WHERE id = p_id;

  INSERT INTO public.multas (cliente_id, agendamento_id, valor, status)
  VALUES (v_agendamento.cliente_id, v_agendamento.id, v_multa_valor, 'pendente');

  RETURN jsonb_build_object('success', true, 'multa_gerada', v_multa_valor);
END;
$$;

-- 6. RPC: Concluir Atendimento (Gera lançamento financeiro automático e consome crédito)
CREATE OR REPLACE FUNCTION public.concluir_agendamento(
  p_id UUID,
  p_forma_pagamento TEXT,
  p_pago BOOLEAN DEFAULT true,
  p_usar_credito BOOLEAN DEFAULT false
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_agendamento RECORD;
  v_credito_id UUID;
BEGIN
  SELECT * INTO v_agendamento FROM public.agendamentos WHERE id = p_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agendamento não encontrado');
  END IF;

  -- Se for usar crédito pré-pago
  IF p_usar_credito THEN
    SELECT id INTO v_credito_id 
    FROM public.creditos
    WHERE cliente_id = v_agendamento.cliente_id AND saldo > 0
    ORDER BY criado_em ASC
    LIMIT 1;

    IF v_credito_id IS NOT NULL THEN
      UPDATE public.creditos SET saldo = saldo - 1 WHERE id = v_credito_id;
    END IF;
  END IF;

  UPDATE public.agendamentos
  SET 
    status = 'concluido',
    forma_pagamento = p_forma_pagamento,
    pago = p_pago,
    usou_credito = p_usar_credito
  WHERE id = p_id;

  -- Se o cliente pagou e não foi crédito pré-pago, lança no financeiro como entrada
  IF p_pago AND NOT p_usar_credito AND v_agendamento.valor_total > 0 THEN
    INSERT INTO public.lancamentos (
      tipo,
      categoria,
      descricao,
      valor,
      forma_pagamento,
      agendamento_id,
      cliente_id,
      data
    ) VALUES (
      'entrada',
      'Atendimento',
      'Atendimento concluído - ID: ' || substr(v_agendamento.id::text, 1, 8),
      v_agendamento.valor_total,
      p_forma_pagamento,
      v_agendamento.id,
      v_agendamento.cliente_id,
      CURRENT_DATE
    );
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 7. RPC: Gerar Agendamentos Recorrentes a partir de Horários Fixos
CREATE OR REPLACE FUNCTION public.gerar_agendamentos_fixos(p_semanas INT DEFAULT 4)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fixo RECORD;
  v_semana INT;
  v_data_alvo DATE;
  v_inicio TIMESTAMPTZ;
  v_fim TIMESTAMPTZ;
  v_duracao INT;
  v_preco NUMERIC(10,2);
  v_criados INT := 0;
  v_agora TIMESTAMPTZ;
BEGIN
  v_agora := timezone('America/Sao_Paulo'::text, now());
  SELECT COALESCE(duracao_horario_min, 60) INTO v_duracao FROM public.configuracoes WHERE id = 1;

  FOR v_fixo IN 
    SELECT hf.*, s.preco 
    FROM public.horarios_fixos hf
    JOIN public.servicos s ON s.id = hf.servico_id
    WHERE hf.ativo = true
  LOOP
    FOR v_semana IN 0..(p_semanas - 1) LOOP
      -- Calcula a próxima data correspondente ao dia da semana
      v_data_alvo := (v_agora::DATE + ((v_fixo.dia_semana - EXTRACT(DOW FROM v_agora)::INT + 7) % 7) + (v_semana * 7));
      v_inicio := (v_data_alvo || ' ' || v_fixo.hora)::TIMESTAMP AT TIME ZONE 'America/Sao_Paulo';
      v_fim := v_inicio + (v_duracao || ' minutes')::INTERVAL;

      -- Não criar agendamentos no passado
      IF v_inicio > v_agora THEN
        -- Verificar se já existe agendamento neste horário
        IF NOT EXISTS (
          SELECT 1 FROM public.agendamentos
          WHERE horario_fixo_id = v_fixo.id AND inicio = v_inicio
        ) AND NOT EXISTS (
          SELECT 1 FROM public.agendamentos
          WHERE status NOT IN ('cancelado') AND tstzrange(inicio, fim) && tstzrange(v_inicio, v_fim)
        ) THEN
          INSERT INTO public.agendamentos (
            cliente_id,
            inicio,
            fim,
            status,
            origem,
            horario_fixo_id,
            valor_total
          ) VALUES (
            v_fixo.cliente_id,
            v_inicio,
            v_fim,
            'agendado',
            'fixo',
            v_fixo.id,
            v_fixo.preco
          );
          v_criados := v_criados + 1;
        END IF;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_criados;
END;
$$;

-- 8. PERMISSÕES EXPLÍCITAS DE EXECUÇÃO E RECARREGAMENTO DE CACHE DO POSTGREST
GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO postgres, anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.criar_agendamento(UUID, UUID[], TIMESTAMPTZ, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.horarios_disponiveis(DATE) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.cancelar_agendamento(UUID, TEXT, TEXT) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.concluir_agendamento(UUID, TEXT, BOOLEAN, BOOLEAN) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';

