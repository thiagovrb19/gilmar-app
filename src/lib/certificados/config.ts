/**
 * Regras compartilhadas (navegador + servidor) dos Certificados / NRs do Gilmar.
 */
import { getSanitizedSupabaseUrl } from "@/lib/supabase/config";

/** Bucket PÚBLICO no Supabase Storage (criado pela migration 012) */
export const CERTIFICADOS_BUCKET = "certificados";

/** Tamanho máximo de cada PDF (o bucket impõe o mesmo limite) */
export const CERTIFICADO_MAX_BYTES = 20 * 1024 * 1024;

export const CERTIFICADO_MSG_MIGRATION =
  "A área de Certificados ainda não foi ativada no banco. Rode o arquivo supabase/migrations/012_certificados.sql no SQL Editor do Supabase e tente novamente.";

/** Caminho gerado pelo servidor: <uuid>.pdf (o nome do arquivo do usuário nunca vira caminho) */
export const CERTIFICADO_PATH_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.pdf$/i;

/** URL pública do PDF (bucket público) */
export function certificadoUrlPublica(path: string): string {
  return `${getSanitizedSupabaseUrl()}/storage/v1/object/public/${CERTIFICADOS_BUCKET}/${path}`;
}

export function formatarTamanho(bytes: number): string {
  if (!bytes || bytes < 1024) return `${bytes || 0} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}
