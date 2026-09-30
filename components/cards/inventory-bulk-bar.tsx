"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CARD_STATUSES_EDITABLE } from "@/lib/constants";

const BULK_STATUSES = [
  ...CARD_STATUSES_EDITABLE,
  { value: "reserved", label: "Riservata" },
] as const;

export function InventoryBulkBar({
  selectedIds,
  soldCardIds,
  onClear,
}: {
  selectedIds: string[];
  soldCardIds: string[];
  onClear: () => void;
}) {
  const router = useRouter();
  const [bulkStatus, setBulkStatus] = useState<string>(BULK_STATUSES[0].value);
  const [loading, setLoading] = useState(false);

  const soldSet = new Set(soldCardIds);
  const eligibleIds = selectedIds.filter((id) => !soldSet.has(id));
  const skippedCount = selectedIds.length - eligibleIds.length;

  async function applyStatus() {
    if (eligibleIds.length === 0) return;
    setLoading(true);
    const { error } = await supabase
      .from("cards")
      .update({ status: bulkStatus })
      .in("id", eligibleIds);
    setLoading(false);

    if (error) {
      window.alert(`Errore durante l'aggiornamento: ${error.message}`);
      return;
    }
    if (skippedCount > 0) {
      window.alert(
        `${skippedCount} ${skippedCount === 1 ? "carta già venduta è stata" : "carte già vendute sono state"} escluse: lo stato venduta si gestisce da Vendite.`,
      );
    }
    onClear();
    router.refresh();
  }

  async function bulkDelete() {
    if (eligibleIds.length === 0) return;
    const confirmed = window.confirm(
      `Vuoi davvero eliminare ${eligibleIds.length} ${eligibleIds.length === 1 ? "carta" : "carte"}? L'operazione non è reversibile.`,
    );
    if (!confirmed) return;

    setLoading(true);
    const { error } = await supabase.from("cards").delete().in("id", eligibleIds);
    setLoading(false);

    if (error) {
      window.alert(`Errore durante l'eliminazione: ${error.message}`);
      return;
    }
    if (skippedCount > 0) {
      window.alert(
        `${skippedCount} ${skippedCount === 1 ? "carta venduta è stata" : "carte vendute sono state"} escluse: elimina prima la vendita collegata.`,
      );
    }
    onClear();
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-3 sm:flex-row sm:items-center">
      <p className="text-sm font-medium text-foreground">
        {selectedIds.length} {selectedIds.length === 1 ? "selezionata" : "selezionate"}
      </p>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
        <Select value={bulkStatus} onValueChange={setBulkStatus}>
          <SelectTrigger className="sm:w-44">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {BULK_STATUSES.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={loading || eligibleIds.length === 0}
          onClick={applyStatus}
        >
          Cambia stato
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          disabled={loading || eligibleIds.length === 0}
          onClick={bulkDelete}
        >
          Elimina selezionate
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onClear}>
          Annulla
        </Button>
      </div>
    </div>
  );
}
