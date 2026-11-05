import { createClient } from "@supabase/supabase-js";
import { getSanitizedSupabaseUrl, getSanitizedServiceRoleKey, getSanitizedAnonKey, isServiceRoleConfigured } from "./config";

/**
 * Cliente Supabase com privilégios de Service Role.
 * ATENÇÃO: NUNCA execute este cliente no navegador ou em componentes de cliente.
 * Usado estritamente em Server Actions / rotas administrativas protegidas.
 */
export function createAdminClient() {
  const supabaseUrl = getSanitizedSupabaseUrl();
  if (!isServiceRoleConfigured()) {
    // Sem a service_role o app cai na chave pública e o RLS bloqueia leituras/gravações do servidor.
    console.warn("[supabase] SUPABASE_SERVICE_ROLE_KEY ausente/inválida: usando chave pública (RLS vai bloquear operações).");
  }
  const keyToUse = isServiceRoleConfigured()
    ? getSanitizedServiceRoleKey()
    : getSanitizedAnonKey();

  return createClient(supabaseUrl, keyToUse, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
