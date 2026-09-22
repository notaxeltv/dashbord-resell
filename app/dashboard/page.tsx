import Link from "next/link";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteCardButton } from "@/components/cards/delete-card-button";
import { CARD_STATUS_BADGE_VARIANT, CARD_STATUS_LABELS } from "@/lib/constants";
import type { Card as CardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const { data: cards, error } = await supabase
    .from("cards")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (cards ?? []) as CardRow[];

  const totals = {
    total: list.length,
    in_stock: list.filter((card) => card.status === "in_stock").length,
    listed: list.filter((card) => card.status === "listed").length,
    sold: list.filter((card) => card.status === "sold").length,
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-sm text-slate-500">
            Panoramica dell&apos;inventario carte Pokémon.
          </p>
        </div>
        <Button asChild>
          <Link href="/dashboard/cards/new">+ Nuova carta</Link>
        </Button>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento delle carte: {error.message}
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Totale carte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totals.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              In stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totals.in_stock}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              In vendita
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totals.listed}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">
              Vendute
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{totals.sold}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Elenco carte</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Set</TableHead>
                  <TableHead>Condizione</TableHead>
                  <TableHead>Acquisto</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>Stato</TableHead>
                  <TableHead>Inserita il</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {list.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="py-8 text-center text-slate-500"
                    >
                      Nessuna carta inserita. Aggiungi la prima carta con
                      &quot;+ Nuova carta&quot;.
                    </TableCell>
                  </TableRow>
                )}
                {list.map((card) => (
                  <TableRow key={card.id}>
                    <TableCell className="font-medium">
                      {card.name}
                      {card.is_foil && (
                        <Badge variant="secondary" className="ml-2">
                          Foil
                        </Badge>
                      )}
                      {card.is_japanese && (
                        <Badge variant="outline" className="ml-2">
                          JP
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>{card.set_name ?? "-"}</TableCell>
                    <TableCell>{card.condition}</TableCell>
                    <TableCell>
                      {card.purchase_price != null
                        ? `€${Number(card.purchase_price).toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {card.target_price != null
                        ? `€${Number(card.target_price).toFixed(2)}`
                        : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={CARD_STATUS_BADGE_VARIANT[card.status] ?? "default"}
                      >
                        {CARD_STATUS_LABELS[card.status] ?? card.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(card.created_at).toLocaleDateString("it-IT")}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/dashboard/cards/${card.id}/edit`}>
                          Modifica
                        </Link>
                      </Button>
                      <DeleteCardButton cardId={card.id} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
