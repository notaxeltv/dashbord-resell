import { ArrowLeftRight, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PeriodFilter } from "@/components/reports/period-filter";
import { SpendingChart } from "@/components/reports/spending-chart";
import { cn } from "@/lib/utils";
import { formatISODate, toISODate } from "@/lib/dates";
import { isUnlinkedCardCost, purchaseTotal, transactionDate } from "@/lib/finance";
import type { Card as CardRow, Purchase, Sale, Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 0 = lunedì
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getPeriodRange(period: string, from?: string, to?: string) {
  const now = new Date();

  if (period === "custom") {
    if (from && to) return { start: from, end: to };
    const fallbackStart = new Date(now);
    fallbackStart.setDate(now.getDate() - 29);
    return { start: toISODate(fallbackStart), end: toISODate(now) };
  }

  if (period === "year") {
    return {
      start: toISODate(new Date(now.getFullYear(), 0, 1)),
      end: toISODate(new Date(now.getFullYear(), 11, 31)),
    };
  }

  if (period === "week") {
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end) };
  }

  // month (default)
  return {
    start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

function formatPeriodLabel(period: string, start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (period === "year") return `Anno ${startDate.getFullYear()}`;
  if (period === "month")
    return startDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return `${fmt(startDate)} → ${fmt(endDate)}`;
}

function buildBuckets(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const dayCount =
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  const buckets: { label: string; start: string; end: string }[] = [];

  if (dayCount <= 31) {
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = toISODate(d);
      buckets.push({
        label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
        start: iso,
        end: iso,
      });
    }
  } else if (dayCount <= 731) {
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const bucketStart = new Date(Math.max(cursor.getTime(), startDate.getTime()));
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const bucketEnd = new Date(Math.min(monthEnd.getTime(), endDate.getTime()));
      buckets.push({
        label: cursor.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
        start: toISODate(bucketStart),
        end: toISODate(bucketEnd),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else {
    let year = startDate.getFullYear();
    while (year <= endDate.getFullYear()) {
      const bucketStart = year === startDate.getFullYear() ? startDate : new Date(year, 0, 1);
      const bucketEnd = year === endDate.getFullYear() ? endDate : new Date(year, 11, 31);
      buckets.push({
        label: String(year),
        start: toISODate(bucketStart),
        end: toISODate(bucketEnd),
      });
      year++;
    }
  }

  return buckets;
}

export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = params.period ?? "month";
  const { start, end } = getPeriodRange(period, params.from, params.to);

  const supabase = await createSupabaseServerClient();

  const [
    { data: purchases, error: purchasesError },
    { data: sales, error: salesError },
    { data: transactions, error: transactionsError },
    { data: cards, error: cardsError },
  ] = await Promise.all([
    supabase.from("purchases").select("*").gte("date", start).lte("date", end),
    supabase.from("sales").select("*").gte("sale_date", start).lte("sale_date", end),
    supabase.from("transactions").select("*"),
    supabase
      .from("cards")
      .select("id, name, purchase_id, purchase_price, purchase_date")
      .not("purchase_price", "is", null)
      .is("purchase_id", null)
      .gte("purchase_date", start)
      .lte("purchase_date", end),
  ]);

  const purchaseList = (purchases ?? []) as Purchase[];
  const saleList = (sales ?? []) as Sale[];
  const transactionList = ((transactions ?? []) as Transaction[]).filter((t) => {
    const date = transactionDate(t);
    return date >= start && date <= end;
  });
  const unlinkedCards = ((cards ?? []) as Pick<
    CardRow,
    "id" | "name" | "purchase_id" | "purchase_price" | "purchase_date"
  >[]).filter(isUnlinkedCardCost);

  const totalSpent =
    purchaseList.reduce((sum, p) => sum + purchaseTotal(p), 0) +
    unlinkedCards.reduce((sum, c) => sum + Number(c.purchase_price ?? 0), 0) +
    transactionList
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalRevenue =
    saleList.reduce((sum, s) => sum + Number(s.net_amount ?? 0), 0) +
    transactionList
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  const netMargin = totalRevenue - totalSpent;

  const buckets = buildBuckets(start, end);
  const chartData = buckets.map((bucket) => {
    const bucketPurchases =
      purchaseList
        .filter((p) => p.date >= bucket.start && p.date <= bucket.end)
        .reduce((sum, p) => sum + purchaseTotal(p), 0) +
      unlinkedCards
        .filter(
          (c) =>
            c.purchase_date &&
            c.purchase_date >= bucket.start &&
            c.purchase_date <= bucket.end,
        )
        .reduce((sum, c) => sum + Number(c.purchase_price ?? 0), 0) +
      transactionList
        .filter(
          (t) =>
            t.type === "expense" &&
            transactionDate(t) >= bucket.start &&
            transactionDate(t) <= bucket.end,
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);
    const bucketSales =
      saleList
        .filter((s) => s.sale_date >= bucket.start && s.sale_date <= bucket.end)
        .reduce((sum, s) => sum + Number(s.net_amount ?? 0), 0) +
      transactionList
        .filter(
          (t) =>
            t.type === "income" &&
            transactionDate(t) >= bucket.start &&
            transactionDate(t) <= bucket.end,
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);
    return { label: bucket.label, purchases: bucketPurchases, sales: bucketSales };
  });

  const combinedRows = [
    ...purchaseList.map((p) => ({
      type: "purchase" as const,
      date: p.date,
      label: `Acquisto — ${p.source}`,
      amount: -purchaseTotal(p),
    })),
    ...unlinkedCards.map((c) => ({
      type: "card_cost" as const,
      date: c.purchase_date as string,
      label: `Costo carta — ${c.name}`,
      amount: -Number(c.purchase_price ?? 0),
    })),
    ...saleList.map((s) => ({
      type: "sale" as const,
      date: s.sale_date,
      label: `Vendita — ${s.marketplace}`,
      amount: Number(s.net_amount ?? 0),
    })),
    ...transactionList.map((t) => ({
      type: "extra" as const,
      date: transactionDate(t),
      label: `${t.type === "income" ? "Entrata extra" : "Spesa extra"}${
        t.description ? ` — ${t.description}` : ""
      }`,
      amount: t.type === "income" ? Number(t.amount) : -Number(t.amount),
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const periodLabel = formatPeriodLabel(period, start, end);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Resoconto</h1>
        <p className="text-sm text-muted-foreground">
          Analisi di acquisti, vendite e margine per periodo.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <PeriodFilter period={period} from={params.from ?? start} to={params.to ?? end} />
          <p className="mt-4 text-sm text-muted-foreground">
            Periodo selezionato: <span className="font-medium text-foreground">{periodLabel}</span>
          </p>
        </CardContent>
      </Card>

      {(purchasesError || salesError || transactionsError || cardsError) && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento dei dati del resoconto.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Totale acquistato"
          value={`€${totalSpent.toFixed(2)}`}
          accent="gold"
          icon={TrendingDown}
        />
        <KpiCard
          label="Totale venduto (netto)"
          value={`€${totalRevenue.toFixed(2)}`}
          accent="emerald"
          icon={TrendingUp}
        />
        <KpiCard
          label="Margine netto"
          value={`${netMargin >= 0 ? "+" : "-"}€${Math.abs(netMargin).toFixed(2)}`}
          accent={netMargin >= 0 ? "emerald" : "magenta"}
          icon={PiggyBank}
        />
        <KpiCard
          label="Transazioni"
          value={
            purchaseList.length +
            saleList.length +
            transactionList.length +
            unlinkedCards.length
          }
          accent="violet"
          icon={ArrowLeftRight}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Andamento acquisti vs vendite</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendingChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dettaglio movimenti</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Movimento</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {combinedRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                      Nessun movimento nel periodo selezionato.
                    </TableCell>
                  </TableRow>
                )}
                {combinedRows.map((row, index) => (
                  <TableRow key={`${row.type}-${index}`}>
                    <TableCell>{formatISODate(row.date)}</TableCell>
                    <TableCell>{row.label}</TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-medium",
                        row.amount >= 0 ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {row.amount >= 0 ? "+" : "-"}€{Math.abs(row.amount).toFixed(2)}
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
