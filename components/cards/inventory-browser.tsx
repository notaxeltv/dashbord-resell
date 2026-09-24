"use client";

import { useMemo, useState } from "react";

import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CardInventoryList } from "@/components/cards/card-inventory-list";
import { NewCardDialog } from "@/components/cards/new-card-dialog";
import { CARD_STATUSES, SELECT_NONE } from "@/lib/constants";
import type { Card as CardRow, PurchaseOption } from "@/lib/types";

export function InventoryBrowser({
  cards,
  purchases,
  soldCardIds,
}: {
  cards: CardRow[];
  purchases: PurchaseOption[];
  soldCardIds: string[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState(SELECT_NONE);

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
        <div className="sm:ml-auto">
          <NewCardDialog purchases={purchases} />
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {filtered.length} di {cards.length} carte
      </p>
      <CardInventoryList
        cards={filtered}
        purchases={purchases}
        soldCardIds={soldCardIds}
      />
    </div>
  );
}
