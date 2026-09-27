const PLACEHOLDER_URL = "YOUR_PROJECT.supabase.co";

function normalizeSupabaseUrl(raw: string) {
  const trimmed = raw.trim().replace(/\/+$/, "");
  try {
    const parsed = new URL(trimmed);
    parsed.pathname = parsed.pathname.replace(
      /\/(rest|auth|storage|functions)\/v1\/?$/i,
      "",
    );
    parsed.pathname = parsed.pathname.replace(/\/+$/, "");
    parsed.search = "";
    parsed.hash = "";
    return parsed.origin + (parsed.pathname === "/" ? "" : parsed.pathname);
  } catch {
    return trimmed.replace(/\/(rest|auth|storage|functions)\/v1\/?$/i, "");
  }
}

export function getSupabasePublicEnv(): { url: string; key: string } | null {
  const url = normalizeSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "");
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";
  if (!url || !key) return null;
  if (url.includes(PLACEHOLDER_URL) || key === "YOUR_ANON_KEY") return null;
  return { url, key };
}
