-- ==============================================================================
-- SEED DE DADOS INICIAIS — BARBEARIA DO LUIZ
-- ==============================================================================

-- 1. Inserir Serviços Individuais (Tabela da Seção 2)
INSERT INTO public.servicos (id, nome, descricao, preco, duracao_min, icone, tipo, ativo, ordem)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Corte (máquina e tesoura)', 'Corte moderno ou clássico com acabamento perfeito', 25.00, 60, 'corte', 'avulso', true, 1),
  ('c0000000-0000-0000-0000-000000000002', 'Barba', 'Desenho e alinhamento com toalha quente e navalha', 20.00, 60, 'barba', 'avulso', true, 2),
  ('c0000000-0000-0000-0000-000000000003', 'Pezinho', 'Acabamento do corte nas laterais e nuca', 10.00, 60, 'pezinho', 'avulso', true, 3),
  ('c0000000-0000-0000-0000-000000000004', 'Sobrancelha', 'Limpeza e alinhamento com pinça/navalha', 5.00, 60, 'sobrancelha', 'avulso', true, 4),
  ('c0000000-0000-0000-0000-000000000005', 'Cavanhaque', 'Alinhamento e contorno preciso do cavanhaque', 5.00, 60, 'cavanhaque', 'avulso', true, 5),
  ('c0000000-0000-0000-0000-000000000006', 'Pigmentação', 'Pigmentação para disfarçar falhas e realçar o corte', 15.00, 60, 'pigmentacao', 'avulso', true, 6),
  -- Combos com desconto
  ('c0000000-0000-0000-0000-000000000007', 'Combo: Cabelo + Barba', 'Corte completo e barba alinhada com toalha quente (Economize R$ 5,00)', 40.00, 60, 'combo', 'combo', true, 7),
  ('c0000000-0000-0000-0000-000000000008', 'Cabelo, Sobrancelha e Cavanhaque', 'Visual alinhado completo (Economize R$ 5,00)', 30.00, 60, 'combo', 'combo', true, 8)
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  descricao = EXCLUDED.descricao,
  preco = EXCLUDED.preco,
  tipo = EXCLUDED.tipo,
  ordem = EXCLUDED.ordem;

-- 2. Vincular Itens dos Combos
INSERT INTO public.combo_itens (combo_id, servico_id)
VALUES
  -- Combo Cabelo + Barba
  ('c0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000007', 'c0000000-0000-0000-0000-000000000002'),
  -- Combo Especial Cabelo + Sobrancelha + Cavanhaque
  ('c0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000001'),
  ('c0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000004'),
  ('c0000000-0000-0000-0000-000000000008', 'c0000000-0000-0000-0000-000000000005')
ON CONFLICT DO NOTHING;

-- 3. Horário de Funcionamento Semanal (Segunda a Sábado)
DELETE FROM public.horario_funcionamento;
INSERT INTO public.horario_funcionamento (dia_semana, abre, fecha, ativo)
VALUES
  (0, '09:00:00', '18:00:00', false), -- Domingo fechado
  (1, '17:00:00', '21:00:00', true),  -- Segunda-feira
  (2, '17:00:00', '21:00:00', true),  -- Terça-feira
  (3, '17:00:00', '21:00:00', true),  -- Quarta-feira
  (4, '17:00:00', '21:00:00', true),  -- Quinta-feira
  (5, '17:00:00', '21:00:00', true),  -- Sexta-feira
  (6, '12:00:00', '18:00:00', true);  -- Sábado (12:00 às 18:00)

-- 4. Configurações Globais Padrão
INSERT INTO public.configuracoes (
  id,
  nome_barbearia,
  whatsapp_contato,
  endereco,
  link_maps,
  instagram,
  pix_chave,
  pix_nome,
  pix_cidade,
  duracao_horario_min,
  antecedencia_minima_horas,
  janela_dias,
  horas_cancelamento_gratis,
  multa_percentual,
  bloquear_se_multa_pendente,
  desconto_aniversario_ativo,
  desconto_aniversario_percentual,
  desconto_aniversario_regra,
  dias_cliente_sumido,
  fidelidade_ativo,
  fidelidade_a_cada_visitas
) VALUES (
  1,
  'Barbearia do Luiz',
  '32999311712',
  'Rua Ida Drey Benatti, 220 (Bairro Santa Clara)',
  'https://www.google.com/maps/search/?api=1&query=Rua+Ida+Drey+Benatti+220+Santa+Clara+Visconde+do+Rio+Branco+MG',
  '@luiz_fg7',
  '+5532999311712',
  'LUIZ FERNANDO GOUVEIA',
  'Visconde do Rio Branco',
  60,
  1,
  30,
  3,
  50.00,
  false,
  false,
  10.00,
  'semana',
  15,
  false,
  10
) ON CONFLICT (id) DO UPDATE SET
  nome_barbearia = EXCLUDED.nome_barbearia,
  endereco = EXCLUDED.endereco,
  link_maps = EXCLUDED.link_maps,
  pix_chave = EXCLUDED.pix_chave,
  pix_nome = EXCLUDED.pix_nome;

-- 5. Agendar Execução Semanal via pg_cron para Agendamentos Fixos (Toda segunda-feira às 03:00)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule('gerar_agendamentos_fixos_semanal');
    PERFORM cron.schedule(
      'gerar_agendamentos_fixos_semanal',
      '0 3 * * 1',
      'SELECT public.gerar_agendamentos_fixos(4);'
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    NULL; -- Ignorar caso pg_cron não esteja configurado no ambiente local
END $$;
