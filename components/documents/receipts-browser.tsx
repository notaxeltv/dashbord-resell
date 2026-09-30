"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, Printer } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/ui/sortable-head";
import {
  ReceiptDialog,
  type PurchaseOptionForReceipt,
} from "@/components/documents/receipt-dialog";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { formatISODate } from "@/lib/dates";
import { downloadCsv } from "@/lib/csv";
import { useSort } from "@/lib/use-sort";
import type { Profile, PurchaseReceipt } from "@/lib/types";

type SortKey = "date" | "number" | "seller" | "amount";

export function ReceiptsBrowser({
  receipts,
  profiles,
  purchaseOptions,
}: {
  receipts: PurchaseReceipt[];
  profiles: Profile[];
  purchaseOptions: PurchaseOptionForReceipt[];
}) {
  const [query, setQuery] = useState("");

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return receipts;
    return receipts.filter((receipt) => {
      const author = profileMap.get(receipt.created_by);
      return [
        receipt.seller_name,
        receipt.description,
        `${receipt.number}/${receipt.year}`,
        author?.display_name,
        author?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [receipts, query, profileMap]);

  const { sorted, sortKey, direction, toggleSort } = useSort<PurchaseReceipt, SortKey>(
    filtered,
    (receipt, key) => {
      if (key === "date") return receipt.issue_date;
      if (key === "number") return receipt.year * 100000 + receipt.number;
      if (key === "seller") return receipt.seller_name;
      return Number(receipt.amount);
    },
    "date",
  );

  function exportCsv() {
    downloadCsv(
      `ricevute-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Numero", "Data", "Venditore", "Descrizione", "Importo", "Creata da"],
      sorted.map((receipt) => {
        const author = profileMap.get(receipt.created_by);
        return [
          `${receipt.number}/${receipt.year}`,
          formatISODate(receipt.issue_date),
          receipt.seller_name,
          receipt.description,
          Number(receipt.amount).toFixed(2),
          author?.display_name ?? author?.email ?? "",
        ];
      }),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca venditore, descrizione o numero…"
          className="sm:max-w-xs"
        />
        <ReceiptDialog purchaseOptions={purchaseOptions} triggerClassName="sm:ml-auto" />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={sorted.length === 0}
          onClick={exportCsv}
        >
          <Download className="mr-2 h-4 w-4" />
          Esporta CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {sorted.length} di {receipts.length} ricevute
      </p>

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nessuna ricevuta corrisponde alla ricerca.
        </p>
      )}

      {sorted.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sorted.map((receipt) => {
            const author = profileMap.get(receipt.created_by);
            return (
              <div key={receipt.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      Ricevuta n. {receipt.number}/{receipt.year}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {receipt.seller_name} · {formatISODate(receipt.issue_date)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    €{Number(receipt.amount).toFixed(2)}
                  </p>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Inserita da {author?.display_name ?? author?.email ?? "-"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link
                      href={`/dashboard/documents/receipts/${receipt.id}/print`}
                      target="_blank"
                    >
                      <Printer className="mr-2 h-4 w-4" />
                      Stampa
                    </Link>
                  </Button>
                  <ReceiptDialog receipt={receipt} purchaseOptions={purchaseOptions} />
                  <DeleteDocumentButton
                    table="purchase_receipts"
                    id={receipt.id}
                    confirmLabel={`Eliminare la ricevuta n. ${receipt.number}/${receipt.year}?`}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {sorted.length > 0 && (
        <div className="hidden overflow-x-auto sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label="Numero"
                  active={sortKey === "number"}
                  direction={direction}
                  onSort={() => toggleSort("number")}
                />
                <SortableHead
                  label="Data"
                  active={sortKey === "date"}
                  direction={direction}
                  onSort={() => toggleSort("date")}
                />
                <SortableHead
                  label="Venditore"
                  active={sortKey === "seller"}
                  direction={direction}
                  onSort={() => toggleSort("seller")}
                />
                <SortableHead
                  label="Importo"
                  active={sortKey === "amount"}
                  direction={direction}
                  onSort={() => toggleSort("amount")}
                />
                <TableHead>Creata da</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((receipt) => {
                const author = profileMap.get(receipt.created_by);
                return (
                  <TableRow key={receipt.id}>
                    <TableCell>
                      {receipt.number}/{receipt.year}
                    </TableCell>
                    <TableCell>{formatISODate(receipt.issue_date)}</TableCell>
                    <TableCell>{receipt.seller_name}</TableCell>
                    <TableCell className="font-medium">
                      €{Number(receipt.amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {author?.display_name ?? author?.email ?? "-"}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/dashboard/documents/receipts/${receipt.id}/print`}
                          target="_blank"
                        >
                          Stampa
                        </Link>
                      </Button>
                      <ReceiptDialog receipt={receipt} purchaseOptions={purchaseOptions} />
                      <DeleteDocumentButton
                        table="purchase_receipts"
                        id={receipt.id}
                        confirmLabel={`Eliminare la ricevuta n. ${receipt.number}/${receipt.year}?`}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
