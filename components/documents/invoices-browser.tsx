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
import { InvoiceDialog, type SaleOption } from "@/components/documents/invoice-dialog";
import { DeleteDocumentButton } from "@/components/documents/delete-document-button";
import { formatISODate } from "@/lib/dates";
import { downloadCsv } from "@/lib/csv";
import { useSort } from "@/lib/use-sort";
import type { BusinessProfile, Invoice, Profile } from "@/lib/types";

type SortKey = "date" | "number" | "client" | "total";

export function InvoicesBrowser({
  invoices,
  profiles,
  saleOptions,
  businessProfile,
}: {
  invoices: Invoice[];
  profiles: Profile[];
  saleOptions: SaleOption[];
  businessProfile: BusinessProfile | null;
}) {
  const [query, setQuery] = useState("");

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return invoices;
    return invoices.filter((invoice) => {
      const author = profileMap.get(invoice.created_by);
      return [
        invoice.client_name,
        invoice.client_vat_number,
        invoice.description,
        `${invoice.number}/${invoice.year}`,
        author?.display_name,
        author?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [invoices, query, profileMap]);

  const { sorted, sortKey, direction, toggleSort } = useSort<Invoice, SortKey>(
    filtered,
    (invoice, key) => {
      if (key === "date") return invoice.issue_date;
      if (key === "number") return invoice.year * 100000 + invoice.number;
      if (key === "client") return invoice.client_name;
      return Number(invoice.total_amount);
    },
    "date",
  );

  function exportCsv() {
    downloadCsv(
      `fatture-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Numero", "Data", "Cliente", "P.IVA", "Imponibile", "IVA", "Totale", "Creata da"],
      sorted.map((invoice) => {
        const author = profileMap.get(invoice.created_by);
        return [
          `${invoice.number}/${invoice.year}`,
          formatISODate(invoice.issue_date),
          invoice.client_name,
          invoice.client_vat_number ?? "",
          Number(invoice.taxable_amount).toFixed(2),
          Number(invoice.vat_amount).toFixed(2),
          Number(invoice.total_amount).toFixed(2),
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
          placeholder="Cerca cliente, P.IVA o numero…"
          className="sm:max-w-xs"
        />
        <InvoiceDialog
          saleOptions={saleOptions}
          businessProfile={businessProfile}
          triggerClassName="sm:ml-auto"
        />
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
        {sorted.length} di {invoices.length} fatture
      </p>

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nessuna fattura corrisponde alla ricerca.
        </p>
      )}

      {sorted.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sorted.map((invoice) => {
            const author = profileMap.get(invoice.created_by);
            return (
              <div key={invoice.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      Fattura n. {invoice.number}/{invoice.year}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {invoice.client_name} · {formatISODate(invoice.issue_date)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    €{Number(invoice.total_amount).toFixed(2)}
                  </p>
                </div>

                <p className="mt-2 text-xs text-muted-foreground">
                  Inserita da {author?.display_name ?? author?.email ?? "-"}
                </p>

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline" size="sm" className="flex-1">
                    <Link href={`/dashboard/documents/invoices/${invoice.id}/print`} target="_blank">
                      <Printer className="mr-2 h-4 w-4" />
                      Stampa
                    </Link>
                  </Button>
                  <InvoiceDialog
                    invoice={invoice}
                    saleOptions={saleOptions}
                    businessProfile={businessProfile}
                  />
                  <DeleteDocumentButton
                    table="invoices"
                    id={invoice.id}
                    confirmLabel={`Eliminare la fattura n. ${invoice.number}/${invoice.year}?`}
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
                  label="Cliente"
                  active={sortKey === "client"}
                  direction={direction}
                  onSort={() => toggleSort("client")}
                />
                <SortableHead
                  label="Totale"
                  active={sortKey === "total"}
                  direction={direction}
                  onSort={() => toggleSort("total")}
                />
                <TableHead>Creata da</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((invoice) => {
                const author = profileMap.get(invoice.created_by);
                return (
                  <TableRow key={invoice.id}>
                    <TableCell>
                      {invoice.number}/{invoice.year}
                    </TableCell>
                    <TableCell>{formatISODate(invoice.issue_date)}</TableCell>
                    <TableCell>{invoice.client_name}</TableCell>
                    <TableCell className="font-medium">
                      €{Number(invoice.total_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {author?.display_name ?? author?.email ?? "-"}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      <Button asChild variant="outline" size="sm">
                        <Link
                          href={`/dashboard/documents/invoices/${invoice.id}/print`}
                          target="_blank"
                        >
                          Stampa
                        </Link>
                      </Button>
                      <InvoiceDialog
                        invoice={invoice}
                        saleOptions={saleOptions}
                        businessProfile={businessProfile}
                      />
                      <DeleteDocumentButton
                        table="invoices"
                        id={invoice.id}
                        confirmLabel={`Eliminare la fattura n. ${invoice.number}/${invoice.year}?`}
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
