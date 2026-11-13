/**
 * Regras compartilhadas (navegador + servidor) do Relatório de Serviço (antes e depois).
 */

/** Bucket PRIVADO no Supabase Storage (criado pela migration 010) */
export const RELATORIOS_BUCKET = "relatorios-servico";

/** Máximo de fotos por relatório */
export const RELATORIO_MAX_FOTOS = 24;

/** Tamanho máximo de cada foto já comprimida (o bucket impõe o mesmo limite) */
export const RELATORIO_FOTO_MAX_BYTES = 5 * 1024 * 1024;

/** Validade das URLs assinadas (1 hora: dá tempo de revisar e gerar o PDF) */
export const RELATORIO_SIGNED_URL_TTL = 60 * 60;

export const RELATORIO_TITULO_PADRAO = "Relatório de Serviço Executado";

/** Mensagem exibida quando a tabela/bucket ainda não existem no Supabase */
export const RELATORIO_MSG_MIGRATION =
  "A área de Relatórios ainda não foi ativada no banco. Rode o arquivo supabase/migrations/010_relatorios_servico.sql no SQL Editor do Supabase e tente novamente.";
