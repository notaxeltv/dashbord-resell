import { NextResponse } from "next/server";

import { lookupCardFromCode } from "@/lib/pokemon-tcg";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  let code: unknown;
  try {
    const body = await request.json();
    code = body?.code;
  } catch {
    return NextResponse.json({ error: "Richiesta non valida." }, { status: 400 });
  }

  if (typeof code !== "string" || !code.trim()) {
    return NextResponse.json(
      { error: "Inserisci un codice carta." },
      { status: 400 },
    );
  }

  const result = await lookupCardFromCode(code);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }

  return NextResponse.json(result.card);
}
