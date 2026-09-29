import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityLogList } from "@/components/activity/activity-log-list";
import type { ActivityLog, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RegistroPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: entries, error }, { data: profiles }] = await Promise.all([
    supabase
      .from("activity_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(300),
    supabase.from("profiles").select("id, email, display_name, role, created_at"),
  ]);

  const missingTable =
    Boolean(error?.message?.toLowerCase().includes("activity_log")) ||
    Boolean(error?.message?.toLowerCase().includes("schema cache")) ||
    Boolean(error?.message?.toLowerCase().includes("does not exist"));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Registro</h1>
        <p className="text-sm text-muted-foreground">
          Chi ha fatto cosa: carte, lotti, vendite, movimenti extra e accessi.
        </p>
      </div>

      {missingTable ? (
        <Card>
          <CardHeader>
            <CardTitle>Attiva il registro su Supabase</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              La pagina c’è, manca solo la tabella nel database. Una tantum:
            </p>
            <ol className="list-decimal space-y-2 pl-5">
              <li>Apri Supabase → SQL Editor.</li>
              <li>
                Incolla e avvia tutto il file{" "}
                <code className="rounded bg-muted px-1 text-foreground">
                  supabase/activity_log.sql
                </code>
                .
              </li>
              <li>Ricarica questa pagina.</li>
            </ol>
            {error?.message && (
              <p className="rounded-md bg-amber-50 p-3 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
                Dettaglio: {error.message}
              </p>
            )}
          </CardContent>
        </Card>
      ) : error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          Errore nel caricamento del registro: {error.message}
        </p>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Attività recenti</CardTitle>
          </CardHeader>
          <CardContent>
            <ActivityLogList
              entries={(entries ?? []) as ActivityLog[]}
              profiles={(profiles ?? []) as Profile[]}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
