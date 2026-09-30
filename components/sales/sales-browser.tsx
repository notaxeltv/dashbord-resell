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
import { SaleDialog, type CardOption } from "@/components/sales/sale-dialog";
import { DeleteSaleButton } from "@/components/sales/delete-sale-button";
import { formatISODate } from "@/lib/dates";
import { downloadCsv } from "@/lib/csv";
import { useSort } from "@/lib/use-sort";
import { optionLabel, MARKETPLACES, SELECT_NONE } from "@/lib/constants";
import type { Sale, Profile } from "@/lib/types";

type SaleCard = { id: string; name: string; set_name: string | null; status: string };
type SortKey = "date" | "marketplace" | "price" | "net";

export function SalesBrowser({
  sales,
  profiles,
  cards,
  availableCards,
}: {
  sales: Sale[];
  profiles: Profile[];
  cards: SaleCard[];
  availableCards: CardOption[];
}) {
  const [query, setQuery] = useState("");
  const [marketplace, setMarketplace] = useState(SELECT_NONE);

  const profileMap = useMemo(
    () => new Map(profiles.map((profile) => [profile.id, profile])),
    [profiles],
  );
  const cardMap = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards],
  );

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return sales.filter((sale) => {
      if (marketplace !== SELECT_NONE && sale.marketplace !== marketplace) return false;
      if (!needle) return true;
      const card = cardMap.get(sale.card_id);
      const author = profileMap.get(sale.sold_by);
      return [
        card?.name,
        card?.set_name,
        optionLabel(MARKETPLACES, sale.marketplace),
        sale.buyer_info,
        sale.notes,
        author?.display_name,
        author?.email,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [sales, query, marketplace, cardMap, profileMap]);

  const { sorted, sortKey, direction, toggleSort } = useSort<Sale, SortKey>(
    filtered,
    (sale, key) => {
      if (key === "date") return sale.sale_date;
      if (key === "marketplace") return optionLabel(MARKETPLACES, sale.marketplace);
      if (key === "price") return Number(sale.sale_price);
      return Number(sale.net_amount ?? 0);
    },
    "date",
  );

  function exportCsv() {
    downloadCsv(
      `vendite-${new Date().toISOString().slice(0, 10)}.csv`,
      ["Data", "Carta", "Marketplace", "Prezzo", "Fee", "Netto", "Venduto da"],
      sorted.map((sale) => {
        const card = cardMap.get(sale.card_id);
        const author = profileMap.get(sale.sold_by);
        return [
          formatISODate(sale.sale_date),
          card?.name ?? "Carta eliminata",
          optionLabel(MARKETPLACES, sale.marketplace),
          Number(sale.sale_price).toFixed(2),
          Number(sale.fees).toFixed(2),
          Number(sale.net_amount).toFixed(2),
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
          placeholder="Cerca carta, marketplace o acquirente…"
          className="sm:max-w-xs"
        />
        <Select value={marketplace} onValueChange={setMarketplace}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tutti i marketplace" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_NONE}>Tutti i marketplace</SelectItem>
            {MARKETPLACES.map((item) => (
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
        {sorted.length} di {sales.length} vendite
      </p>

      {sorted.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nessuna vendita corrisponde alla ricerca.
        </p>
      )}

      {/* Vista a card impilate per mobile: evita che i bottoni Modifica/
          Elimina finiscano fuori schermo richiedendo scroll orizzontale. */}
      {sorted.length > 0 && (
        <div className="space-y-3 sm:hidden">
          {sorted.map((sale) => {
            const card = cardMap.get(sale.card_id);
            const author = profileMap.get(sale.sold_by);
            const cardLabel = card
              ? `${card.name}${card.set_name ? ` (${card.set_name})` : ""}`
              : "Carta eliminata";
            return (
              <div key={sale.id} className="rounded-lg border border-border/60 p-4">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-foreground">
                      {card?.name ?? "Carta eliminata"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {optionLabel(MARKETPLACES, sale.marketplace)} ·{" "}
                      {formatISODate(sale.sale_date)}
                    </p>
                  </div>
                  <p className="text-lg font-semibold text-foreground">
                    €{Number(sale.net_amount).toFixed(2)}
                  </p>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Prezzo</p>
                    <p className="font-medium text-foreground">
                      €{Number(sale.sale_price).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Fee</p>
                    <p className="font-medium text-foreground">
                      €{Number(sale.fees).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Venduto da</p>
                    <p className="font-medium text-foreground">
                      {author?.display_name ?? author?.email ?? "-"}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex gap-2">
                  <SaleDialog
                    cards={availableCards}
                    sale={sale}
                    cardLabel={cardLabel}
                    triggerClassName="flex-1"
                  />
                  <DeleteSaleButton saleId={sale.id} />
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
                <TableHead>Carta</TableHead>
                <SortableHead
                  label="Marketplace"
                  active={sortKey === "marketplace"}
                  direction={direction}
                  onSort={() => toggleSort("marketplace")}
                />
                <SortableHead
                  label="Prezzo"
                  active={sortKey === "price"}
                  direction={direction}
                  onSort={() => toggleSort("price")}
                />
                <TableHead>Fee</TableHead>
                <SortableHead
                  label="Netto"
                  active={sortKey === "net"}
                  direction={direction}
                  onSort={() => toggleSort("net")}
                />
                <TableHead>Venduto da</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((sale) => {
                const card = cardMap.get(sale.card_id);
                const author = profileMap.get(sale.sold_by);
                return (
                  <TableRow key={sale.id}>
                    <TableCell>{formatISODate(sale.sale_date)}</TableCell>
                    <TableCell>{card?.name ?? "Carta eliminata"}</TableCell>
                    <TableCell>
                      {optionLabel(MARKETPLACES, sale.marketplace)}
                    </TableCell>
                    <TableCell>€{Number(sale.sale_price).toFixed(2)}</TableCell>
                    <TableCell>€{Number(sale.fees).toFixed(2)}</TableCell>
                    <TableCell className="font-medium">
                      €{Number(sale.net_amount).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      {author?.display_name ?? author?.email ?? "-"}
                    </TableCell>
                    <TableCell className="space-x-2 whitespace-nowrap text-right">
                      <SaleDialog
                        cards={availableCards}
                        sale={sale}
                        cardLabel={
                          card
                            ? `${card.name}${card.set_name ? ` (${card.set_name})` : ""}`
                            : "Carta eliminata"
                        }
                      />
                      <DeleteSaleButton saleId={sale.id} />
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
