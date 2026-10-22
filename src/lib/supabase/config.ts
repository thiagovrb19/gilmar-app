/**
 * Normaliza e sanitiza a URL do Supabase, prevenindo erros de barra extra ou cópia de URL do dashboard
 */
export function getSanitizedSupabaseUrl(): string {
  let url = (process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co").trim();

  // Se o usuário colou a URL do painel do Supabase: https://supabase.com/dashboard/project/<ref>/...
  if (url.includes("supabase.com/dashboard/project/")) {
    const match = url.match(/project\/([a-zA-Z0-9_-]+)/);
    if (match && match[1]) {
      return `https://${match[1]}.supabase.co`;
    }
  }

  // Remove sufixos indesejados
  url = url.replace(/\/rest\/v1\/?$/i, "");
  url = url.replace(/\/auth\/v1\/?$/i, "");
  url = url.replace(/\/dashboard\/?$/i, "");
  url = url.replace(/\/+$/, "");

  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = `https://${url}`;
  }

  return url;
}

/**
 * Normaliza a chave anônima do Supabase removendo aspas ou espaços acidentais
 */
export function getSanitizedAnonKey(): string {
  return (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

/**
 * Normaliza a chave Service Role do Supabase
 */
export function getSanitizedServiceRoleKey(): string {
  return (process.env.SUPABASE_SERVICE_ROLE_KEY || "placeholder-service-key")
    .trim()
    .replace(/^['"]|['"]$/g, "");
}

/**
 * Verifica se as credenciais do Supabase estão devidamente configuradas no ambiente.
 * Evita chamadas de rede para domínios placeholder que causam timeouts de 5-10 segundos.
 */
export function isSupabaseConfigured(): boolean {
  const url = getSanitizedSupabaseUrl();
  const key = getSanitizedAnonKey();

  if (!url || !key) return false;
  if (url.includes("placeholder") || key.includes("placeholder")) return false;
  if (url.includes("seu-projeto")) return false;
  if (!url.startsWith("https://")) return false;

  return true;
}
