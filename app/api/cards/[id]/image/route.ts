import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findCardImageUrl } from "@/lib/cardtrader";

export const runtime = "nodejs";

const REASON_MESSAGES: Record<string, string> = {
  no_token: "Token CardTrader non configurato.",
  missing_name: "Inserisci il nome della carta.",
  missing_set: "Inserisci il set (o il codice set) per cercare l'immagine.",
  no_expansion: "Nessun set CardTrader corrisponde a quanto inserito.",
  not_found: "Nessuna immagine trovata per questa carta.",
  error: "Errore durante la ricerca su CardTrader.",
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  let name: unknown;
  let setName: unknown;
  let setCode: unknown;
  let number: unknown;
  let isJapanese: unknown;

  try {
    const body = await request.json();
    name = body?.name;
    setName = body?.setName;
    setCode = body?.setCode;
    number = body?.number;
    isJapanese = body?.isJapanese;
  } catch {
    // Corpo assente: si usano i dati salvati sulla carta.
  }

  const { data: card } = await supabase
    .from("cards")
    .select("name, set_name, set_code, number, is_japanese")
    .eq("id", id)
    .maybeSingle();

  if (!card) {
    return NextResponse.json({ error: "Carta non trovata." }, { status: 404 });
  }

  const result = await findCardImageUrl({
    name: typeof name === "string" && name.trim() ? name : card.name,
    setName:
      typeof setName === "string" && setName.trim()
        ? setName
        : (card.set_name as string | null),
    setCode:
      typeof setCode === "string" && setCode.trim()
        ? setCode
        : (card.set_code as string | null),
    number:
      typeof number === "string" && number.trim()
        ? number
        : (card.number as string | null),
    isJapanese:
      typeof isJapanese === "boolean" ? isJapanese : Boolean(card.is_japanese),
  });

  if (result.imageUrl) {
    await supabase.from("cards").update({ image_url: result.imageUrl }).eq("id", id);
  }

  return NextResponse.json({
    imageUrl: result.imageUrl,
    reason: result.reason,
    message:
      result.reason === "ok" ? null : (REASON_MESSAGES[result.reason] ?? null),
  });
}
