import { createBrowserClient } from "@supabase/ssr";

/**
 * Crea un nuovo client Supabase per l'uso nel browser (Client Components).
 * Usa le variabili d'ambiente pubbliche NEXT_PUBLIC_SUPABASE_URL e
 * NEXT_PUBLIC_SUPABASE_ANON_KEY.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Istanza singleton pronta all'uso nei Client Components,
 * es: `import { supabase } from "@/lib/supabase"`.
 */
export const supabase = createClient();
