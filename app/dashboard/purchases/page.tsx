import { Coins, ShoppingCart } from "lucide-react";

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
import { PurchaseDialog } from "@/components/purchases/purchase-dialog";
import { DeletePurchaseButton } from "@/components/purchases/delete-purchase-button";
import { KpiCard } from "@/components/dashboard/kpi-card";
import type { Purchase, Profile } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: purchases, error }, { data: profiles }] = await Promise.all([
    supabase.from("purchases").select("*").order("date", { ascending: false }),
    supabase.from("profiles").select("id, email, display_name, role, created_at"),
  ]);

  const profileMap = new Map(
    (profiles ?? []).map((profile: Profile) => [profile.id, profile]),
  );
  const list = (purchases ?? []) as Purchase[];

  const totalSpent = list.reduce(
    (sum, purchase) =>
      sum + Number(purchase.total_amount) + Number(purchase.shipping_cost ?? 0),
    0,
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Acquisti</h1>
          <p className="text-sm text-muted-foreground">
            Storico degli acquisti effettuati dal team.
          </p>
        </div>
        <PurchaseDialog />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Errore: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Numero acquisti"
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
          <CardTitle>Elenco acquisti</CardTitle>
        </CardHeader>
        <CardContent>
          {list.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nessun acquisto registrato.
            </p>
          )}

          {/* Vista a card impilate per mobile: evita che i bottoni Modifica/
              Elimina finiscano fuori schermo richiedendo scroll orizzontale. */}
          {list.length > 0 && (
            <div className="space-y-3 sm:hidden">
              {list.map((purchase) => {
                const author = profileMap.get(purchase.created_by);
                return (
                  <div
                    key={purchase.id}
                    className="rounded-lg border border-border/60 p-4"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium capitalize text-foreground">
                          {purchase.source}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(purchase.date).toLocaleDateString("it-IT")}
                        </p>
                      </div>
                      <p className="text-lg font-semibold text-foreground">
                        €{Number(purchase.total_amount).toFixed(2)}
                      </p>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Spedizione</p>
                        <p className="font-medium text-foreground">
                          €{Number(purchase.shipping_cost ?? 0).toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Inserito da</p>
                        <p className="font-medium text-foreground">
                          {author?.display_name ?? author?.email ?? "-"}
                        </p>
                      </div>
                    </div>

                    {purchase.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">
                        {purchase.notes}
                      </p>
                    )}

                    <div className="mt-3 flex gap-2">
                      <PurchaseDialog purchase={purchase} triggerClassName="flex-1" />
                      <DeletePurchaseButton purchaseId={purchase.id} />
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
                    <TableHead>Fonte</TableHead>
                    <TableHead>Totale</TableHead>
                    <TableHead>Spedizione</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Inserito da</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {list.map((purchase) => {
                    const author = profileMap.get(purchase.created_by);
                    return (
                      <TableRow key={purchase.id}>
                        <TableCell>
                          {new Date(purchase.date).toLocaleDateString("it-IT")}
                        </TableCell>
                        <TableCell className="capitalize">
                          {purchase.source}
                        </TableCell>
                        <TableCell>
                          €{Number(purchase.total_amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          €{Number(purchase.shipping_cost ?? 0).toFixed(2)}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {purchase.notes ?? "-"}
                        </TableCell>
                        <TableCell>
                          {author?.display_name ?? author?.email ?? "-"}
                        </TableCell>
                        <TableCell className="space-x-2 whitespace-nowrap text-right">
                          <PurchaseDialog purchase={purchase} />
                          <DeletePurchaseButton purchaseId={purchase.id} />
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
