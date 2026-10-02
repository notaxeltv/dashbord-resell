/** Codice carta digitato dall'utente, es. "PAL 193", "sv2-193", "SV2a-001". */
export type ParsedCardCode = {
  setToken: string;
  number: string;
};

/** Dati di catalogo compilati dal codice. Condizione, costo, foil e reverse non ci sono. */
export type CardLookupHit = {
  name: string;
  setName: string;
  setCode: string;
  number: string;
  rarity: string | null;
  imageUrl: string | null;
  /** Presente solo se il codice è di un set giapponese. */
  language?: "JAP";
};

const SET_TOKEN = /^[A-Za-z0-9]+(?:[.-][A-Za-z0-9]+)*$/;
const NUMBER_TOKEN = /^([A-Za-z0-9]+)(?:\/[A-Za-z0-9]+)?$/;

/**
 * Separa il codice set dal numero.
 * Lo spazio vale per "PAL 193". L'ultimo trattino vale per "sv2-193",
 * "TRR-15" e per gli id giapponesi "SV2a-001" o "M-P-001".
 * Un eventuale totale stampato ("193/193") viene ignorato.
 */
export function parseCardCode(raw: string): ParsedCardCode | null {
  const normalized = raw.trim().replace(/\s+/g, " ");
  if (!normalized) return null;

  const space = normalized.lastIndexOf(" ");
  const hyphen = normalized.lastIndexOf("-");
  const splitAt = space > 0 ? space : hyphen;
  if (splitAt <= 0) return null;

  const setToken = normalized.slice(0, splitAt);
  const numberPart = normalized.slice(splitAt + 1);
  if (!SET_TOKEN.test(setToken)) return null;
  const numberMatch = numberPart.match(NUMBER_TOKEN);
  if (!numberMatch) return null;
  return { setToken, number: numberMatch[1] };
}

/** Valori ammessi su public.cards.reverse_style. Il vuoto significa non reverse. */
export function normalizeReverseStyle(
  value: string | null | undefined,
): "reverse" | "stamped" | null {
  if (value === "reverse" || value === "stamped") return value;
  return null;
}
