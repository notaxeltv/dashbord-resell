import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ACCENTS = {
  magenta: "from-fuchsia-500 via-pink-500 to-rose-500",
  gold: "from-amber-400 via-orange-500 to-amber-400",
  violet: "from-violet-500 via-purple-500 to-fuchsia-500",
  emerald: "from-emerald-400 via-teal-500 to-emerald-400",
} as const;

export function KpiCard({
  label,
  value,
  accent = "magenta",
}: {
  label: string;
  value: string | number;
  accent?: keyof typeof ACCENTS;
}) {
  return (
    <Card className="relative overflow-hidden">
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r",
          ACCENTS[accent],
        )}
      />
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-3xl font-bold text-foreground">{value}</p>
      </CardContent>
    </Card>
  );
}
