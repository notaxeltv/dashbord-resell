const BULBAPEDIA_PAGE = "List of Japanese Pokémon Trading Card Game expansions";
const SETS_TTL_MS = 6 * 60 * 60 * 1000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type SpeciesName = { ja: string; en: string };

const FORM_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["ヒスイ", "Hisuian"],
  ["ガラル", "Galarian"],
  ["アローラ", "Alolan"],
  ["パルデア", "Paldean"],
  ["メガ", "Mega"],
  ["オリジン", "Origin Forme"],
];

const BASIC_ENERGY: Record<string, string> = {
  基本草エネルギー: "Basic Grass Energy",
  基本炎エネルギー: "Basic Fire Energy",
  基本水エネルギー: "Basic Water Energy",
  基本雷エネルギー: "Basic Lightning Energy",
  基本超エネルギー: "Basic Psychic Energy",
  基本闘エネルギー: "Basic Fighting Energy",
  基本悪エネルギー: "Basic Darkness Energy",
  基本鋼エネルギー: "Basic Metal Energy",
  基本フェアリーエネルギー: "Basic Fairy Energy",
};

const POKEAPI_GRAPHQL = "https://beta.pokeapi.co/graphql/v1beta";
const SPECIES_NAMES_QUERY = `query {
  pokemon_v2_pokemonspeciesname(where: {language_id: {_in: [9, 11]}}) {
    name
    language_id
    pokemon_species_id
  }
}`;

let setNamesCache: { fetchedAt: number; names: Map<string, string> } | null = null;
let speciesByJapaneseCache: { fetchedAt: number; names: Map<string, string> } | null =
  null;
const speciesCache = new Map<number, SpeciesName | null>();

/**
 * Dall'elenco Bulbapedia delle espansioni giapponesi ricava la traduzione
 * inglese del nome giapponese (黒炎の支配者 → Ruler of the Black Flame),
 * non il nome del set occidentale corrispondente.
 */
export function parseJapaneseSetNames(wikitext: string): Map<string, string> {
  const names = new Map<string, string>();
  const pattern = /([^\n|{}]+?)<br>\s*\{\{TCG\|([^}]+)\}\}/g;
  for (const match of wikitext.matchAll(pattern)) {
    const japanese = match[1].replace(/<[^>]+>/g, "").trim();
    const args = match[2].split("|").map((part) => part.trim());
    const english = (args.length >= 2 ? args[args.length - 1] : args[0]) ?? "";
    if (!japanese || !english) continue;
    const japaneseParts = japanese.split(/\s*[•・]\s*/).filter(Boolean);
    const englishParts = english.split(/\s*[•・]\s*/).filter(Boolean);
    if (japaneseParts.length === englishParts.length) {
      japaneseParts.forEach((part, index) => names.set(part, englishParts[index]));
    } else {
      names.set(japanese, english);
    }
  }
  return names;
}

