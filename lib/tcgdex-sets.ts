import { manualItalianSetName } from "./set-names-it";

const TCGDEX_BASE = "https://api.tcgdex.net/v2";
const SETS_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Id dell'API Pokémon TCG che su TCGdex hanno un identificativo diverso.
 * Servono solo per raggiungere il nome italiano, quando c'è.
 */
const SET_ID_ALIASES: Record<string, string> = {
  base6: "lc",
  bp: "bog",
  fut20: "fut2020",
  me55c: "30th-c",
};

type DexSet = {
  id: string;
  name: string;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type DexCache = {
  fetchedAt: number;
  en: DexSet[];
  it: DexSet[];
};

let dexCache: DexCache | null = null;

export function normalizeSetName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

async function loadLanguage(
  fetcher: FetchLike,
  language: "en" | "it",
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
      // Un tentativo fallito non blocca la compilazione: resta il nome inglese.
    }
  }
  return null;
}

async function getDexSets(
  fetcher: FetchLike,
): Promise<{ en: DexSet[]; it: DexSet[] } | null> {
  const now = Date.now();
  if (
    fetcher === fetch &&
    dexCache &&
    now - dexCache.fetchedAt < SETS_TTL_MS
  ) {
    return dexCache;
  }

  const [en, it] = await Promise.all([
    loadLanguage(fetcher, "en"),
    loadLanguage(fetcher, "it"),
  ]);
  if (!it) return null;

  const lists = { en: en ?? [], it };
  if (fetcher === fetch && en) {
    dexCache = { fetchedAt: now, en, it };
  }
  return lists;
}

function resolveDexId(
  lists: { en: DexSet[]; it: DexSet[] },
  setId: string,
  englishName: string,
): string | null {
  const candidates = [setId, SET_ID_ALIASES[setId]].filter(
    (value): value is string => Boolean(value),
  );
  for (const id of candidates) {
    if (lists.it.some((set) => set.id === id) || lists.en.some((set) => set.id === id)) {
      return id;
    }
  }

  const key = normalizeSetName(englishName);
  if (!key) return null;
  const hits = lists.en.filter((set) => normalizeSetName(set.name) === key);
  return hits.length === 1 ? hits[0].id : null;
}

/**
 * Nome italiano dell'espansione. Prima un'eventuale traduzione scritta a mano,
 * poi TCGdex. Null se nessuna delle due ha un nome: resta quello inglese.
 */
export async function italianExpansionName(
  input: { setId: string; englishName: string; setCode: string },
  fetcher: FetchLike = fetch,
): Promise<string | null> {
  const manual = manualItalianSetName(input.setCode, input.setId);
  if (manual) return manual;

  const lists = await getDexSets(fetcher);
  if (!lists) return null;
  const dexId = resolveDexId(lists, input.setId, input.englishName);
  if (!dexId) return null;
  return lists.it.find((set) => set.id === dexId)?.name ?? null;
}
