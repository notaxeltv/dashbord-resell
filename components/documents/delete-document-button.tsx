"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function DeleteDocumentButton({
  table,
  id,
  confirmLabel,
}: {
  table: "invoices" | "purchase_receipts";
  id: string;
  confirmLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm(confirmLabel);
    if (!confirmed) return;

    setLoading(true);
    const { error } = await supabase.from(table).delete().eq("id", id);
    setLoading(false);

    if (error) {
      window.alert(`Errore durante l'eliminazione: ${error.message}`);
      return;
    }

    router.refresh();
  }

  return (
    <Button variant="destructive" size="sm" onClick={handleDelete} disabled={loading}>
      {loading ? "..." : "Elimina"}
    </Button>
  );
}
