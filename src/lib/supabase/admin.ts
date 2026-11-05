import { createClient } from "@supabase/supabase-js";
import { getSanitizedSupabaseUrl, getSanitizedServiceRoleKey, getSanitizedAnonKey, isServiceRoleConfigured } from "./config";

/**
 * Cliente Supabase com privilégios de Service Role.
 * ATENÇÃO: NUNCA execute este cliente no navegador ou em componentes de cliente.
 * Usado estritamente em Server Actions / rotas administrativas protegidas.
 */
export function createAdminClient() {
  const supabaseUrl = getSanitizedSupabaseUrl();
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
