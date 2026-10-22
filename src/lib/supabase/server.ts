import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { getSanitizedSupabaseUrl, getSanitizedAnonKey } from "./config";

export async function createClient() {
  const cookieStore = await cookies();
  const supabaseUrl = getSanitizedSupabaseUrl();
  const supabaseAnonKey = getSanitizedAnonKey();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Em Server Components de leitura pura o set pode falhar de forma segura
        }
      },
    },
  });
}
