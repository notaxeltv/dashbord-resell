import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  hashRegistroKey,
  maskEmail,
  randomRegistroKey,
  registroRecipientEmails,
  sendRegistroKeyEmail,
} from "@/lib/registro-delete";

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
    ids?: string[] | null;
  } | null;
  const ids = Array.isArray(body?.ids)
    ? body.ids.filter((id) => typeof id === "string" && id.length > 0)
    : null;

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("email")
    .order("created_at", { ascending: true });

  if (profilesError) {
    return NextResponse.json({ error: profilesError.message }, { status: 400 });
  }

  const recipients = registroRecipientEmails(
    (profiles ?? []).map((profile) => profile.email as string),
  );
  if (!recipients) {
    return NextResponse.json(
      {
        error:
          "Servono due email diverse. Imposta REGISTRO_EMAILS su Vercel con le due email del team, separate da virgola.",
      },
      { status: 400 },
    );
  }

  const codeA = randomRegistroKey();
  const codeB = randomRegistroKey();

  const { data: challengeId, error } = await supabase.rpc("request_activity_delete", {
    p_code_a_hash: hashRegistroKey(codeA),
    p_code_b_hash: hashRegistroKey(codeB),
    p_email_a: recipients[0],
    p_email_b: recipients[1],
    p_target_ids: ids && ids.length > 0 ? ids : null,
  });

  if (error || !challengeId) {
    return NextResponse.json(
      { error: error?.message ?? "Impossibile creare la richiesta." },
      { status: 400 },
    );
  }

  try {
    await Promise.all([
      sendRegistroKeyEmail(recipients[0], codeA),
      sendRegistroKeyEmail(recipients[1], codeB),
    ]);
  } catch (sendError) {
    await supabase.rpc("cancel_activity_delete", { p_challenge_id: challengeId });
    const message =
      sendError instanceof Error ? sendError.message : "Invio email non riuscito.";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  return NextResponse.json({
    challengeId,
    emailA: maskEmail(recipients[0]),
    emailB: maskEmail(recipients[1]),
  });
}
