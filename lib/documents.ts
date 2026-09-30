import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Calcola il prossimo numero progressivo per fatture/ricevute nell'anno
 * indicato (riparte da 1 ogni nuovo anno). Non è a prova di race condition
 * perfetta, ma per un team di 2 persone che non emette documenti in
 * contemporanea è più che sufficiente; in caso di conflitto (vincolo
 * unique su year+number) l'insert va ripetuto con il numero successivo.
 */
export async function nextDocumentNumber(
  supabase: SupabaseClient,
  table: "invoices" | "purchase_receipts",
  year: number,
): Promise<number> {
  const { data, error } = await supabase
    .from(table)
    .select("number")
    .eq("year", year)
    .order("number", { ascending: false })
    .limit(1);

  if (error) throw error;

  const last = data?.[0]?.number;
  return (typeof last === "number" ? last : 0) + 1;
}

export function computeVatAmount(taxableAmount: number, vatRate: number): number {
  return Math.round(taxableAmount * vatRate) / 100;
}

export function computeInvoiceTotal(taxableAmount: number, vatRate: number): number {
  return taxableAmount + computeVatAmount(taxableAmount, vatRate);
}

/** True se l'errore Postgres riportato è una violazione dell'unique(year, number). */
export function isDuplicateNumberError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key value/i.test(error.message ?? "");
}
