-- ==============================================================================
-- SEED DE DADOS INICIAIS — GS ELÉTRICA E MANUTENÇÃO (GILMAR SALES)
-- ==============================================================================

-- 1. Inserir Serviços Elétricos e Industriais
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

-- 2. Vincular Itens do Combo Check-up
INSERT INTO public.combo_itens (combo_id, servico_id)
VALUES
  ('c0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000002'),
  ('c0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000005'),
  ('c0000000-0000-0000-0000-000000000009', 'c0000000-0000-0000-0000-000000000006')
ON CONFLICT DO NOTHING;

-- 3. Horário de Atendimento Padrão (Segunda a Sábado, das 07:00 às 18:00)
DELETE FROM public.horario_funcionamento;
INSERT INTO public.horario_funcionamento (dia_semana, abre, fecha, ativo)
VALUES
  (0, '08:00:00', '12:00:00', false), -- Domingo fechado (plantão sob consulta)
  (1, '07:00:00', '18:00:00', true),  -- Segunda-feira
  (2, '07:00:00', '18:00:00', true),  -- Terça-feira
  (3, '07:00:00', '18:00:00', true),  -- Quarta-feira
  (4, '07:00:00', '18:00:00', true),  -- Quinta-feira
  (5, '07:00:00', '18:00:00', true),  -- Sexta-feira
  (6, '07:00:00', '13:00:00', true);  -- Sábado

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
  'GS Elétrica e Manutenção',
  '32988714986',
  'Atendimento em Visconde do Rio Branco - MG e região',
  'https://www.google.com/maps/search/?api=1&query=Visconde+do+Rio+Branco+MG',
  '@gseletricaemanutencao',
  '32988714986',
  'GILMAR SALES',
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
  30,
  false,
  10
) ON CONFLICT (id) DO UPDATE SET
  nome_barbearia = EXCLUDED.nome_barbearia,
  whatsapp_contato = EXCLUDED.whatsapp_contato,
  endereco = EXCLUDED.endereco,
  link_maps = EXCLUDED.link_maps,
  pix_chave = EXCLUDED.pix_chave,
  pix_nome = EXCLUDED.pix_nome;
