import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Crea un nuovo client Supabase per l'uso nel browser (Client Components).
 * Usa le variabili d'ambiente pubbliche NEXT_PUBLIC_SUPABASE_URL e
 * NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Mancano NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }
  return createBrowserClient(env.url, env.key);
}

/**
 * Istanza singleton pronta all'uso nei Client Components,
 * es: `import { supabase } from "@/lib/supabase"`.
 */
export const supabase = createClient();
