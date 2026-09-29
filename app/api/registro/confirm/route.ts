import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { hashRegistroKey } from "@/lib/registro-delete";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Sessione non valida." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    challengeId?: string;
    codeA?: string;
    codeB?: string;
  } | null;

  if (!body?.challengeId || !body.codeA || !body.codeB) {
    return NextResponse.json({ error: "Inserisci entrambe le chiavi." }, { status: 400 });
  }

  const { data: removed, error } = await supabase.rpc("confirm_activity_delete", {
    p_challenge_id: body.challengeId,
    p_code_a_hash: hashRegistroKey(body.codeA),
    p_code_b_hash: hashRegistroKey(body.codeB),
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ removed: removed ?? 0 });
}
