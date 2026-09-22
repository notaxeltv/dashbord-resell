import type { LucideIcon } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ACCENTS = {
  magenta: "from-fuchsia-500 via-pink-500 to-rose-500",
  gold: "from-amber-400 via-orange-500 to-amber-400",
  violet: "from-violet-500 via-purple-500 to-fuchsia-500",
  emerald: "from-emerald-400 via-teal-500 to-emerald-400",
} as const;

const ICON_BG = {
  magenta: "bg-fuchsia-500/10 text-fuchsia-600",
  gold: "bg-amber-500/10 text-amber-600",
  violet: "bg-violet-500/10 text-violet-600",
  emerald: "bg-emerald-500/10 text-emerald-600",
} as const;

export function KpiCard({
  label,
  value,
  accent = "magenta",
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  accent?: keyof typeof ACCENTS;
  icon?: LucideIcon;
  hint?: string;
}) {
  return (
    <Card className="relative overflow-hidden transition-shadow hover:shadow-md">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          ACCENTS[accent],
        )}
      />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {Icon && (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
              ICON_BG[accent],
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        )}
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}
