"use client";

import { usePathname, useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

export function YearFilter({
  years,
  selected,
}: {
  years: number[];
  selected: number;
}) {
  const router = useRouter();
  const pathname = usePathname();

  function selectYear(year: number) {
    const params = new URLSearchParams();
    params.set("year", String(year));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {years.map((year) => (
        <Button
          key={year}
          type="button"
          size="sm"
          variant={year === selected ? "default" : "outline"}
          onClick={() => selectYear(year)}
        >
          {year}
        </Button>
      ))}
    </div>
  );
}
