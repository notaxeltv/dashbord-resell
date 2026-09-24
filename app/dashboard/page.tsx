import Link from "next/link";
import { ArrowRight, PackageOpen, TrendingUp, Wallet } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CardThumbnail } from "@/components/cards/card-thumbnail";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { cn } from "@/lib/utils";
import { formatISODate } from "@/lib/dates";
import { cardEstimatedValue, purchaseTotal } from "@/lib/finance";
import {
  CARD_STATUS_LABELS,
  CARD_STATUSES,
  MARKETPLACES,
  optionLabel,
  PURCHASE_SOURCES,
} from "@/lib/constants";
import type { Card as CardRow, Purchase, Sale } from "@/lib/types";

export const dynamic = "force-dynamic";

const STATUS_BAR_COLORS: Record<string, string> = {
  in_stock: "from-violet-500 to-fuchsia-500",
  listed: "from-amber-400 to-orange-500",
  reserved: "from-fuchsia-500 to-rose-500",
  sold: "from-emerald-400 to-teal-500",
};

export default async function DashboardPage() {
  const supabase = await createSupabaseServerClient();

  const [{ data: cards, error }, { data: purchases }, { data: sales }] =
    await Promise.all([
      supabase.from("cards").select("*").order("created_at", { ascending: false }),
      supabase.from("purchases").select("*").order("date", { ascending: false }),
      supabase.from("sales").select("*").order("sale_date", { ascending: false }),
    ]);

  const list = (cards ?? []) as CardRow[];
  const purchaseList = (purchases ?? []) as Purchase[];
  const saleList = (sales ?? []) as Sale[];

  const inStock = list.filter((card) => card.status !== "sold");
  const listed = list.filter((card) => card.status === "listed").length;
  const totalInvestment = inStock.reduce(
    (sum, card) => sum + Number(card.purchase_price ?? 0),
    0,
  );
  const estimatedValue = inStock.reduce(
    (sum, card) => sum + cardEstimatedValue(card),
    0,
  );
  const spentOnLots = purchaseList.reduce((sum, p) => sum + purchaseTotal(p), 0);
  const salesNet = saleList.reduce((sum, s) => sum + Number(s.net_amount ?? 0), 0);

  const statusBreakdown = CARD_STATUSES.map((status) => ({
    ...status,
    count: list.filter((card) => card.status === status.value).length,
  }));

  const topCards = [...inStock]
    .sort((a, b) => cardEstimatedValue(b) - cardEstimatedValue(a))
    .slice(0, 5);

  const cardNameById = new Map(list.map((card) => [card.id, card.name]));
  const recent = [
    ...purchaseList.slice(0, 8).map((p) => ({
      key: `p-${p.id}`,
      date: p.date,
      label: `Lotto — ${optionLabel(PURCHASE_SOURCES, p.source)}`,
      amount: -purchaseTotal(p),
    })),
    ...saleList.slice(0, 8).map((s) => ({
      key: `s-${s.id}`,
      date: s.sale_date,
      label: `Vendita — ${cardNameById.get(s.card_id) ?? "Carta"} · ${optionLabel(MARKETPLACES, s.marketplace)}`,
      amount: Number(s.net_amount ?? 0),
    })),
  ]
    .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
    .slice(0, 8);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Panoramica</h1>
        <p className="text-sm text-muted-foreground">
          Inventario, lotti pagati e vendite sono tre cose diverse: qui vedi
          solo il riepilogo.
        </p>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento: {error.message}
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Button asChild>
          <Link href="/dashboard/cards">
            Apri inventario <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/purchases">Registra un lotto</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/dashboard/sales">Registra una vendita</Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <KpiCard
          label="Carte in magazzino"
          value={inStock.length}
          accent="violet"
          icon={PackageOpen}
          hint={`${listed} in vendita · ${list.length} totali`}
        />
        <KpiCard
          label="Valore magazzino"
          value={`€${estimatedValue.toFixed(2)}`}
          accent="magenta"
          icon={Wallet}
          hint={`Costo caricato: €${totalInvestment.toFixed(2)}`}
        />
        <KpiCard
          label="Incassato dalle vendite"
          value={`€${salesNet.toFixed(2)}`}
          accent="emerald"
          icon={TrendingUp}
          hint={`Speso in lotti: €${spentOnLots.toFixed(2)}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Distribuzione inventario</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {statusBreakdown.map((status) => {
              const pct =
                list.length > 0 ? Math.round((status.count / list.length) * 100) : 0;
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
            {list.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nessuna carta in inventario.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle>Maggiore valore in stock</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard/cards">Vedi tutte</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {topCards.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nessuna carta in magazzino.
              </p>
            )}
            {topCards.map((card, index) => {
              const value = cardEstimatedValue(card);
              return (
                <div
                  key={card.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 px-3 py-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <CardThumbnail
                      imageUrl={card.image_url}
                      name={card.name}
                      className="h-10 w-8"
                    />
                    <div>
                      <p className="text-sm font-medium text-foreground">{card.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {card.set_name ?? "—"} ·{" "}
                        {CARD_STATUS_LABELS[card.status] ?? card.status}
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
          <CardTitle>Ultimi movimenti di cassa</CardTitle>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nessun lotto o vendita registrati. I prezzi sulle carte non
              compaiono qui.
            </p>
          ) : (
            <ul className="divide-y divide-border/60">
              {recent.map((row) => (
                <li
                  key={row.key}
                  className="flex items-center justify-between gap-3 py-2 text-sm"
                >
                  <div>
                    <p className="text-foreground">{row.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatISODate(row.date)}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "font-medium",
                      row.amount >= 0 ? "text-emerald-600" : "text-amber-700",
                    )}
                  >
                    {row.amount >= 0 ? "+" : "-"}€{Math.abs(row.amount).toFixed(2)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
