import { createClient } from "@supabase/supabase-js";

/**
 * Client Supabase con la Service Role Key: bypassa la Row Level Security.
 * Da usare SOLO in contesti server-to-server senza sessione utente (es. il
 * digest giornaliero lanciato da Vercel Cron), mai in codice raggiungibile
 * dal browser. Richiede `NEXT_PUBLIC_SUPABASE_URL` e
 * `SUPABASE_SERVICE_ROLE_KEY` (quest'ultima NON deve mai avere il prefisso
 * `NEXT_PUBLIC_` e va presa da Supabase → Settings → API → service_role).
 */
export function createSupabaseServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    return null;
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
