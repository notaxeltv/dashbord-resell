import { NextResponse } from "next/server";

import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { sendServerNotification } from "@/lib/notify-server";
import { purchaseTotal } from "@/lib/finance";
import type { Purchase, Sale } from "@/lib/types";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const header = request.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

function buildDigestMessage(params: {
  newCards: number;
  purchases: Purchase[];
  sales: Sale[];
}) {
  const { newCards, purchases, sales } = params;
  const spent = purchases.reduce((sum, p) => sum + purchaseTotal(p), 0);
  const revenue = sales.reduce((sum, s) => sum + Number(s.net_amount ?? 0), 0);

  if (newCards === 0 && purchases.length === 0 && sales.length === 0) {
    return "📊 Riepilogo giornaliero\nNessuna attività nelle ultime 24 ore.";
  }

  const lines = ["📊 Riepilogo giornaliero (ultime 24 ore)"];
  if (newCards > 0) {
    lines.push(`🃏 Nuove carte in inventario: ${newCards}`);
  }
  if (purchases.length > 0) {
    lines.push(`🛒 Lotti registrati: ${purchases.length} — €${spent.toFixed(2)} spesi`);
  }
  if (sales.length > 0) {
    lines.push(`💰 Vendite registrate: ${sales.length} — €${revenue.toFixed(2)} netti`);
  }
  const margin = revenue - spent;
  if (purchases.length > 0 || sales.length > 0) {
    lines.push(`${margin >= 0 ? "📈" : "📉"} Margine di giornata: ${margin >= 0 ? "+" : "-"}€${Math.abs(margin).toFixed(2)}`);
  }

  return lines.join("\n");
}

/**
 * Chiamata da Vercel Cron (vedi `vercel.json`) una volta al giorno. Manda su
 * Telegram/WhatsApp un riepilogo di carte, lotti e vendite delle ultime 24
 * ore. Protetta da `CRON_SECRET`: senza quella variabile configurata
 * risponde 401 e non fa nulla.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Non autorizzato." }, { status: 401 });
  }

  const supabase = createSupabaseServiceClient();
  if (!supabase) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY non configurata." },
      { status: 500 },
    );
  }

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: cards, error: cardsError }, { data: purchases, error: purchasesError }, { data: sales, error: salesError }] =
    await Promise.all([
      supabase.from("cards").select("id").gte("created_at", since),
      supabase.from("purchases").select("*").gte("created_at", since),
      supabase.from("sales").select("*").gte("created_at", since),
    ]);

  const error = cardsError || purchasesError || salesError;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const message = buildDigestMessage({
    newCards: (cards ?? []).length,
    purchases: (purchases ?? []) as Purchase[],
    sales: (sales ?? []) as Sale[],
  });

  const results = await sendServerNotification(message);

  return NextResponse.json({ message, results });
}
