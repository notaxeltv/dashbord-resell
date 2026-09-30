"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CircleDollarSign, Home, PackageOpen, PiggyBank, ShoppingCart } from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/dashboard", label: "Home", icon: Home, match: "exact" },
  { href: "/dashboard/cards", label: "Inventario", icon: PackageOpen, match: "prefix" },
  { href: "/dashboard/purchases", label: "Lotti", icon: ShoppingCart, match: "prefix" },
  { href: "/dashboard/sales", label: "Vendite", icon: CircleDollarSign, match: "prefix" },
  { href: "/dashboard/numbers", label: "Numeri", icon: PiggyBank, match: "prefix" },
] as const;

function isActive(pathname: string, href: string, match: "exact" | "prefix") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Nav fissa in fondo allo schermo, visibile solo su mobile: copre le 5
 * sezioni usate più spesso durante il lavoro quotidiano. Le voci meno
 * frequenti (Import JP, Registro) restano nel menu dell'header.
 */
export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur sm:hidden print:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {ITEMS.map((item) => {
          const active = isActive(pathname, item.href, item.match);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[11px] font-medium text-muted-foreground transition-colors",
                active && "text-primary",
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
