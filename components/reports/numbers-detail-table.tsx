"use client";

import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import { formatISODate } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type NumbersRow = {
  type: string;
  date: string;
  label: string;
  amount: number;
};

export function NumbersDetailTable({
  rows,
  periodLabel,
}: {
  rows: NumbersRow[];
  periodLabel: string;
}) {
  function exportCsv() {
    downloadCsv(
      `numeri-${periodLabel.replace(/\s+/g, "-").toLowerCase()}.csv`,
      ["Data", "Movimento", "Importo"],
      rows.map((row) => [
        formatISODate(row.date),
        row.label,
        row.amount.toFixed(2),
      ]),
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={rows.length === 0}
          onClick={exportCsv}
        >
          <Download className="mr-2 h-4 w-4" />
          Esporta CSV
        </Button>
      </div>
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
            {rows.length === 0 && (
              <TableRow>
                <TableCell colSpan={3} className="py-8 text-center text-muted-foreground">
                  Nessun movimento nel periodo.
                </TableCell>
              </TableRow>
            )}
            {rows.map((row, index) => (
              <TableRow key={`${row.type}-${index}`}>
                <TableCell>{formatISODate(row.date)}</TableCell>
                <TableCell>{row.label}</TableCell>
                <TableCell
                  className={cn(
                    "text-right font-medium",
                    row.amount >= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-red-600 dark:text-red-400",
                  )}
                >
                  {row.amount >= 0 ? "+" : "-"}€{Math.abs(row.amount).toFixed(2)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
