/** Codice carta digitato dall'utente, es. "PAL 193", "sv2-193", "TRR-15". */
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
};

const CODE_PATTERN =
  /^([A-Za-z0-9]+)[- ]([A-Za-z0-9]+)(?:\/[A-Za-z0-9]+)?$/;

/**
 * Separa il codice set (ptcgoCode o id, es. PAL, sv2, TRR) dal numero.
 * Accetta uno spazio o un trattino. Un eventuale totale stampato ("193/193")
 * viene ignorato: per la ricerca conta solo il numero di collezione.
 */
export function parseCardCode(raw: string): ParsedCardCode | null {
  const normalized = raw.trim().replace(/\s+/g, " ");
  const match = normalized.match(CODE_PATTERN);
  if (!match) return null;
  return { setToken: match[1], number: match[2] };
}

/** Valori ammessi su public.cards.reverse_style. Il vuoto significa non reverse. */
export function normalizeReverseStyle(
  value: string | null | undefined,
): "reverse" | "stamped" | null {
  if (value === "reverse" || value === "stamped") return value;
  return null;
}
