import { CircleDollarSign, TrendingUp } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SaleDialog, type CardOption } from "@/components/sales/sale-dialog";
import { DeleteSaleButton } from "@/components/sales/delete-sale-button";
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

  const profileMap = new Map(
    (profiles ?? []).map((profile: Profile) => [profile.id, profile]),
  );
  const cardMap = new Map(
    (cards ?? []).map((card) => [card.id as string, card]),
  );
  const list = (sales ?? []) as Sale[];

  const availableCards = (cards ?? []).filter(
    (card) => card.status !== "sold",
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
            Storico delle vendite effettuate dal team.
          </p>
        </div>
        <SaleDialog cards={availableCards} />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
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
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Carta</TableHead>
                  <TableHead>Marketplace</TableHead>
                  <TableHead>Prezzo</TableHead>
                  <TableHead>Fee</TableHead>
                  <TableHead>Netto</TableHead>
                  <TableHead>Venduto da</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Nessuna vendita registrata.
                    </TableCell>
                  </TableRow>
                )}
                {list.map((sale) => {
                  const card = cardMap.get(sale.card_id);
                  const author = profileMap.get(sale.sold_by);
                  return (
                    <TableRow key={sale.id}>
                      <TableCell>
                        {new Date(sale.sale_date).toLocaleDateString("it-IT")}
                      </TableCell>
                      <TableCell>{card?.name ?? "Carta eliminata"}</TableCell>
                      <TableCell className="capitalize">
                        {sale.marketplace}
                      </TableCell>
                      <TableCell>
                        €{Number(sale.sale_price).toFixed(2)}
                      </TableCell>
                      <TableCell>€{Number(sale.fees).toFixed(2)}</TableCell>
                      <TableCell className="font-medium">
                        €{Number(sale.net_amount).toFixed(2)}
                      </TableCell>
                      <TableCell>
                        {author?.display_name ?? author?.email ?? "-"}
                      </TableCell>
                      <TableCell className="space-x-2 whitespace-nowrap text-right">
                        <SaleDialog
                          cards={availableCards}
                          sale={sale}
                          cardLabel={
                            card
                              ? `${card.name}${card.set_name ? ` (${card.set_name})` : ""}`
                              : "Carta eliminata"
                          }
                        />
                        <DeleteSaleButton saleId={sale.id} />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
