"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/ui/sortable-head";
import { PurchaseDialog } from "@/components/purchases/purchase-dialog";
import { DeletePurchaseButton } from "@/components/purchases/delete-purchase-button";
import { formatISODate } from "@/lib/dates";
import { purchaseTotal } from "@/lib/finance";
import { downloadCsv } from "@/lib/csv";
import { useSort } from "@/lib/use-sort";
import { optionLabel, PURCHASE_SOURCES, SELECT_NONE } from "@/lib/constants";
import type { Purchase, Profile } from "@/lib/types";

type SortKey = "date" | "source" | "total" | "shipping";

export function PurchasesBrowser({
  purchases,
  profiles,
}: {
  purchases: Purchase[];
  profiles: Profile[];
}) {
  const [query, setQuery] = useState("");
  const [source, setSource] = useState(SELECT_NONE);

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return purchases.filter((purchase) => {
      if (source !== SELECT_NONE && purchase.source !== source) return false;
      if (!needle) return true;
      const author = profileMap.get(purchase.created_by);
      return [
        optionLabel(PURCHASE_SOURCES, purchase.source),
        purchase.notes,
        author?.display_name,
        author?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [purchases, query, source, profileMap]);

  const { sorted, sortKey, direction, toggleSort } = useSort<Purchase, SortKey>(
    filtered,
    (purchase, key) => {
      if (key === "date") return purchase.date;
      if (key === "source") return optionLabel(PURCHASE_SOURCES, purchase.source);
      if (key === "shipping") return Number(purchase.shipping_cost ?? 0);
      return purchaseTotal(purchase);
    },
    "date",
  );

  function exportCsv() {
    downloadCsv(
      `lotti-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data", "Fonte", "Totale", "Spedizione", "Note", "Inserito da"],
      sorted.map((purchase) => {
        const author = profileMap.get(purchase.created_by);
        return [
          formatISODate(purchase.date),
          optionLabel(PURCHASE_SOURCES, purchase.source),
          Number(purchase.total_amount).toFixed(2),
          Number(purchase.shipping_cost ?? 0).toFixed(2),
          purchase.notes ?? "",
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
          placeholder="Cerca fonte, note o autore…"
          className="sm:max-w-xs"
        />
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tutte le fonti" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_NONE}>Tutte le fonti</SelectItem>
            {PURCHASE_SOURCES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="sm:ml-auto"
          disabled={sorted.length === 0}
          onClick={exportCsv}
        >
          <Download className="mr-2 h-4 w-4" />
          Esporta CSV
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        {sorted.length} di {purchases.length} lotti
      </p>

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nessun lotto corrisponde alla ricerca.
        </p>
      )}

      {/* Vista a card impilate per mobile: evita che i bottoni Modifica/
          Elimina finiscano fuori schermo richiedendo scroll orizzontale. */}
      {sorted.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sorted.map((purchase) => {
            const author = profileMap.get(purchase.created_by);
            return (
              <div
                key={purchase.id}
                className="rounded-lg border border-border/60 p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {optionLabel(PURCHASE_SOURCES, purchase.source)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {formatISODate(purchase.date)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    €{Number(purchase.total_amount).toFixed(2)}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Spedizione</p>
                    <p className="font-medium text-foreground">
                      €{Number(purchase.shipping_cost ?? 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Inserito da</p>
                    <p className="font-medium text-foreground">
                      {author?.display_name ?? author?.email ?? "-"}
                    </p>
                  </div>
                </div>

                {purchase.notes && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {purchase.notes}
                  </p>
                )}

                <div className="mt-3 flex gap-2">
                  <PurchaseDialog purchase={purchase} triggerClassName="flex-1" />
                  <DeletePurchaseButton purchaseId={purchase.id} />
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Vista tabellare per tablet/desktop. */}
      {sorted.length > 0 && (
        <div className="hidden overflow-x-auto sm:block">
          <Table>
            <TableHeader>
              <TableRow>
                <SortableHead
                  label="Data"
                  active={sortKey === "date"}
                  direction={direction}
                  onSort={() => toggleSort("date")}
                />
                <SortableHead
                  label="Fonte"
                  active={sortKey === "source"}
                  direction={direction}
                  onSort={() => toggleSort("source")}
                />
                <SortableHead
                  label="Totale"
                  active={sortKey === "total"}
                  direction={direction}
                  onSort={() => toggleSort("total")}
                />
                <SortableHead
                  label="Spedizione"
                  active={sortKey === "shipping"}
                  direction={direction}
                  onSort={() => toggleSort("shipping")}
                />
                <TableHead>Note</TableHead>
                <TableHead>Inserito da</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((purchase) => {
                const author = profileMap.get(purchase.created_by);
                return (
                  <TableRow key={purchase.id}>
                    <TableCell>{formatISODate(purchase.date)}</TableCell>
                    <TableCell>
                      {optionLabel(PURCHASE_SOURCES, purchase.source)}
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
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      <PurchaseDialog purchase={purchase} />
                      <DeletePurchaseButton purchaseId={purchase.id} />
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
