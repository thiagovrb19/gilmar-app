import { createBrowserClient } from "@supabase/ssr";
import { getSanitizedSupabaseUrl, getSanitizedAnonKey } from "./config";

export function createClient() {
  const supabaseUrl = getSanitizedSupabaseUrl();
  const supabaseAnonKey = getSanitizedAnonKey();

  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
