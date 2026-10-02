import type { CardLookupHit, ParsedCardCode } from "./card-code";
import {
  englishJapaneseCardName,
  englishJapanesePrintedName,
  englishJapaneseSetName,
  readDexId,
} from "./ja-en-names";

const TCGDEX_BASE = "https://api.tcgdex.net/v2";
const IMAGE_HOST = "assets.tcgdex.net";
const SETS_TTL_MS = 6 * 60 * 60 * 1000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type DexSet = { id: string; name: string };

type SetLists = {
  ja: DexSet[];
  en: DexSet[];
  enKnown: boolean;
};

type JaCache = {
  fetchedAt: number;
  lists: SetLists;
};

let jaCache: JaCache | null = null;

function readSets(body: unknown): DexSet[] | null {
  if (!Array.isArray(body)) return null;
  const sets: DexSet[] = [];
  for (const row of body) {
    if (!row || typeof row !== "object") continue;
    const item = row as { id?: unknown; name?: unknown };
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!id || !name) continue;
    sets.push({ id, name });
  }
  return sets.length > 0 ? sets : null;
}

async function loadSets(
  fetcher: FetchLike,
  language: "ja" | "en",
): Promise<DexSet[] | null> {
  const url = `${TCGDEX_BASE}/${language}/sets`;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await fetcher(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "pokemon-app/card-lookup",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) continue;
      const sets = readSets(await response.json());
      if (sets) return sets;
    } catch {
      // Riprova una volta, poi il chiamante decide se usare l'altro catalogo.
    }
  }
  return null;
}

async function getSetLists(fetcher: FetchLike): Promise<SetLists | null> {
  const now = Date.now();
  if (fetcher === fetch && jaCache && now - jaCache.fetchedAt < SETS_TTL_MS) {
    return jaCache.lists;
  }

  const [ja, en] = await Promise.all([
    loadSets(fetcher, "ja"),
    loadSets(fetcher, "en"),
  ]);
  if (!ja) return null;
  const lists = { ja, en: en ?? [], enKnown: Boolean(en) };
  if (fetcher === fetch && en) {
    jaCache = { fetchedAt: now, lists };
  }
  return lists;
}

function sameId(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function numberVariants(number: string): string[] {
  const variants: string[] = [];
  const add = (value: string) => {
    if (value && !variants.includes(value)) variants.push(value);
  };
  add(number);
  if (/^\d+$/.test(number)) add(number.padStart(3, "0"));
  add(number.replace(/^0+(?=\d)/, ""));
  return variants;
}

function tcgdexImage(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || url.hostname !== IMAGE_HOST) return null;
    const path = url.pathname.replace(/\/+$/, "");
    if (!/\/(?:high|low)\.webp$/i.test(path)) {
      url.pathname = `${path}/high.webp`;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function mapJapaneseCard(body: unknown, setName: string, setId: string): CardLookupHit | null {
  if (!body || typeof body !== "object") return null;
  const card = body as {
    name?: unknown;
    localId?: unknown;
    rarity?: unknown;
    image?: unknown;
    set?: { id?: unknown; name?: unknown };
  };
  const name = typeof card.name === "string" ? card.name.trim() : "";
  const number = typeof card.localId === "string" ? card.localId.trim() : "";
  const expansion =
    typeof card.set?.name === "string" && card.set.name.trim()
      ? card.set.name.trim()
      : setName;
  const setCode =
    typeof card.set?.id === "string" && card.set.id.trim()
      ? card.set.id.trim()
      : setId;
  if (!name || !number || !expansion) return null;
  const rarity = typeof card.rarity === "string" ? card.rarity.trim() : "";
  return {
    name,
    setName: expansion,
    setCode,
    number,
    rarity: rarity || null,
    imageUrl: tcgdexImage(card.image),
    language: "JAP",
  };
}

/**
 * Se il codice è un set solo giapponese, legge carta e espansione da TCGdex ja.
 * Null se il set è occidentale o condiviso con il catalogo inglese: in quel caso
 * resta la ricerca su pokemontcg.io. Non imposta foil né reverse.
 */
export async function lookupJapaneseCard(
  parsed: ParsedCardCode,
  fetcher: FetchLike = fetch,
  options?: { includeShared?: boolean },
): Promise<
  | { ok: true; card: CardLookupHit }
  | { ok: false; status: number; error: string }
  | null
> {
  const lists = await getSetLists(fetcher);
  if (!lists) return null;

  const japanese = lists.ja.find((set) => sameId(set.id, parsed.setToken));
  if (!japanese) return null;
  if (!options?.includeShared && !lists.enKnown) return null;
  const alsoWestern = lists.en.some((set) => sameId(set.id, japanese.id));
  if (alsoWestern && !options?.includeShared) return null;

  let sawDown = false;
  for (const number of numberVariants(parsed.number)) {
    const cardId = `${japanese.id}-${number}`;
    if (!/^[A-Za-z0-9.-]+$/.test(cardId)) continue;
    let response: Response;
    try {
      response = await fetcher(`${TCGDEX_BASE}/ja/cards/${cardId}`, {
        headers: {
          Accept: "application/json",
          "User-Agent": "pokemon-app/card-lookup",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      sawDown = true;
      continue;
    }
    if (response.status === 404) continue;
    if (!response.ok) {
      sawDown = true;
      continue;
    }
    const body = await response.json();
    const mapped = mapJapaneseCard(body, japanese.name, japanese.id);
    if (mapped) {
      const setName = await englishJapaneseSetName(mapped.setName, fetcher);
      if (setName) mapped.setName = setName;
      const cardName = await englishJapaneseCardName(
        readDexId(body),
        mapped.name,
        fetcher,
      );
      if (cardName) {
        mapped.name = cardName;
      } else if (setName) {
        const printedName = await englishJapanesePrintedName(
          setName,
          mapped.number,
          fetcher,
        );
        if (printedName) mapped.name = printedName;
      }
      return { ok: true, card: mapped };
    }
  }

  if (sawDown) {
    return {
      ok: false,
      status: 502,
      error: "Servizio Pokémon TCG non disponibile. Riprova tra poco.",
    };
  }
  return {
    ok: false,
    status: 404,
    error: "Nessuna carta trovata per questo codice.",
  };
}
