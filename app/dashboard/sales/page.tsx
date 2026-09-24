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
import { formatISODate } from "@/lib/dates";
import { optionLabel, MARKETPLACES } from "@/lib/constants";
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
          {list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessuna vendita registrata.
            </p>
          )}

          {/* Vista a card impilate per mobile: evita che i bottoni Modifica/
              Elimina finiscano fuori schermo richiedendo scroll orizzontale. */}
          {list.length > 0 && (
            <div className="space-y-3 sm:hidden">
              {list.map((sale) => {
                const card = cardMap.get(sale.card_id);
                const author = profileMap.get(sale.sold_by);
                const cardLabel = card
                  ? `${card.name}${card.set_name ? ` (${card.set_name})` : ""}`
                  : "Carta eliminata";
                return (
                  <div
                    key={sale.id}
                    className="rounded-lg border border-border/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium text-foreground">
                          {card?.name ?? "Carta eliminata"}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {optionLabel(MARKETPLACES, sale.marketplace)} ·{" "}
                          {formatISODate(sale.sale_date)}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        €{Number(sale.net_amount).toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Prezzo</p>
                        <p className="font-medium text-foreground">
                          €{Number(sale.sale_price).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Fee</p>
                        <p className="font-medium text-foreground">
                          €{Number(sale.fees).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Venduto da</p>
                        <p className="font-medium text-foreground">
                          {author?.display_name ?? author?.email ?? "-"}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <SaleDialog
                        cards={availableCards}
                        sale={sale}
                        cardLabel={cardLabel}
                        triggerClassName="flex-1"
                      />
                      <DeleteSaleButton saleId={sale.id} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Vista tabellare per tablet/desktop. */}
          {list.length > 0 && (
            <div className="hidden overflow-x-auto sm:block">
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
                  {list.map((sale) => {
                    const card = cardMap.get(sale.card_id);
                    const author = profileMap.get(sale.sold_by);
                    return (
                      <TableRow key={sale.id}>
                        <TableCell>{formatISODate(sale.sale_date)}</TableCell>
                        <TableCell>{card?.name ?? "Carta eliminata"}</TableCell>
                        <TableCell>
                          {optionLabel(MARKETPLACES, sale.marketplace)}
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
