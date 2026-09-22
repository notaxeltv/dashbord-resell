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
import { NewPurchaseDialog } from "@/components/purchases/new-purchase-dialog";
import { DeletePurchaseButton } from "@/components/purchases/delete-purchase-button";
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
          <h1 className="text-2xl font-bold text-slate-900">Acquisti</h1>
          <p className="text-sm text-slate-500">
            Storico degli acquisti effettuati dal team.
          </p>
        </div>
        <NewPurchaseDialog />
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Errore: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Numero acquisti
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{list.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Totale spesa (con spedizioni)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">€{totalSpent.toFixed(2)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco acquisti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
                {list.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={7}
                      className="py-8 text-center text-slate-500"
                    >
                      Nessun acquisto registrato.
                    </TableCell>
                  </TableRow>
                )}
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
                      <TableCell className="text-right">
                        <DeletePurchaseButton purchaseId={purchase.id} />
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
