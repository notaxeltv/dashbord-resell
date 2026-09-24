import type { Card, Purchase, Transaction } from "@/lib/types";

export function purchaseTotal(purchase: Purchase): number {
  return Number(purchase.total_amount) + Number(purchase.shipping_cost ?? 0);
}

export function cardEstimatedValue(card: Card): number {
  return Number(
    card.current_market_price ?? card.target_price ?? card.purchase_price ?? 0,
  );
}

/** Costo carta da conteggiare in contabilità: solo se non è già inclusa in un lotto. */
export function isUnlinkedCardCost(card: Pick<Card, "purchase_id" | "purchase_price" | "purchase_date">): boolean {
  return (
    !card.purchase_id &&
    card.purchase_price != null &&
    Boolean(card.purchase_date)
  );
}

export function transactionDate(transaction: Transaction): string {
  return transaction.date ?? transaction.created_at.slice(0, 10);
}
