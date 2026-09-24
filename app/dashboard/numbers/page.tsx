import { ArrowLeftRight, Coins, FileText, PiggyBank, TrendingDown, TrendingUp } from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PeriodFilter } from "@/components/reports/period-filter";
import { SpendingChart } from "@/components/reports/spending-chart";
import { TransactionDialog } from "@/components/accounting/transaction-dialog";
import { DeleteTransactionButton } from "@/components/accounting/delete-transaction-button";
import { TaxEstimator } from "@/components/accounting/tax-estimator";
import { cn } from "@/lib/utils";
import { formatISODate, yearFromISODate } from "@/lib/dates";
import { isUnlinkedCardCost, purchaseTotal, transactionDate } from "@/lib/finance";
import { buildBuckets, formatPeriodLabel, getPeriodRange, inRange } from "@/lib/period";
import type { Card as CardRow, Profile, Purchase, Sale, Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NumbersPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const period = params.period ?? "month";
  const { start, end } = getPeriodRange(period, params.from, params.to);
  const taxYear = yearFromISODate(end);

  const supabase = await createSupabaseServerClient();

  const [
    { data: purchases, error: purchasesError },
    { data: sales, error: salesError },
    { data: transactions, error: transactionsError },
    { data: cards, error: cardsError },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("purchases").select("*"),
    supabase.from("sales").select("*"),
    supabase.from("transactions").select("*").order("date", { ascending: false }),
    supabase.from("cards").select("id, name, purchase_id, purchase_price, purchase_date"),
    supabase.from("profiles").select("id, email, display_name, role, created_at"),
  ]);

  const purchaseList = (purchases ?? []) as Purchase[];
  const saleList = (sales ?? []) as Sale[];
  const transactionList = (transactions ?? []) as Transaction[];
  const cardList = (cards ?? []) as Pick<
    CardRow,
    "id" | "name" | "purchase_id" | "purchase_price" | "purchase_date"
  >[];
  const profileMap = new Map(
    (profiles ?? []).map((profile: Profile) => [profile.id, profile]),
  );

  const periodPurchases = purchaseList.filter((p) => inRange(p.date, start, end));
  const periodSales = saleList.filter((s) => inRange(s.sale_date, start, end));
  const periodTransactions = transactionList.filter((t) =>
    inRange(transactionDate(t), start, end),
  );
  const periodUnlinked = cardList.filter(
    (c) =>
      isUnlinkedCardCost(c) &&
      c.purchase_date &&
      inRange(c.purchase_date, start, end),
  );

  const totalSpent =
    periodPurchases.reduce((sum, p) => sum + purchaseTotal(p), 0) +
    periodUnlinked.reduce((sum, c) => sum + Number(c.purchase_price ?? 0), 0) +
    periodTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  const totalRevenue =
    periodSales.reduce((sum, s) => sum + Number(s.net_amount ?? 0), 0) +
    periodTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  const netMargin = totalRevenue - totalSpent;

  const buckets = buildBuckets(start, end);
  const chartData = buckets.map((bucket) => {
    const costs =
      periodPurchases
        .filter((p) => p.date >= bucket.start && p.date <= bucket.end)
        .reduce((sum, p) => sum + purchaseTotal(p), 0) +
      periodUnlinked
        .filter(
          (c) =>
            c.purchase_date &&
            c.purchase_date >= bucket.start &&
            c.purchase_date <= bucket.end,
        )
        .reduce((sum, c) => sum + Number(c.purchase_price ?? 0), 0) +
      periodTransactions
        .filter(
          (t) =>
            t.type === "expense" &&
            inRange(transactionDate(t), bucket.start, bucket.end),
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);
    const sales =
      periodSales
        .filter((s) => s.sale_date >= bucket.start && s.sale_date <= bucket.end)
        .reduce((sum, s) => sum + Number(s.net_amount ?? 0), 0) +
      periodTransactions
        .filter(
          (t) =>
            t.type === "income" &&
            inRange(transactionDate(t), bucket.start, bucket.end),
        )
        .reduce((sum, t) => sum + Number(t.amount), 0);
    return { label: bucket.label, purchases: costs, sales };
  });

  const combinedRows = [
    ...periodPurchases.map((p) => ({
      type: "purchase" as const,
      date: p.date,
      label: `Lotto — ${p.source}`,
      amount: -purchaseTotal(p),
    })),
    ...periodUnlinked.map((c) => ({
      type: "card_cost" as const,
      date: c.purchase_date as string,
      label: `Costo carta — ${c.name}`,
      amount: -Number(c.purchase_price ?? 0),
    })),
    ...periodSales.map((s) => ({
      type: "sale" as const,
      date: s.sale_date,
      label: `Vendita — ${s.marketplace}`,
      amount: Number(s.net_amount ?? 0),
    })),
    ...periodTransactions.map((t) => ({
      type: "extra" as const,
      date: transactionDate(t),
      label: `${t.type === "income" ? "Entrata extra" : "Spesa extra"}${
        t.description ? ` — ${t.description}` : ""
      }`,
      amount: t.type === "income" ? Number(t.amount) : -Number(t.amount),
    })),
  ].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));

  const yearPurchases = purchaseList.filter((p) => yearFromISODate(p.date) === taxYear);
  const yearSales = saleList.filter((s) => yearFromISODate(s.sale_date) === taxYear);
  const yearTransactions = transactionList.filter(
    (t) => yearFromISODate(transactionDate(t)) === taxYear,
  );
  const yearUnlinked = cardList.filter(
    (c) =>
      isUnlinkedCardCost(c) &&
      c.purchase_date &&
      yearFromISODate(c.purchase_date) === taxYear,
  );
  const yearRevenue =
    yearSales.reduce((sum, s) => sum + Number(s.net_amount ?? 0), 0) +
    yearTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  const yearCosts =
    yearPurchases.reduce((sum, p) => sum + purchaseTotal(p), 0) +
    yearUnlinked.reduce((sum, c) => sum + Number(c.purchase_price ?? 0), 0) +
    yearTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);
  const yearProfit = yearRevenue - yearCosts;

  const periodLabel = formatPeriodLabel(period, start, end);
  const error = purchasesError || salesError || transactionsError || cardsError;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Numeri</h1>
        <p className="text-sm text-muted-foreground">
          Uscite, entrate e margine. Le tasse sotto sono una stima sull&apos;anno{" "}
          {taxYear}.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <PeriodFilter period={period} from={params.from ?? start} to={params.to ?? end} />
          <p className="mt-4 text-sm text-muted-foreground">
            Periodo: <span className="font-medium text-foreground">{periodLabel}</span>
          </p>
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento dei numeri.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Uscite"
          value={`€${totalSpent.toFixed(2)}`}
          accent="gold"
          icon={TrendingDown}
        />
        <KpiCard
          label="Entrate"
          value={`€${totalRevenue.toFixed(2)}`}
          accent="emerald"
          icon={TrendingUp}
        />
        <KpiCard
          label="Margine"
          value={`${netMargin >= 0 ? "+" : "-"}€${Math.abs(netMargin).toFixed(2)}`}
          accent={netMargin >= 0 ? "emerald" : "magenta"}
          icon={PiggyBank}
        />
        <KpiCard
          label="Movimenti"
          value={combinedRows.length}
          accent="violet"
          icon={ArrowLeftRight}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Andamento uscite vs entrate</CardTitle>
        </CardHeader>
        <CardContent>
          <SpendingChart data={chartData} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dettaglio</CardTitle>
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
                      Nessun movimento nel periodo.
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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4" /> Extra (abbonamenti, imballo…)
          </CardTitle>
          <TransactionDialog />
        </CardHeader>
        <CardContent>
          {periodTransactions.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              Nessuna spesa o entrata extra in questo periodo.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead>Descrizione</TableHead>
                    <TableHead className="text-right">Importo</TableHead>
                    <TableHead>Chi</TableHead>
                    <TableHead className="text-right">Azioni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {periodTransactions.map((transaction) => {
                    const author = profileMap.get(transaction.created_by);
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>{formatISODate(transactionDate(transaction))}</TableCell>
                        <TableCell>
                          <Badge
                            variant={transaction.type === "income" ? "success" : "warning"}
                          >
                            {transaction.type === "income" ? "Entrata" : "Spesa"}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[240px] truncate">
                          {transaction.description ?? "-"}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-medium",
                            transaction.type === "income"
                              ? "text-emerald-600"
                              : "text-amber-600",
                          )}
                        >
                          {transaction.type === "income" ? "+" : "-"}€
                          {Number(transaction.amount).toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {author?.display_name ?? author?.email ?? "-"}
                        </TableCell>
                        <TableCell className="space-x-2 whitespace-nowrap text-right">
                          <TransactionDialog transaction={transaction} />
                          <DeleteTransactionButton transactionId={transaction.id} />
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Stima tasse {taxYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaxEstimator totalRevenue={yearRevenue} netProfit={yearProfit} />
        </CardContent>
      </Card>
    </div>
  );
}
