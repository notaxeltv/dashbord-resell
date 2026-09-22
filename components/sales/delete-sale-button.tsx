"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";

export function DeleteSaleButton({ saleId }: { saleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    const confirmed = window.confirm("Vuoi davvero eliminare questa vendita?");
    if (!confirmed) return;

    setLoading(true);
    const { error } = await supabase.from("sales").delete().eq("id", saleId);
    setLoading(false);

    if (error) {
      window.alert(`Errore durante l'eliminazione: ${error.message}`);
      return;
    }

    router.refresh();
  }

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={loading}
    >
      {loading ? "..." : "Elimina"}
    </Button>
  );
}
