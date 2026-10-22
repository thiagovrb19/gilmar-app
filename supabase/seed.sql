-- ==============================================================================
-- SEED DE DADOS INICIAIS — GS ELÉTRICA E MANUTENÇÃO (GILMAR SALES)
-- ==============================================================================

-- 1. Inserir Serviços Elétricos e Industriais
INSERT INTO public.servicos (id, nome, descricao, preco, duracao_min, icone, tipo, ativo, ordem)
VALUES
  ('c0000000-0000-0000-0000-000000000001', 'Instalação / Troca de Padrão CEMIG', 'Montagem, adequação e ligação de padrão bifásico e trifásico conforme normas da concessionária.', 350.00, 120, 'padrao', 'avulso', true, 1),
  ('c0000000-0000-0000-0000-000000000002', 'Adequação de Quadro de Distribuição (QDF)', 'Organização de barramentos, balanceamento de cargas, instalação de DR e DPS contra choques e surtos.', 180.00, 90, 'quadro', 'avulso', true, 2),
  ('c0000000-0000-0000-0000-000000000003', 'Instalação / Troca de Chuveiro Elétrico', 'Instalação com fiação dimensionada, conectores adequados e verificação do disjuntor.', 60.00, 60, 'chuveiro', 'avulso', true, 3),
  ('c0000000-0000-0000-0000-000000000004', 'Iluminação (Spots LED, Lustres e Fitas)', 'Instalação e alinhamento de luminárias modernas, painéis embutidos, trilhos e pendentes.', 45.00, 60, 'lampada', 'avulso', true, 4),
  ('c0000000-0000-0000-0000-000000000005', 'Instalação de Tomadas e Interruptores', 'Substituição de tomadas 10A/20A, interruptores simples/paralelos e acabamentos.', 30.00, 45, 'tomada', 'avulso', true, 5),
  ('c0000000-0000-0000-0000-000000000006', 'Diagnóstico Elétrico e Fuga de Corrente', 'Identificação e reparo de curtos-circuitos, desarmes repentinos e pontos de sobreaquecimento.', 120.00, 60, 'ferramentas', 'avulso', true, 6),
  ('c0000000-0000-0000-0000-000000000007', 'Manutenção Industrial (Motores e Painéis)', 'Comandos elétricos, bombas d''água, partidas de motores e manutenção preventiva/corretiva.', 250.00, 120, 'industrial', 'avulso', true, 7),
  ('c0000000-0000-0000-0000-000000000008', 'Reforma e Troca de Fiação Residencial', 'Passagem de novos cabos antichama, separação de circuitos e modernização da rede elétrica.', 450.00, 180, 'raio', 'avulso', true, 8),
  ('c0000000-0000-0000-0000-000000000009', 'Pacote Check-up Elétrico Residencial', 'Revisão geral do quadro, reaperto de conexões, teste de aterramento e tomadas (Economize R$ 80,00).', 220.00, 120, 'combo', 'combo', true, 9)
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
