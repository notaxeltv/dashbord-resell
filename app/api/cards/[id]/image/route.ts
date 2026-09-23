import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { findCardImageUrl } from "@/lib/cardtrader";

export const runtime = "nodejs";

/**
 * Cerca (e salva) l'immagine di una carta su CardTrader, a partire da nome
 * e set. Richiede una sessione valida (stesse regole RLS della tabella
 * `cards`). Operazione "best effort": se non viene trovata nessuna
 * corrispondenza, risponde con `imageUrl: null` senza errori.
 */
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

  try {
    const body = await request.json();
    name = body?.name;
    setName = body?.setName;
  } catch {
    // Corpo assente/non valido: prova comunque a leggere nome/set dal DB.
  }

  if (typeof name !== "string" || !name.trim()) {
    const { data: card } = await supabase
      .from("cards")
      .select("name, set_name")
      .eq("id", id)
      .maybeSingle();

    if (!card) {
      return NextResponse.json({ error: "Carta non trovata." }, { status: 404 });
    }

    name = card.name;
    setName = card.set_name;
  }

  const imageUrl = await findCardImageUrl({
    name: name as string,
    setName: typeof setName === "string" ? setName : null,
  });

  if (imageUrl) {
    await supabase.from("cards").update({ image_url: imageUrl }).eq("id", id);
  }

  return NextResponse.json({ imageUrl });
}