async function loadSetNames(fetcher: FetchLike): Promise<Map<string, string> | null> {
  const now = Date.now();
  if (
    fetcher === fetch &&
    setNamesCache &&
    now - setNamesCache.fetchedAt < SETS_TTL_MS
  ) {
    return setNamesCache.names;
  }

  const url = new URL("https://bulbapedia.bulbagarden.net/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", BULBAPEDIA_PAGE);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("format", "json");

  try {
    const response = await fetcher(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "pokemon-app/card-lookup",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return setNamesCache?.names ?? null;
    const body = (await response.json()) as {
      parse?: { wikitext?: Record<string, string> };
    };
    const wikitext = body.parse?.wikitext?.["*"];
    if (!wikitext) return setNamesCache?.names ?? null;
    const names = parseJapaneseSetNames(wikitext);
    if (names.size === 0) return setNamesCache?.names ?? null;
    if (fetcher === fetch) setNamesCache = { fetchedAt: now, names };
    return names;
  } catch {
    return setNamesCache?.names ?? null;
  }
}

export async function englishJapaneseSetName(
  japaneseName: string,
  fetcher: FetchLike = fetch,
): Promise<string | null> {
  const names = await loadSetNames(fetcher);
  const english = names?.get(japaneseName.trim());
  return english?.trim() || null;
}

function splitLatinSuffix(name: string): { base: string; suffix: string } {
  const match = name.match(/^(.*?)([A-Za-z][A-Za-z0-9]*)$/);
  if (!match?.[1] || !match[2] || !/[^\u0000-\u007f]/.test(match[1])) {
    return { base: name, suffix: "" };
  }
  return { base: match[1], suffix: match[2] };
}

async function loadSpecies(
  dexId: number,
  fetcher: FetchLike,
): Promise<SpeciesName | null> {
  if (speciesCache.has(dexId)) return speciesCache.get(dexId) ?? null;
  try {
    const response = await fetcher(
      `https://pokeapi.co/api/v2/pokemon-species/${dexId}`,
      {
        headers: { Accept: "application/json", "User-Agent": "pokemon-app/card-lookup" },
        cache: "no-store",
        signal: AbortSignal.timeout(12_000),
      },
    );
    if (!response.ok) {
      speciesCache.set(dexId, null);
      return null;
    }
    const body = (await response.json()) as {
      names?: Array<{ name?: string; language?: { name?: string } }>;
    };
    const names = body.names ?? [];
    const en = names.find((entry) => entry.language?.name === "en")?.name?.trim() ?? "";
    const ja = names.find((entry) => entry.language?.name === "ja")?.name?.trim() ?? "";
    if (!en) {
      speciesCache.set(dexId, null);
      return null;
    }
    const species = { ja, en };
    speciesCache.set(dexId, species);
    return species;
  } catch {
    return null;
  }
}

type SpeciesNameRow = {
  name?: string;
  language_id?: number;
  pokemon_species_id?: number;
};

async function loadSpeciesByJapaneseName(
  fetcher: FetchLike,
): Promise<Map<string, string> | null> {
  const now = Date.now();
  if (
    fetcher === fetch &&
    speciesByJapaneseCache &&
    now - speciesByJapaneseCache.fetchedAt < SETS_TTL_MS
  ) {
    return speciesByJapaneseCache.names;
  }

  try {
    const response = await fetcher(POKEAPI_GRAPHQL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "User-Agent": "pokemon-app/card-lookup",
      },
      body: JSON.stringify({ query: SPECIES_NAMES_QUERY }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return speciesByJapaneseCache?.names ?? null;
    const body = (await response.json()) as {
      data?: { pokemon_v2_pokemonspeciesname?: SpeciesNameRow[] };
    };
    const rows = body.data?.pokemon_v2_pokemonspeciesname;
    if (!rows?.length) return speciesByJapaneseCache?.names ?? null;

    const byId = new Map<number, { ja?: string; en?: string }>();
    for (const row of rows) {
      const id = row.pokemon_species_id;
      const name = row.name?.trim();
      if (!id || !name) continue;
      const slot = byId.get(id) ?? {};
      if (row.language_id === 9) slot.en = name;
      if (row.language_id === 11) slot.ja = name;
      byId.set(id, slot);
    }

    const names = new Map<string, string>();
    for (const slot of byId.values()) {
      if (slot.ja && slot.en) names.set(slot.ja, slot.en);
    }
    if (names.size === 0) return speciesByJapaneseCache?.names ?? null;
    if (fetcher === fetch) speciesByJapaneseCache = { fetchedAt: now, names };
    return names;
  } catch {
    return speciesByJapaneseCache?.names ?? null;
  }
}

function englishFromSpeciesMap(
  japaneseName: string,
  names: Map<string, string>,
): string | null {
  const { base, suffix } = splitLatinSuffix(japaneseName.trim());
  const tail = suffix ? ` ${suffix}` : "";
  const direct = names.get(base);
  if (direct) return `${direct}${tail}`;
  for (const [japanesePrefix, englishPrefix] of FORM_PREFIXES) {
    if (!base.startsWith(japanesePrefix)) continue;
    const species = names.get(base.slice(japanesePrefix.length));
    if (species) return `${englishPrefix} ${species}${tail}`;
  }
  return null;
}

/**
 * Nome inglese della carta giapponese: specie Pokémon (con suffisso ex/V/…)
 * oppure energia base. Null se non c'è una traduzione affidabile.
 */
export async function englishJapaneseCardName(
  dexId: number | null,
  japaneseName: string,
  fetcher: FetchLike = fetch,
): Promise<string | null> {
  const energy = BASIC_ENERGY[japaneseName.trim()];
  if (energy) return energy;

  if (dexId) {
    const species = await loadSpecies(dexId, fetcher);
    if (species) {
      const { base, suffix } = splitLatinSuffix(japaneseName.trim());
      const tail = suffix ? ` ${suffix}` : "";
      if (!species.ja || base === species.ja) return `${species.en}${tail}`;
      for (const [japanesePrefix, englishPrefix] of FORM_PREFIXES) {
        if (base === japanesePrefix + species.ja) {
          return `${englishPrefix} ${species.en}${tail}`;
        }
      }
      return `${species.en}${tail}`;
    }
  }

  const names = await loadSpeciesByJapaneseName(fetcher);
  if (!names) return null;
  return englishFromSpeciesMap(japaneseName, names);
}

export function readDexId(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const dexId = (body as { dexId?: unknown }).dexId;
  if (Array.isArray(dexId) && typeof dexId[0] === "number") return dexId[0];
  return typeof dexId === "number" ? dexId : null;
}
