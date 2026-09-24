import { toISODate } from "@/lib/dates";

export function startOfWeek(date: Date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function getPeriodRange(period: string, from?: string, to?: string) {
  const now = new Date();

  if (period === "custom") {
    if (from && to) return { start: from, end: to };
    const fallbackStart = new Date(now);
    fallbackStart.setDate(now.getDate() - 29);
    return { start: toISODate(fallbackStart), end: toISODate(now) };
  }

  if (period === "year") {
    return {
      start: toISODate(new Date(now.getFullYear(), 0, 1)),
      end: toISODate(new Date(now.getFullYear(), 11, 31)),
    };
  }

  if (period === "week") {
    const start = startOfWeek(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start: toISODate(start), end: toISODate(end) };
  }

  return {
    start: toISODate(new Date(now.getFullYear(), now.getMonth(), 1)),
    end: toISODate(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  };
}

export function formatPeriodLabel(period: string, start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const fmt = (d: Date) =>
    d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });

  if (period === "year") return `Anno ${startDate.getFullYear()}`;
  if (period === "month")
    return startDate.toLocaleDateString("it-IT", { month: "long", year: "numeric" });
  return `${fmt(startDate)} → ${fmt(endDate)}`;
}

export function buildBuckets(start: string, end: string) {
  const startDate = new Date(`${start}T00:00:00`);
  const endDate = new Date(`${end}T00:00:00`);
  const dayCount =
    Math.round((endDate.getTime() - startDate.getTime()) / 86_400_000) + 1;

  const buckets: { label: string; start: string; end: string }[] = [];

  if (dayCount <= 31) {
    for (let i = 0; i < dayCount; i++) {
      const d = new Date(startDate);
      d.setDate(startDate.getDate() + i);
      const iso = toISODate(d);
      buckets.push({
        label: d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit" }),
        start: iso,
        end: iso,
      });
    }
  } else if (dayCount <= 731) {
    let cursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
    while (cursor <= endDate) {
      const bucketStart = new Date(Math.max(cursor.getTime(), startDate.getTime()));
      const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
      const bucketEnd = new Date(Math.min(monthEnd.getTime(), endDate.getTime()));
      buckets.push({
        label: cursor.toLocaleDateString("it-IT", { month: "short", year: "2-digit" }),
        start: toISODate(bucketStart),
        end: toISODate(bucketEnd),
      });
      cursor = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1);
    }
  } else {
    let year = startDate.getFullYear();
    while (year <= endDate.getFullYear()) {
      const bucketStart = year === startDate.getFullYear() ? startDate : new Date(year, 0, 1);
      const bucketEnd = year === endDate.getFullYear() ? endDate : new Date(year, 11, 31);
      buckets.push({
        label: String(year),
        start: toISODate(bucketStart),
        end: toISODate(bucketEnd),
      });
      year++;
    }
  }

  return buckets;
}

export function inRange(date: string, start: string, end: string) {
  return date >= start && date <= end;
}
