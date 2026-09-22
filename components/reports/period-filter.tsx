"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const PRESETS = [
  { value: "week", label: "Settimana" },
  { value: "month", label: "Mese" },
  { value: "year", label: "Anno" },
  { value: "custom", label: "Personalizzato" },
] as const;

export function PeriodFilter({
  period,
  from,
  to,
}: {
  period: string;
  from: string;
  to: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [customFrom, setCustomFrom] = useState(from);
  const [customTo, setCustomTo] = useState(to);

  function applyPreset(value: string) {
    const params = new URLSearchParams();
    params.set("period", value);
    router.push(`${pathname}?${params.toString()}`);
  }

  function applyCustom() {
    const params = new URLSearchParams();
    params.set("period", "custom");
    params.set("from", customFrom);
    params.set("to", customTo);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:gap-4">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((preset) => (
          <Button
            key={preset.value}
            type="button"
            size="sm"
            variant={period === preset.value ? "default" : "outline"}
            onClick={() => applyPreset(preset.value)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      {period === "custom" && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="report-from" className="text-xs">
              Dal
            </Label>
            <Input
              id="report-from"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to" className="text-xs">
              Al
            </Label>
            <Input
              id="report-to"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="h-9 w-40"
            />
          </div>
          <Button type="button" size="sm" onClick={applyCustom}>
            Applica
          </Button>
        </div>
      )}
    </div>
  );
}
