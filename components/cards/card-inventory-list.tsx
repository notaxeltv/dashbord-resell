"use client";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SortableHead } from "@/components/ui/sortable-head";
import { CardDialog } from "@/components/cards/card-dialog";
import { CardThumbnail } from "@/components/cards/card-thumbnail";
import { formatISODate } from "@/lib/dates";
import type { SortDirection } from "@/lib/use-sort";
import {
  CARD_CONDITION_LABELS,
  CARD_STATUS_BADGE_VARIANT,
  CARD_STATUS_LABELS,
} from "@/lib/constants";
import type { Card as CardRow, PurchaseOption } from "@/lib/types";

export type InventorySortKey = "name" | "price" | "target" | "status" | "date";

export function CardInventoryList({
  cards,
  purchases,
  soldCardIds,
  authorNames,
  selectedIds,
  onToggleSelect,
  sortKey,
  direction,
  onSort,
}: {
  cards: CardRow[];
  purchases: PurchaseOption[];
  soldCardIds: string[];
  authorNames: Record<string, string>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  sortKey: InventorySortKey | null;
  direction: SortDirection;
  onSort: (key: InventorySortKey) => void;
}) {
  function who(card: CardRow) {
    const id = card.updated_by || card.owner_id;
    return authorNames[id] ?? "—";
  }

  if (cards.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-muted-foreground">
        Nessuna carta corrisponde alla ricerca, oppure l&apos;inventario è
        vuoto. Usa &quot;+ Nuova carta&quot;.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3 sm:hidden">
        {cards.map((card) => (
          <div key={card.id} className="relative">
            <div
              onClick={(event) => event.stopPropagation()}
              className="absolute left-3 top-3 z-10 flex h-6 w-6 items-center justify-center"
            >
              <Checkbox
                checked={selectedIds.has(card.id)}
                onCheckedChange={() => onToggleSelect(card.id)}
                aria-label="Seleziona carta"
              />
            </div>
            <CardDialog
              card={card}
              purchases={purchases}
              hasSale={soldCardIds.includes(card.id)}
              triggerClassName="block rounded-lg border border-border/60 p-4 pl-11"
              trigger={
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <CardThumbnail
                        imageUrl={card.image_url}
                        name={card.name}
                        className="h-16 w-12"
                      />
                      <div>
                        <p className="font-medium text-foreground">
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
                        </p>
                        <p className="text-sm text-muted-foreground">
                          {card.set_name ?? "-"} ·{" "}
                          {CARD_CONDITION_LABELS[card.condition] ?? card.condition}
                        </p>
                      </div>
                    </div>
                    <Badge variant={CARD_STATUS_BADGE_VARIANT[card.status] ?? "default"}>
                      {CARD_STATUS_LABELS[card.status] ?? card.status}
                    </Badge>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-muted-foreground">Costo carta</p>
                      <p className="font-medium text-foreground">
                        {card.purchase_price != null
                          ? `€${Number(card.purchase_price).toFixed(2)}`
                          : "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Target</p>
                      <p className="font-medium text-foreground">
                        {card.target_price != null
                          ? `€${Number(card.target_price).toFixed(2)}`
                          : "-"}
                      </p>
                    </div>
                  </div>

                  <p className="mt-2 text-xs text-muted-foreground">
                    Inserita il {formatISODate(card.created_at)} · {who(card)}
                    {" · "}Tocca per modificare
                  </p>
                </>
              }
            />
          </div>
        ))}
      </div>

      <div className="hidden overflow-x-auto sm:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <span className="sr-only">Seleziona</span>
              </TableHead>
              <SortableHead
                label="Nome"
                active={sortKey === "name"}
                direction={direction}
                onSort={() => onSort("name")}
              />
              <TableHead>Set</TableHead>
              <TableHead>Condizione</TableHead>
              <SortableHead
                label="Costo carta"
                active={sortKey === "price"}
                direction={direction}
                onSort={() => onSort("price")}
              />
              <SortableHead
                label="Target"
                active={sortKey === "target"}
                direction={direction}
                onSort={() => onSort("target")}
              />
              <SortableHead
                label="Stato"
                active={sortKey === "status"}
                direction={direction}
                onSort={() => onSort("status")}
              />
              <TableHead>Autore</TableHead>
              <SortableHead
                label="Inserita il"
                active={sortKey === "date"}
                direction={direction}
                onSort={() => onSort("date")}
              />
              <TableHead className="text-right">Azioni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cards.map((card) => (
              <TableRow key={card.id} data-state={selectedIds.has(card.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selectedIds.has(card.id)}
                    onCheckedChange={() => onToggleSelect(card.id)}
                    aria-label="Seleziona carta"
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <CardThumbnail
                      imageUrl={card.image_url}
                      name={card.name}
                      className="h-12 w-9"
                    />
                    <span>
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
                    </span>
                  </div>
                </TableCell>
                <TableCell>{card.set_name ?? "-"}</TableCell>
                <TableCell>
                  {CARD_CONDITION_LABELS[card.condition] ?? card.condition}
                </TableCell>
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
                  <Badge variant={CARD_STATUS_BADGE_VARIANT[card.status] ?? "default"}>
                    {CARD_STATUS_LABELS[card.status] ?? card.status}
                  </Badge>
                </TableCell>
                <TableCell>{who(card)}</TableCell>
                <TableCell>{formatISODate(card.created_at)}</TableCell>
                <TableCell className="whitespace-nowrap text-right">
                  <CardDialog
                    card={card}
                    purchases={purchases}
                    hasSale={soldCardIds.includes(card.id)}
                    triggerClassName="inline-flex rounded-md border border-input px-3 py-1.5 text-sm font-medium hover:bg-accent"
                    trigger={<>Modifica</>}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
