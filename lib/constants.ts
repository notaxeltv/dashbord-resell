export const CARD_CONDITIONS = ["NM", "EX", "GD", "LP", "P"] as const;

export const CARD_CONDITION_LABELS: Record<string, string> = {
  NM: "Near Mint (NM)",
  EX: "Excellent (EX)",
  GD: "Good (GD)",
  LP: "Light Played (LP)",
  P: "Played (P)",
};

export const CARD_LANGUAGES = [
  { value: "ITA", label: "Italiano" },
  { value: "JAP", label: "Giapponese" },
  { value: "ENG", label: "Inglese" },
  { value: "ALTRO", label: "Altro" },
] as const;

export const PURCHASE_SOURCES = [
  { value: "vinted", label: "Vinted" },
  { value: "cardmarket", label: "Cardmarket" },
  { value: "privato", label: "Privato" },
  { value: "lotto", label: "Lotto" },
  { value: "altro", label: "Altro" },
] as const;

export const CARD_STATUSES = [
  { value: "in_stock", label: "In stock" },
  { value: "listed", label: "In vendita" },
  { value: "reserved", label: "Riservata" },
  { value: "sold", label: "Venduta" },
] as const;

export const CARD_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  CARD_STATUSES.map((s) => [s.value, s.label]),
);

export const CARD_STATUS_BADGE_VARIANT: Record<
  string,
  "default" | "secondary" | "success" | "warning"
> = {
  in_stock: "secondary",
  listed: "warning",
  reserved: "default",
  sold: "success",
};

export const MARKETPLACES = [
  { value: "cardmarket", label: "Cardmarket" },
  { value: "vinted", label: "Vinted" },
  { value: "ebay", label: "eBay" },
  { value: "privato", label: "Privato" },
  { value: "altro", label: "Altro" },
] as const;

/** Valore sentinella per i Select Radix (non accettano stringa vuota). */
export const SELECT_NONE = "__none";

export const CARD_STATUSES_EDITABLE = CARD_STATUSES.filter(
  (status) => status.value === "in_stock" || status.value === "listed",
);

export function optionLabel(
  options: readonly { readonly value: string; readonly label: string }[],
  value: string | null | undefined,
): string {
  if (!value) return "-";
  return options.find((item) => item.value === value)?.label ?? value;
}
