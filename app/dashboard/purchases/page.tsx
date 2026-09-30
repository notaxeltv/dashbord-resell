import { Suspense } from "react";
import { Coins, ShoppingCart } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { NewPurchaseWithPrefill } from "@/components/purchases/new-purchase-with-prefill";
import { PurchasesBrowser } from "@/components/purchases/purchases-browser";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
import { purchaseTotal } from "@/lib/finance";
import type { Purchase, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: purchases, error }, { data: profiles }] = await Promise.all([
    supabase.from("purchases").select("*").order("date", { ascending: false }),
    supabase.from("profiles").select("id, email, display_name, role, created_at"),
  ]);

  const list = (purchases ?? []) as Purchase[];
  const profileList = (profiles ?? []) as Profile[];

  const totalSpent = list.reduce((sum, purchase) => sum + purchaseTotal(purchase), 0);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Lotti</h1>
          <p className="text-sm text-muted-foreground">
            Soldi usciti per ordini e lotti (cassa). Non è l&apos;elenco delle
            carte: quelle stanno in Inventario. Se una carta fa parte di un
            lotto, collegala così il costo non viene contato due volte.
          </p>
        </div>
        <Suspense fallback={<Button disabled>+ Nuovo lotto</Button>}>
          <NewPurchaseWithPrefill />
        </Suspense>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          Errore: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Numero lotti"
          value={list.length}
          accent="violet"
          icon={ShoppingCart}
        />
        <KpiCard
          label="Totale spesa (con spedizioni)"
          value={`€${totalSpent.toFixed(2)}`}
          accent="gold"
          icon={Coins}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco lotti</CardTitle>
        </CardHeader>
        <CardContent>
          <PurchasesBrowser purchases={list} profiles={profileList} />
        </CardContent>
      </Card>
    </div>
  );
}
