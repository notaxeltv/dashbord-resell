import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityLogList } from "@/components/activity/activity-log-list";
import type { ActivityLog, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ActivityLogPage() {
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
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          Per attivare il registro esegui lo script{" "}
          <code className="rounded bg-black/10 px-1">supabase/activity_log.sql</code>{" "}
          nel SQL Editor di Supabase, poi ricarica questa pagina.
        </p>
      ) : error ? (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          Errore nel caricamento del registro: {error.message}
        </p>
      ) : null}

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
    </div>
  );
}
