"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { PurchaseDialog, type PurchasePrefill } from "@/components/purchases/purchase-dialog";

/**
 * Wrapper del dialog "Nuovo lotto" che, se la pagina è stata raggiunta con i
 * parametri `prefillTotal`/`prefillShipping`/`prefillNotes`/`prefillSource`
 * (es. dal simulatore Import Giappone), apre il dialog già precompilato e
 * pulisce l'URL così un refresh della pagina non lo riapre di nuovo.
 */
export function NewPurchaseWithPrefill() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [prefill, setPrefill] = useState<PurchasePrefill | undefined>();
  const [autoOpen, setAutoOpen] = useState(false);

  useEffect(() => {
    const total = searchParams.get("prefillTotal");
    if (!total) return;

    setPrefill({
      totalAmount: total,
      shippingCost: searchParams.get("prefillShipping") ?? undefined,
      notes: searchParams.get("prefillNotes") ?? undefined,
      source: searchParams.get("prefillSource") ?? undefined,
    });
    setAutoOpen(true);
    router.replace(pathname, { scroll: false });
    // Deps intenzionalmente limitate all'avvio: i parametri vanno letti una
    // sola volta, poi l'URL viene pulito.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <PurchaseDialog
      key={autoOpen ? "prefilled" : "empty"}
      initialOpen={autoOpen}
      prefill={prefill}
    />
  );
}
