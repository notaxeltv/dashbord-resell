import { CircleDollarSign, TrendingUp } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SaleDialog, type CardOption } from "@/components/sales/sale-dialog";
import { SalesBrowser } from "@/components/sales/sales-browser";
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { Sale, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SalesPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: sales, error }, { data: profiles }, { data: cards }] =
    await Promise.all([
      supabase.from("sales").select("*").order("sale_date", { ascending: false }),
      supabase.from("profiles").select("id, email, display_name, role, created_at"),
      supabase.from("cards").select("id, name, set_name, status"),
    ]);

  const profileList = (profiles ?? []) as Profile[];
  const cardList = cards ?? [];
  const list = (sales ?? []) as Sale[];

  const soldIds = new Set(list.map((sale) => sale.card_id));
  const availableCards = (cards ?? []).filter(
    (card) => card.status !== "sold" && !soldIds.has(card.id as string),
  ) as CardOption[];

  const totalRevenue = list.reduce(
    (sum, sale) => sum + Number(sale.net_amount ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Vendite</h1>
          <p className="text-sm text-muted-foreground">
            Qui si registra quando una carta esce dall&apos;inventario. La
            carta passa automaticamente a «venduta».
          </p>
        </div>
        <SaleDialog cards={availableCards} />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          Errore: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Numero vendite"
          value={list.length}
          accent="magenta"
          icon={CircleDollarSign}
        />
        <KpiCard
          label="Incasso netto totale"
          value={`€${totalRevenue.toFixed(2)}`}
          accent="emerald"
          icon={TrendingUp}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco vendite</CardTitle>
        </CardHeader>
        <CardContent>
          <SalesBrowser
            sales={list}
            profiles={profileList}
            cards={cardList}
            availableCards={availableCards}
          />
        </CardContent>
      </Card>
    </div>
  );
}
