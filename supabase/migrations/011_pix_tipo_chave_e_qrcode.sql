-- ==============================================================================
-- MIGRATION 011: TIPO DA CHAVE PIX + IMAGEM DO QR CODE DO BANCO
-- ==============================================================================
-- Como executar:
--   Copie todo este conteúdo, cole no "SQL Editor" do painel do Supabase e clique
--   em "Run". O script é idempotente (pode ser rodado mais de uma vez) e NÃO
--   altera clientes, agendamentos, propostas, estoque nem relatórios.
--
-- O que ele faz:
--   1. Cria duas colunas em public.configuracoes:
--        pix_tipo_chave -> cpf | cnpj | celular | email | aleatoria
--        pix_qr_imagem  -> imagem do QR Code do banco (opcional)
--   2. Ajusta a chave Pix para o CPF do Gilmar (a chave usada na conta do
--      Mercado Pago), com o nome do recebedor igual ao do banco.
--   3. Cadastra o QR Code do Mercado Pago enviado pelo Gilmar, caso ainda não
--      exista nenhuma imagem cadastrada.
--
-- Depois disso tudo pode ser alterado pelo painel: Configurações > Pix.
-- ==============================================================================

BEGIN;

ALTER TABLE public.configuracoes
  ADD COLUMN IF NOT EXISTS pix_tipo_chave TEXT NOT NULL DEFAULT 'cpf',
  ADD COLUMN IF NOT EXISTS pix_qr_imagem TEXT;

ALTER TABLE public.configuracoes
  DROP CONSTRAINT IF EXISTS configuracoes_pix_tipo_chave_check;
ALTER TABLE public.configuracoes
  ADD CONSTRAINT configuracoes_pix_tipo_chave_check
  CHECK (pix_tipo_chave IN ('cpf', 'cnpj', 'celular', 'email', 'aleatoria'));

-- Chave Pix da empresa: CPF (somente números, como exige o padrão do Banco Central)
UPDATE public.configuracoes
SET pix_tipo_chave = 'cpf',
    pix_chave = '11257950690',
    pix_nome = 'GILMAR SOUZA SALES',
    atualizado_em = now()
WHERE id = 1;

-- QR Code do Mercado Pago (mesmo conteúdo da imagem enviada pelo Gilmar).
-- Só é gravado se ainda não houver uma imagem cadastrada pelo painel.
UPDATE public.configuracoes
SET pix_qr_imagem = 'data:image/png;base64,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'
WHERE id = 1
  AND pix_qr_imagem IS NULL;

COMMIT;

-- Avisa a API do Supabase (PostgREST) para enxergar as colunas novas imediatamente
NOTIFY pgrst, 'reload schema';

-- ==============================================================================
-- Verificação (opcional): deve retornar cpf | 11257950690 | GILMAR SOUZA SALES | true
--   SELECT pix_tipo_chave, pix_chave, pix_nome, pix_qr_imagem IS NOT NULL AS tem_qr
--   FROM public.configuracoes WHERE id = 1;
-- ==============================================================================
