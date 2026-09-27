import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Crea un client Supabase per l'uso in Server Components, Server Actions
 * e Route Handlers. Legge/scrive i cookie di sessione tramite `next/headers`,
 * così le policy RLS possono verificare l'utente autenticato lato server.
 */
export async function createSupabaseServerClient() {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Mancano NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local",
    );
  }

  const cookieStore = await cookies();

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // `setAll` può essere chiamato da un Server Component: in quel
          // caso i cookie vengono comunque aggiornati dal middleware.
        }
      },
    },
  });
}
