import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSupabasePublicEnv } from "@/lib/env";

/**
 * Middleware necessario per mantenere la sessione Supabase sincronizzata
 * tra client e server (refresh automatico del token nei cookie).
 * Non implementa logica di autorizzazione avanzata: la protezione delle
 * rotte /dashboard/* avviene nel relativo layout server-side.
 */
export async function middleware(request: NextRequest) {
  const env = getSupabasePublicEnv();
  if (!env) {
    if (request.nextUrl.pathname !== "/env-mancante") {
      return NextResponse.redirect(new URL("/env-mancante", request.url));
    }
    return NextResponse.next();
  }

  if (request.nextUrl.pathname === "/env-mancante") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
