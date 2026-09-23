import {
  Coins,
  FileText,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

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
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { YearFilter } from "@/components/accounting/year-filter";
import { NewTransactionDialog } from "@/components/accounting/new-transaction-dialog";
import { DeleteTransactionButton } from "@/components/accounting/delete-transaction-button";
import { TaxEstimator } from "@/components/accounting/tax-estimator";
import { cn } from "@/lib/utils";
import type { Profile, Purchase, Sale, Transaction } from "@/lib/types";

export const dynamic = "force-dynamic";

const MONTH_LABELS = [
  "Gennaio",
  "Febbraio",
  "Marzo",
  "Aprile",
  "Maggio",
  "Giugno",
  "Luglio",
  "Agosto",
  "Settembre",
  "Ottobre",
  "Novembre",
  "Dicembre",
];

export default async function AccountingPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string }>;
}) {
  const params = await searchParams;
  const currentYear = new Date().getFullYear();

  const supabase = await createSupabaseServerClient();

  const [
    { data: purchases, error: purchasesError },
    { data: sales, error: salesError },
    { data: transactions, error: transactionsError },
    { data: profiles },
  ] = await Promise.all([
    supabase.from("purchases").select("*"),
    supabase.from("sales").select("*"),
    supabase.from("transactions").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, email, display_name, role, created_at"),
  ]);

  const purchaseList = (purchases ?? []) as Purchase[];
  const saleList = (sales ?? []) as Sale[];
  const transactionList = (transactions ?? []) as Transaction[];
  const profileMap = new Map(
    (profiles ?? []).map((profile: Profile) => [profile.id, profile]),
  );

  const yearsWithData = new Set<number>([currentYear]);
  purchaseList.forEach((p) => yearsWithData.add(new Date(p.date).getFullYear()));
  saleList.forEach((s) => yearsWithData.add(new Date(s.sale_date).getFullYear()));
  transactionList.forEach((t) =>
    yearsWithData.add(new Date(t.created_at).getFullYear()),
  );
  const years = Array.from(yearsWithData).sort((a, b) => b - a);

  const selectedYear = Number(params.year) || currentYear;

  const yearPurchases = purchaseList.filter(
    (p) => new Date(p.date).getFullYear() === selectedYear,
  );
  const yearSales = saleList.filter(
    (s) => new Date(s.sale_date).getFullYear() === selectedYear,
  );
  const yearTransactions = transactionList.filter(
    (t) => new Date(t.created_at).getFullYear() === selectedYear,
  );

  const revenueFromSales = yearSales.reduce(
    (sum, s) => sum + Number(s.net_amount ?? 0),
    0,
  );
  const costFromPurchases = yearPurchases.reduce(
    (sum, p) => sum + Number(p.total_amount) + Number(p.shipping_cost ?? 0),
    0,
  );
  const extraIncome = yearTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);
  const extraExpense = yearTransactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalRevenue = revenueFromSales + extraIncome;
  const totalCosts = costFromPurchases + extraExpense;
  const netProfit = totalRevenue - totalCosts;

  const monthlyBreakdown = MONTH_LABELS.map((label, month) => {
    const monthSales = yearSales.filter(
      (s) => new Date(s.sale_date).getMonth() === month,
    );
    const monthPurchases = yearPurchases.filter(
      (p) => new Date(p.date).getMonth() === month,
    );
    const monthTransactions = yearTransactions.filter(
      (t) => new Date(t.created_at).getMonth() === month,
    );
    const revenue =
      monthSales.reduce((sum, s) => sum + Number(s.net_amount ?? 0), 0) +
      monthTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);
    const costs =
      monthPurchases.reduce(
        (sum, p) => sum + Number(p.total_amount) + Number(p.shipping_cost ?? 0),
        0,
      ) +
      monthTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);
    return { label, revenue, costs, profit: revenue - costs };
  });

  const error = purchasesError || salesError || transactionsError;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Contabilità</h1>
        <p className="text-sm text-muted-foreground">
          Bilancio automatico e stima delle tasse in base ad acquisti,
          vendite e movimenti extra.
        </p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <YearFilter years={years} selected={selectedYear} />
        </CardContent>
      </Card>

      {error && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          Errore nel caricamento dei dati contabili.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Ricavi totali"
          value={`€${totalRevenue.toFixed(2)}`}
          accent="emerald"
          icon={TrendingUp}
          hint="Vendite nette + entrate extra"
        />
        <KpiCard
          label="Costi totali"
          value={`€${totalCosts.toFixed(2)}`}
          accent="gold"
          icon={TrendingDown}
          hint="Acquisti carte + spese extra"
        />
        <KpiCard
          label="Utile netto"
          value={`${netProfit >= 0 ? "+" : "-"}€${Math.abs(netProfit).toFixed(2)}`}
          accent={netProfit >= 0 ? "emerald" : "magenta"}
          icon={PiggyBank}
          hint={`Anno ${selectedYear}`}
        />
        <KpiCard
          label="Movimenti extra"
          value={yearTransactions.length}
          accent="violet"
          icon={Receipt}
          hint="Entrate/spese non legate a carte"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conto economico mensile — {selectedYear}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mese</TableHead>
                  <TableHead className="text-right">Ricavi</TableHead>
                  <TableHead className="text-right">Costi</TableHead>
                  <TableHead className="text-right">Utile</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {monthlyBreakdown.map((row) => (
                  <TableRow key={row.label}>
                    <TableCell className="font-medium">{row.label}</TableCell>
                    <TableCell className="text-right text-emerald-600">
                      €{row.revenue.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-amber-600">
                      €{row.costs.toFixed(2)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right font-semibold",
                        row.profit >= 0 ? "text-emerald-600" : "text-red-600",
                      )}
                    >
                      {row.profit >= 0 ? "+" : "-"}€{Math.abs(row.profit).toFixed(2)}
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-muted/40">
                  <TableCell className="font-bold">Totale anno</TableCell>
                  <TableCell className="text-right font-bold text-emerald-600">
                    €{totalRevenue.toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right font-bold text-amber-600">
                    €{totalCosts.toFixed(2)}
                  </TableCell>
                  <TableCell
                    className={cn(
                      "text-right font-bold",
                      netProfit >= 0 ? "text-emerald-600" : "text-red-600",
                    )}
                  >
                    {netProfit >= 0 ? "+" : "-"}€{Math.abs(netProfit).toFixed(2)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4" /> Stima imposte — {selectedYear}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TaxEstimator totalRevenue={totalRevenue} netProfit={netProfit} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4" /> Movimenti extra
          </CardTitle>
          <NewTransactionDialog />
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Descrizione</TableHead>
                  <TableHead className="text-right">Importo</TableHead>
                  <TableHead>Inserito da</TableHead>
                  <TableHead className="text-right">Azioni</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yearTransactions.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={6}
                      className="py-8 text-center text-muted-foreground"
                    >
                      Nessun movimento extra registrato per il {selectedYear}.
                    </TableCell>
                  </TableRow>
                )}
                {yearTransactions.map((transaction) => {
                  const author = profileMap.get(transaction.created_by);
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        {new Date(transaction.created_at).toLocaleDateString("it-IT")}
                      </TableCell>
                      <TableCell>
                        <Badge variant={transaction.type === "income" ? "success" : "warning"}>
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
                      <TableCell className="text-right">
                        <DeleteTransactionButton transactionId={transaction.id} />
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
