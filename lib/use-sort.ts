"use client";

import { useMemo, useState } from "react";

export type SortDirection = "asc" | "desc";

/**
 * Hook generico per ordinare un array in base a una chiave selezionabile
 * dall'utente (click su intestazione colonna). `getValue` estrae il valore
 * comparabile (stringa, numero o data ISO) per la chiave attiva.
 */
export function useSort<T, K extends string>(
  items: T[],
  getValue: (item: T, key: K) => string | number,
  initialKey: K | null = null,
  initialDirection: SortDirection = "desc",
) {
  const [sortKey, setSortKey] = useState<K | null>(initialKey);
  const [direction, setDirection] = useState<SortDirection>(initialDirection);

  function toggleSort(key: K) {
    if (sortKey !== key) {
      setSortKey(key);
      setDirection("asc");
      return;
    }
    setDirection((current) => (current === "asc" ? "desc" : "asc"));
  }

  const sorted = useMemo(() => {
    if (!sortKey) return items;
    const factor = direction === "asc" ? 1 : -1;
    return [...items].sort((a, b) => {
      const va = getValue(a, sortKey);
      const vb = getValue(b, sortKey);
      if (va < vb) return -1 * factor;
      if (va > vb) return 1 * factor;
      return 0;
    });
  }, [items, sortKey, direction, getValue]);

  return { sorted, sortKey, direction, toggleSort };
}
