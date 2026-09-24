"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Panoramica", match: "exact" },
  { href: "/dashboard/cards", label: "Inventario", match: "prefix" },
  { href: "/dashboard/purchases", label: "Lotti", match: "prefix" },
  { href: "/dashboard/sales", label: "Vendite", match: "prefix" },
  { href: "/dashboard/numbers", label: "Numeri", match: "prefix" },
] as const;

function isActive(pathname: string, href: string, match: "exact" | "prefix") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardHeader({ email }: { email: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="relative border-b border-fuchsia-900/40 bg-gradient-to-r from-[#170821] via-[#2b0f3f] to-[#100815] text-white shadow-lg">
      <div className="absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-amber-400 via-fuchsia-500 to-amber-400" />
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold"
        >
          <span aria-hidden className="drop-shadow-[0_0_6px_rgba(217,70,239,0.8)]">
            🃏
          </span>
          <span className="bg-gradient-to-r from-fuchsia-300 via-white to-amber-300 bg-clip-text text-transparent">
            Pokémon Card Manager
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-white/70 sm:inline">
            {email}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
            className="border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white"
          >
            Esci
          </Button>
        </div>
      </div>
      <nav className="mx-auto max-w-6xl px-4 pb-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-white/60 transition-colors hover:text-white",
                isActive(pathname, link.href, link.match) &&
                  "font-semibold text-amber-300",
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
