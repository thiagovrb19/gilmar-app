-- ==============================================================================
-- MIGRATION 007: POPULAR SERVIÇOS PADRÃO (GS ELÉTRICA E MANUTENÇÃO)
-- ==============================================================================

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
  duracao_min = EXCLUDED.duracao_min,
  icone = EXCLUDED.icone,
  tipo = EXCLUDED.tipo,
  ativo = EXCLUDED.ativo,
  ordem = EXCLUDED.ordem;
