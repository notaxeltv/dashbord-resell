import Link from "next/link";
import {
  CheckCircle2,
  Clock,
  Layers,
  PackageOpen,
  Tag,
  TrendingUp,
  Wallet,
} from "lucide-react";

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
import { KpiCard } from "@/components/dashboard/kpi-card";
import {
  CARD_STATUS_BADGE_VARIANT,
  CARD_STATUS_LABELS,
  CARD_STATUSES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Card as CardRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_BAR_COLORS: Record<string, string> = {
  in_stock: "from-violet-500 to-fuchsia-500",
  listed: "from-amber-400 to-orange-500",
  reserved: "from-fuchsia-500 to-rose-500",
  sold: "from-emerald-400 to-teal-500",
};

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
    reserved: list.filter((card) => card.status === "reserved").length,
    sold: list.filter((card) => card.status === "sold").length,
  };

  const inPortfolio = list.filter((card) => card.status !== "sold");
  const totalInvestment = inPortfolio.reduce(
    (sum, card) => sum + Number(card.purchase_price ?? 0),
    0,
  );
  const estimatedValue = inPortfolio.reduce(
    (sum, card) =>
      sum +
      Number(card.current_market_price ?? card.target_price ?? card.purchase_price ?? 0),
    0,
  );
  const potentialMargin = estimatedValue - totalInvestment;

  const statusBreakdown = CARD_STATUSES.map((status) => ({
    ...status,
    count: list.filter((card) => card.status === status.value).length,
  }));

  const topCards = [...inPortfolio]
    .sort(
      (a, b) =>
        Number(b.current_market_price ?? b.purchase_price ?? 0) -
        Number(a.current_market_price ?? a.purchase_price ?? 0),
    )
    .slice(0, 5);

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
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

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <KpiCard label="Totale carte" value={totals.total} accent="magenta" icon={Layers} />
        <KpiCard label="In stock" value={totals.in_stock} accent="violet" icon={PackageOpen} />
        <KpiCard label="In vendita" value={totals.listed} accent="gold" icon={Tag} />
        <KpiCard label="Riservate" value={totals.reserved} accent="magenta" icon={Clock} />
        <KpiCard label="Vendute" value={totals.sold} accent="emerald" icon={CheckCircle2} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Investimento in portafoglio"
          value={`€${totalInvestment.toFixed(2)}`}
          accent="violet"
          icon={Wallet}
          hint="Somma prezzi di acquisto delle carte non vendute"
        />
        <KpiCard
          label="Valore stimato attuale"
          value={`€${estimatedValue.toFixed(2)}`}
          accent="gold"
          icon={TrendingUp}
          hint="Basato su prezzo di mercato, target o acquisto"
        />
        <KpiCard
          label="Margine potenziale"
          value={`${potentialMargin >= 0 ? "+" : "-"}€${Math.abs(potentialMargin).toFixed(2)}`}
          accent={potentialMargin >= 0 ? "emerald" : "magenta"}
          icon={TrendingUp}
          hint="Valore stimato meno investimento"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuzione per stato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusBreakdown.map((status) => {
              const pct = totals.total > 0 ? Math.round((status.count / totals.total) * 100) : 0;
              return (
                <div key={status.value} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{status.label}</span>
                    <span className="text-muted-foreground">
                      {status.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn(
                        "h-full rounded-full bg-gradient-to-r",
                        STATUS_BAR_COLORS[status.value],
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
            {totals.total === 0 && (
              <p className="text-sm text-muted-foreground">
                Nessuna carta ancora inserita.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Carte di maggior valore</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {topCards.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nessuna carta in portafoglio al momento.
              </p>
            )}
            {topCards.map((card, index) => {
              const value = Number(
                card.current_market_price ?? card.target_price ?? card.purchase_price ?? 0,
              );
              return (
                <div
                  key={card.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-foreground">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.set_name ?? "—"}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-foreground">
                    €{value.toFixed(2)}
                  </span>
                </div>
              );
            })}
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
                      className="py-8 text-center text-muted-foreground"
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
