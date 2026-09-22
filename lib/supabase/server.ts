import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Crea un client Supabase per l'uso in Server Components, Server Actions
 * e Route Handlers. Legge/scrive i cookie di sessione tramite `next/headers`,
 * così le policy RLS possono verificare l'utente autenticato lato server.
 */
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
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
    },
  );
}
