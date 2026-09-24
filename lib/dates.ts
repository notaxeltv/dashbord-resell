/** Data odierna in calendario locale (non UTC). */
export function todayISO(): string {
  return toISODate(new Date());
}

/** Converte una Date nel formato YYYY-MM-DD usando il fuso locale. */
export function toISODate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseISODateParts(value: string): { year: number; month: number; day: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

/** Formatta una data ISO (YYYY-MM-DD o timestamptz) in it-IT senza slittamenti UTC. */
export function formatISODate(value: string | null | undefined): string {
  if (!value) return "-";
  const parts = parseISODateParts(value);
  if (!parts) return value;
  return new Date(parts.year, parts.month - 1, parts.day).toLocaleDateString("it-IT");
}

export function yearFromISODate(value: string): number {
  const parts = parseISODateParts(value);
  return parts?.year ?? new Date(value).getFullYear();
}

export function monthFromISODate(value: string): number {
  const parts = parseISODateParts(value);
  return parts ? parts.month - 1 : new Date(value).getMonth();
}
