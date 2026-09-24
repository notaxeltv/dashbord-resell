import { NextResponse } from "next/server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isCardTraderImageUrl } from "@/lib/card-image";

export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Non autenticato." }, { status: 401 });
  }

  const url = new URL(request.url).searchParams.get("url");
  if (!url || !isCardTraderImageUrl(url)) {
    return NextResponse.json({ error: "URL immagine non valido." }, { status: 400 });
  }

  const response = await fetch(url, {
    headers: {
      Accept: "image/*",
      Referer: "https://www.cardtrader.com/",
    },
    redirect: "follow",
    cache: "force-cache",
  });

  if (!isCardTraderImageUrl(response.url)) {
    return NextResponse.json({ error: "Redirect non consentito." }, { status: 400 });
  }

  if (!response.ok) {
    return NextResponse.json({ error: "Immagine non disponibile." }, { status: 502 });
  }

  const contentType = response.headers.get("content-type") ?? "image/jpeg";
  if (!contentType.startsWith("image/")) {
    return NextResponse.json({ error: "Tipo file non valido." }, { status: 400 });
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > MAX_BYTES) {
    return NextResponse.json({ error: "Immagine troppo grande." }, { status: 400 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    },
  });
}
