import { redirect } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/dashboard/header";

/**
 * Layout condiviso per tutte le rotte /dashboard/*.
 * Verifica la sessione lato server: se l'utente non è autenticato
 * viene reindirizzato a /login, proteggendo così l'intero albero
 * di rotte con un unico controllo.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <DashboardHeader email={user.email ?? ""} />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
