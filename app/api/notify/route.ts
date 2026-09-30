import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sendServerNotification } from "@/lib/notify-server";

export const runtime = "nodejs";

/**
 * Route Handler per l'invio di notifiche verso Telegram e/o WhatsApp (via
 * Twilio) su richiesta di un utente autenticato dal browser. I provider sono
 * opzionali e indipendenti: vengono attivati solo se le relative variabili
 * d'ambiente sono configurate. Se nessuna è presente, la richiesta risponde
 * con `skipped` senza errori.
 */
export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  let message: unknown;

  try {
    const body = await request.json();
    message = body?.message;
  } catch {
    return NextResponse.json(
      { error: "Corpo della richiesta non valido." },
      { status: 400 },
    );
  }

  if (typeof message !== "string" || message.trim() === "") {
    return NextResponse.json(
      { error: "Il campo 'message' è obbligatorio." },
      { status: 400 },
    );
  }

  const results = await sendServerNotification(message);

  return NextResponse.json({ results });
}
