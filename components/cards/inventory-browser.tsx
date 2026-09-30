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
import { CardInventoryList, type InventorySortKey } from "@/components/cards/card-inventory-list";
import { InventoryBulkBar } from "@/components/cards/inventory-bulk-bar";
import { NewCardDialog } from "@/components/cards/new-card-dialog";
import { downloadCsv } from "@/lib/csv";
import { formatISODate } from "@/lib/dates";
import { cardEstimatedValue } from "@/lib/finance";
import { useSort } from "@/lib/use-sort";
import {
  CARD_CONDITION_LABELS,
  CARD_STATUS_LABELS,
  CARD_STATUSES,
  SELECT_NONE,
} from "@/lib/constants";
import type { Card as CardRow, PurchaseOption } from "@/lib/types";

export function InventoryBrowser({
  cards,
  purchases,
  soldCardIds,
  authorNames,
}: {
  cards: CardRow[];
  purchases: PurchaseOption[];
  soldCardIds: string[];
  authorNames: Record<string, string>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(SELECT_NONE);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return cards.filter((card) => {
      if (status !== SELECT_NONE && card.status !== status) return false;
      if (!needle) return true;
      return [card.name, card.set_name, card.set_code, card.number]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(needle));
    });
  }, [cards, query, status]);

  const { sorted, sortKey, direction, toggleSort } = useSort<CardRow, InventorySortKey>(
    filtered,
    (card, key) => {
      if (key === "name") return card.name?.toLowerCase() ?? "";
      if (key === "price") return Number(card.purchase_price ?? 0);
      if (key === "target") return Number(card.target_price ?? 0);
      if (key === "status") return CARD_STATUS_LABELS[card.status] ?? card.status;
      return card.created_at;
    },
    null,
  );

  function toggleSelect(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    downloadCsv(
      `inventario-${new Date().toISOString().slice(0, 10)}.csv`,
      [
        "Nome",
        "Set",
        "Codice set",
        "Numero",
        "Condizione",
        "Costo carta",
        "Target",
        "Valore stimato",
        "Stato",
        "Inserita il",
      ],
      sorted.map((card) => [
        card.name,
        card.set_name ?? "",
        card.set_code ?? "",
        card.number ?? "",
        CARD_CONDITION_LABELS[card.condition] ?? card.condition,
        card.purchase_price != null ? Number(card.purchase_price).toFixed(2) : "",
        card.target_price != null ? Number(card.target_price).toFixed(2) : "",
        cardEstimatedValue(card).toFixed(2),
        CARD_STATUS_LABELS[card.status] ?? card.status,
        formatISODate(card.created_at),
      ]),
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Cerca nome, set o numero…"
          className="sm:max-w-xs"
        />
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue placeholder="Tutti gli stati" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={SELECT_NONE}>Tutti gli stati</SelectItem>
            {CARD_STATUSES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-2 sm:ml-auto">
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
          <NewCardDialog purchases={purchases} />
        </div>
      </div>

      {selectedIds.size > 0 ? (
        <InventoryBulkBar
          selectedIds={Array.from(selectedIds)}
          soldCardIds={soldCardIds}
          onClear={() => setSelectedIds(new Set())}
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          {filtered.length} di {cards.length} carte
        </p>
      )}

      <CardInventoryList
        cards={sorted}
        purchases={purchases}
        soldCardIds={soldCardIds}
        authorNames={authorNames}
        selectedIds={selectedIds}
        onToggleSelect={toggleSelect}
        sortKey={sortKey}
        direction={direction}
        onSort={toggleSort}
      />
    </div>
  );
}
