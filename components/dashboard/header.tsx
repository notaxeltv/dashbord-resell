"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { href: "/dashboard", label: "Carte" },
  { href: "/dashboard/purchases", label: "Acquisti" },
  { href: "/dashboard/sales", label: "Vendite" },
];

export function DashboardHeader({ email }: { email: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-lg font-semibold text-slate-900"
        >
          <span aria-hidden>🃏</span>
          Pokémon Card Manager
        </Link>
        <div className="flex items-center gap-4">
          <span className="hidden text-sm text-slate-600 sm:inline">
            {email}
          </span>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            Esci
          </Button>
        </div>
      </div>
      <nav className="mx-auto max-w-6xl px-4 pb-3 sm:px-6 lg:px-8">
        <div className="flex gap-4 text-sm">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={cn(
                "text-slate-600 transition-colors hover:text-slate-900",
                pathname === link.href && "font-semibold text-slate-900",
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
