import { CARD_STATUS_LABELS } from "@/lib/constants";

/**
 * Invia una notifica (Telegram/WhatsApp, a seconda di cosa è configurato
 * lato server) chiamando la Route Handler /api/notify. Operazione
 * "best-effort": eventuali errori di rete o provider non configurati non
 * bloccano mai il flusso principale dell'app (nessun throw).
 */
export async function notify(message: string) {
  try {
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
  } catch {
    // Silenzioso: le notifiche non devono mai far fallire un'operazione CRUD.
  }
}

function statusLabel(status: string) {
  return CARD_STATUS_LABELS[status] ?? status;
}

export function formatNewCardMessage(params: {
  name: string;
  setName?: string | null;
  status: string;
  purchasePrice?: number | null;
}) {
  const lines = [
    "🃏 *Nuova carta aggiunta*",
    `${params.name}${params.setName ? ` (${params.setName})` : ""}`,
    `Stato: ${statusLabel(params.status)}`,
  ];

  if (params.purchasePrice != null) {
    lines.push(`Prezzo acquisto: €${params.purchasePrice.toFixed(2)}`);
  }

  return lines.join("\n");
}

export function formatCardStatusChangeMessage(params: {
  name: string;
  oldStatus: string;
  newStatus: string;
}) {
  return [
    "🔄 *Aggiornamento stato carta*",
    params.name,
    `${statusLabel(params.oldStatus)} → ${statusLabel(params.newStatus)}`,
  ].join("\n");
}

export function formatNewPurchaseMessage(params: {
  source: string;
  totalAmount: number;
  shippingCost: number;
}) {
  const lines = [
    "🛒 *Nuovo acquisto registrato*",
    `Fonte: ${params.source}`,
    `Totale: €${params.totalAmount.toFixed(2)}`,
  ];

  if (params.shippingCost > 0) {
    lines.push(`Spedizione: €${params.shippingCost.toFixed(2)}`);
  }

  return lines.join("\n");
}

export function formatNewSaleMessage(params: {
  cardName: string;
  marketplace: string;
  salePrice: number;
  netAmount: number;
}) {
  return [
    "💰 *Nuova vendita registrata*",
    `${params.cardName} venduta su ${params.marketplace}`,
    `Prezzo: €${params.salePrice.toFixed(2)} — Netto: €${params.netAmount.toFixed(2)}`,
  ].join("\n");
}
