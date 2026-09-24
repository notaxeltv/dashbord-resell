import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { InventoryBrowser } from "@/components/cards/inventory-browser";
import type { Card as CardRow, PurchaseOption } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: cards, error }, { data: purchases }, { data: sales }] =
    await Promise.all([
      supabase.from("cards").select("*").order("created_at", { ascending: false }),
      supabase
        .from("purchases")
        .select("id, date, source, total_amount")
        .order("date", { ascending: false }),
      supabase.from("sales").select("card_id"),
    ]);

  const list = (cards ?? []) as CardRow[];
  const purchaseOptions = (purchases ?? []) as PurchaseOption[];
  const soldCardIds = (sales ?? []).map((row) => row.card_id as string);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Inventario</h1>
        <p className="text-sm text-muted-foreground">
          Carte in magazzino. Il costo è della singola carta; i lotti pagati
          stanno in Lotti.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento delle carte: {error.message}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Carte</CardTitle>
        </CardHeader>
        <CardContent>
          <InventoryBrowser
            cards={list}
            purchases={purchaseOptions}
            soldCardIds={soldCardIds}
          />
        </CardContent>
      </Card>
    </div>
  );
}
