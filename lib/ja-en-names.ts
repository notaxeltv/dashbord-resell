const EXPANSIONS_PAGE = "List of Japanese Pokémon Trading Card Game expansions";
const OTHER_LANGUAGES_PAGE = "List of Pokémon Trading Card Game expansions in other languages";
const SETS_TTL_MS = 6 * 60 * 60 * 1000;

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type SpeciesName = { ja: string; en: string };

type SetNameEntry = {
  japanese: string;
  english: string;
  count: number | null;
};

type PrintedCards = {
  byNumber: Map<string, string>;
  unnumbered: string[];
};

const FORM_PREFIXES: ReadonlyArray<readonly [string, string]> = [
  ["ヒスイ", "Hisuian"],
  ["ガラル", "Galarian"],
  ["アローラ", "Alolan"],
  ["パルデア", "Paldean"],
  ["メガ", "Mega"],
  ["オリジン", "Origin Forme"],
];

const CARD_SUFFIXES = ["VSTAR", "VMAX", "VUNION", "GX", "ex", "EX", "V"];

const EXTRA_SET_NAMES: Record<string, string> = {
  "スカーレット&バイオレット プロモカード": "SV-P Promotional cards",
  "メガ プロモカード": "M-P Promotional cards",
};

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
  レインボーエネルギー: "Rainbow Energy",
  ダブル無色エネルギー: "Double Colorless Energy",
};

const POKEAPI_GRAPHQL = "https://beta.pokeapi.co/graphql/v1beta";
const SPECIES_NAMES_QUERY = `query {
  pokemon_v2_pokemonspeciesname(where: {language_id: {_in: [9, 11]}}) {
    name
    language_id
    pokemon_species_id
  }
}`;

let setNamesCache: { fetchedAt: number; entries: SetNameEntry[] } | null = null;
let speciesByJapaneseCache: { fetchedAt: number; names: Map<string, string> } | null =
  null;
const speciesCache = new Map<number, SpeciesName | null>();
const cardNamesCache = new Map<string, { fetchedAt: number; cards: PrintedCards }>();
const searchedSetNames = new Map<string, string | null>();

function tcgDisplay(args: string): string {
  const parts = args.split("|").map((part) => part.trim());
  return (parts.length >= 2 ? parts[parts.length - 1] : parts[0]) ?? "";
}

function splitLocalizedName(value: string): string[] {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\s*[•・]\s*|\n+/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function addSetNames(
  entries: SetNameEntry[],
  japaneseRaw: string,
  englishRaw: string,
  count: number | null,
) {
  const japanese = splitLocalizedName(japaneseRaw);
  const english = splitLocalizedName(englishRaw);
  if (japanese.length === english.length) {
    japanese.forEach((name, index) => {
      entries.push({ japanese: name, english: english[index], count });
    });
    return;
  }
  const ja = japaneseRaw.replace(/<[^>]+>/g, "").trim();
  const en = englishRaw.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (ja && en) entries.push({ japanese: ja, english: en, count });
}

/**
 * Dall'elenco Bulbapedia delle espansioni giapponesi ricava la traduzione
 * inglese del nome giapponese (黒炎の支配者 → Ruler of the Black Flame),
 * non il nome del set occidentale corrispondente.
 */
export function parseJapaneseSetNames(wikitext: string): Map<string, string> {
  const names = new Map<string, string>();
  for (const entry of parseExpansionCatalog(wikitext)) names.set(entry.japanese, entry.english);
  return names;
}

export function parseExpansionCatalog(wikitext: string): SetNameEntry[] {
  const entries: SetNameEntry[] = [];
  const pattern = /([^\n|{}]+?)<br>\s*\{\{TCG\|([^}]+)\}\}/g;
  for (const match of wikitext.matchAll(pattern)) {
    const after = wikitext.slice(match.index ?? 0, (match.index ?? 0) + 500);
    const count = Number(after.match(/\n\|\s*(\d+)\b/)?.[1] ?? "");
    addSetNames(
      entries,
      match[1],
      tcgDisplay(match[2]),
      Number.isFinite(count) && count > 0 ? count : null,
    );
  }
  return entries;
}

export function parseOtherLanguageCatalog(wikitext: string): SetNameEntry[] {
  const start = wikitext.indexOf("==Japanese sets==");
  if (start < 0) return [];
  const entries: SetNameEntry[] = [];
  const lines = wikitext.slice(start).split("\n");
  for (let index = 0; index < lines.length - 1; index += 1) {
    const japaneseCell = lines[index].match(/^\|\s*(.+)$/)?.[1]?.trim() ?? "";
    if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(japaneseCell)) continue;
    if (japaneseCell.includes("[[File:") || japaneseCell.startsWith("style=")) continue;
    const englishCell = lines[index + 1].match(/^\|\s*(.+)$/)?.[1]?.trim() ?? "";
    const template = englishCell.match(/\{\{TCG\|([^}]+)\}\}/);
    if (!template) continue;
    addSetNames(entries, japaneseCell, tcgDisplay(template[1]), null);
    index += 1;
  }
  return entries;
}

function foldName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/アニバーサリー/g, "anniversary")
    .replace(/コレクション/g, "collection")
    .replace(/プロモカード/g, "promotional cards")
    .replace(/プロモ/g, "promo")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, "");
}

function pickSetName(
  entries: SetNameEntry[],
  cardCount: number | null,
): string | "ambiguous" | null {
  if (entries.length === 0) return null;
  const unique = [...new Set(entries.map((entry) => entry.english))];
  if (unique.length === 1) return unique[0];
  if (cardCount != null) {
    const matched = [
      ...new Set(
        entries.filter((entry) => entry.count === cardCount).map((entry) => entry.english),
      ),
    ];
    if (matched.length === 1) return matched[0];
  }
  return "ambiguous";
}

function resolveSetName(
  entries: SetNameEntry[],
  japaneseName: string,
  cardCount: number | null,
): string | null {
  const name = japaneseName.trim();
  if (!name) return null;
  const exact = pickSetName(
    entries.filter((entry) => entry.japanese === name),
    cardCount,
  );
  if (exact === "ambiguous") return null;
  if (exact) return exact;

  const folded = foldName(name);
  const foldedPick = pickSetName(
    entries.filter((entry) => foldName(entry.japanese) === folded),
    cardCount,
  );
  if (foldedPick && foldedPick !== "ambiguous") return foldedPick;

  const contained = entries
    .filter((entry) => entry.japanese.length >= 4 && name.includes(entry.japanese))
    .sort((left, right) => right.japanese.length - left.japanese.length);
  if (contained.length > 0) {
    const bestLength = contained[0].japanese.length;
    const pick = pickSetName(
      contained.filter((entry) => entry.japanese.length === bestLength),
      cardCount,
    );
    if (pick && pick !== "ambiguous") return pick;
  }
  return null;
}

async function bulbapediaWikitext(page: string, fetcher: FetchLike): Promise<string | null> {
  const url = new URL("https://bulbapedia.bulbagarden.net/w/api.php");
  url.searchParams.set("action", "parse");
  url.searchParams.set("page", page);
  url.searchParams.set("prop", "wikitext");
  url.searchParams.set("redirects", "1");
  url.searchParams.set("format", "json");
  const response = await fetcher(url.toString(), {
    headers: {
      Accept: "application/json",
      "User-Agent": "pokemon-app/card-lookup",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    parse?: { wikitext?: Record<string, string> };
  };
  return body.parse?.wikitext?.["*"] ?? null;
}

async function loadSetEntries(fetcher: FetchLike): Promise<SetNameEntry[] | null> {
  const now = Date.now();
  if (
    fetcher === fetch &&
    setNamesCache &&
    now - setNamesCache.fetchedAt < SETS_TTL_MS
  ) {
    return setNamesCache.entries;
  }

  try {
    const [expansions, otherLanguages] = await Promise.all([
      bulbapediaWikitext(EXPANSIONS_PAGE, fetcher),
      bulbapediaWikitext(OTHER_LANGUAGES_PAGE, fetcher),
    ]);
    const entries = [
      ...(expansions ? parseExpansionCatalog(expansions) : []),
      ...(otherLanguages ? parseOtherLanguageCatalog(otherLanguages) : []),
    ];
    if (entries.length === 0) return setNamesCache?.entries ?? null;
    if (fetcher === fetch) setNamesCache = { fetchedAt: now, entries };
    return entries;
  } catch {
    return setNamesCache?.entries ?? null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function englishFromSetPage(wikitext: string, japaneseName: string): string | null {
  const escaped = escapeRegExp(japaneseName);
  const labeled = wikitext.match(new RegExp(`'''([^']+)''' \\(Japanese: '''${escaped}'''`));
  if (labeled?.[1]) return labeled[1].trim();
  const italic = wikitext.match(new RegExp(`'''${escaped}'''\\s*''([^']+)''`));
  if (italic?.[1]) return italic[1].trim();
  const translated = wikitext.match(/\{\{tt\|([^|}]+)\|([^|}]+)\}\}/);
  if (translated && translated[1].includes(japaneseName)) return translated[2].trim();
  const infobox = wikitext.match(/\|jasetname=([^\n|]+)/);
  const infoboxName = infobox?.[1]?.replace(/\{\{ruby\|([^|}]+)\|[^}]*\}\}/g, "$1").trim();
  if (infoboxName === japaneseName) {
    const title = wikitext.match(/\|setname=([^\n|]+)/)?.[1]?.trim();
    if (title && !/[\u3040-\u30ff\u4e00-\u9fff]/.test(title)) return title;
  }
  return null;
}

async function searchEnglishSetName(
  japaneseName: string,
  fetcher: FetchLike,
): Promise<string | null> {
  if (searchedSetNames.has(japaneseName)) return searchedSetNames.get(japaneseName) ?? null;
  try {
    const url = new URL("https://bulbapedia.bulbagarden.net/w/api.php");
    url.searchParams.set("action", "query");
    url.searchParams.set("list", "search");
    url.searchParams.set("srsearch", japaneseName);
    url.searchParams.set("srlimit", "8");
    url.searchParams.set("format", "json");
    const response = await fetcher(url.toString(), {
      headers: {
        Accept: "application/json",
        "User-Agent": "pokemon-app/card-lookup",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as {
      query?: { search?: Array<{ title?: string }> };
    };
    for (const hit of body.query?.search ?? []) {
      const title = hit.title?.trim() ?? "";
      if (!title.endsWith("(TCG)")) continue;
      const wikitext = await bulbapediaWikitext(title, fetcher);
      const english = wikitext ? englishFromSetPage(wikitext, japaneseName) : null;
      if (english) {
        searchedSetNames.set(japaneseName, english);
        return english;
      }
    }
    searchedSetNames.set(japaneseName, null);
    return null;
  } catch {
    return null;
  }
}

export async function englishJapaneseSetName(
  japaneseName: string,
  fetcher: FetchLike = fetch,
  cardCount: number | null = null,
): Promise<string | null> {
  const extra = EXTRA_SET_NAMES[japaneseName.trim().replace(/＆/g, "&").replace(/\s+/g, " ")];
  if (extra) return extra;
  const entries = await loadSetEntries(fetcher);
  const resolved = entries ? resolveSetName(entries, japaneseName, cardCount) : null;
  if (resolved) return resolved;
  if (!/[\u3040-\u30ff\u4e00-\u9fff]/.test(japaneseName)) return japaneseName.trim() || null;
  return searchEnglishSetName(japaneseName.trim(), fetcher);
}

function rememberCardNumber(names: Map<string, string>, number: string, english: string) {
  const trimmed = number.trim();
  const name = english.trim();
  if (!trimmed || !name || trimmed === "None") return;
  names.set(trimmed, name);
  const stripped = trimmed.replace(/^0+(?=\d)/, "");
  if (stripped) names.set(stripped, name);
}

function sameSet(setArg: string, sectionTitle: string): boolean {
  if (setArg === sectionTitle) return true;
  const left = setArg.toLowerCase();
  const right = sectionTitle.toLowerCase();
  if (left.length < 4 || right.length < 4) return false;
  return right.startsWith(left) || left.startsWith(right);
}

function nameFromTcgId(args: string[], sectionTitle: string): string | null {
  const [setArg, cardName, third] = args.map((arg) => arg.trim());
  if (!setArg || !cardName) return null;
  if (third && /^\d+[a-zA-Z]?$/.test(third)) {
    return sameSet(setArg, sectionTitle) ? cardName : null;
  }
  if (third && `${setArg} ${third}`.replace(/\s+/g, " ") === sectionTitle) return cardName;
  if (!third && sameSet(setArg, sectionTitle)) return cardName;
  return null;
}

function nameFromEntry(rest: string, sectionTitle: string): string | null {
  const id = rest.match(/\{\{TCG ID\|([^{}]+)\}\}/);
  if (id) {
    const fromId = nameFromTcgId(id[1].split("|"), sectionTitle);
    if (fromId) return fromId;
  }
  const link = rest.match(/\[\[([^\]|]+?) \(([^)]+)\)\|/);
  if (!link) return null;
  const paren = link[2].trim();
  if (paren !== sectionTitle && !paren.startsWith(`${sectionTitle} `)) return null;
  return link[1].trim();
}

/**
 * Dall'elenco Bulbapedia del set giapponese ricava il nome inglese della carta
 * (ポピー → Poppy, ロケット団のおねーさん → Rocket's Admin), per ogni era.
 */
export function parseJapaneseSetCardNames(
  wikitext: string,
  englishSetName: string,
): PrintedCards {
  const byNumber = new Map<string, string>();
  const unnumbered: string[] = [];
  const headers = [
    ...wikitext.matchAll(
      /\{\{(?:Setlist|halfdecklist)\/(?:nm)?header\|title=([^|\n]+)\|/g,
    ),
  ];
  headers.forEach((header, index) => {
    if (header[1].trim() !== englishSetName || header.index == null) return;
    const start = header.index + header[0].length;
    const next = headers[index + 1]?.index ?? wikitext.length;
    let body = wikitext.slice(start, next);
    const footer = body.indexOf("{{Setlist/footer");
    if (footer >= 0) body = body.slice(0, footer);
    for (const entry of body.matchAll(
      /\{\{(?:Setlist|halfdecklist)\/(?:nm)?entry\|([^|\n]+)\|([^\n]+)/g,
    )) {
      const english = nameFromEntry(entry[2], englishSetName);
      if (!english) continue;
      const number = entry[1].split("/")[0]?.trim() ?? "";
      if (!number || number === "None" || number === "—") unnumbered.push(english);
      else rememberCardNumber(byNumber, number, english);
    }
  });
  return { byNumber, unnumbered };
}

async function loadCardNames(
  englishSetName: string,
  fetcher: FetchLike,
): Promise<PrintedCards | null> {
  const now = Date.now();
  const cached = cardNamesCache.get(englishSetName);
  if (fetcher === fetch && cached && now - cached.fetchedAt < SETS_TTL_MS) {
    return cached.cards;
  }

  try {
    let wikitext = await bulbapediaWikitext(`${englishSetName} (TCG)`, fetcher);
    const redirect = wikitext?.match(/^#REDIRECT\s+\[\[([^\]|#]+)/i)?.[1]?.trim();
    if (redirect) wikitext = await bulbapediaWikitext(redirect, fetcher);
    if (!wikitext) return cached?.cards ?? null;
    const cards = parseJapaneseSetCardNames(wikitext, englishSetName);
    if (cards.byNumber.size === 0 && cards.unnumbered.length === 0) {
      return cached?.cards ?? null;
    }
    if (fetcher === fetch) cardNamesCache.set(englishSetName, { fetchedAt: now, cards });
    return cards;
  } catch {
    return cached?.cards ?? null;
  }
}

export async function englishJapanesePrintedName(
  englishSetName: string,
  number: string,
  fetcher: FetchLike = fetch,
): Promise<string | null> {
  const cards = await loadCardNames(englishSetName.trim(), fetcher);
  if (!cards) return null;
  const trimmed = number.trim();
  const stripped = trimmed.replace(/^0+(?=\d)/, "");
  const numbered =
    cards.byNumber.get(trimmed) ??
    (stripped ? cards.byNumber.get(stripped) : undefined) ??
    (/^\d+$/.test(stripped) ? cards.byNumber.get(stripped.padStart(3, "0")) : undefined);
  if (numbered) return numbered;
  if (cards.byNumber.size > 0 || !/^\d+$/.test(stripped)) return null;
  const index = Number(stripped) - 1;
  return cards.unnumbered[index] ?? null;
}

function splitLatinSuffix(name: string): { base: string; suffix: string } {
  for (const suffix of CARD_SUFFIXES) {
    if (!name.endsWith(suffix) || name.length === suffix.length) continue;
    const base = name.slice(0, -suffix.length);
    if (/[^\u0000-\u007f]/.test(base)) return { base, suffix };
  }
  return { base: name, suffix: "" };
}

function speciesEnglish(
  base: string,
  species: SpeciesName,
  tail: string,
  loose: boolean,
): string | null {
  if (!species.ja || base === species.ja) return `${species.en}${tail}`;
  for (const [japanesePrefix, englishPrefix] of FORM_PREFIXES) {
    if (!base.startsWith(japanesePrefix)) continue;
    const rest = base.slice(japanesePrefix.length);
    if (rest === species.ja) return `${englishPrefix} ${species.en}${tail}`;
    if (
      rest.startsWith(species.ja) &&
      /^[A-Z]$/.test(rest.slice(species.ja.length))
    ) {
      const form = rest.slice(species.ja.length);
      return `${englishPrefix} ${species.en} ${form}${tail}`;
    }
  }
  return loose ? `${species.en}${tail}` : null;
}

async function loadSpecies(dexId: number, fetcher: FetchLike): Promise<SpeciesName | null> {
  if (speciesCache.has(dexId)) return speciesCache.get(dexId) ?? null;
  try {
    const response = await fetcher(`https://pokeapi.co/api/v2/pokemon-species/${dexId}`, {
      headers: { Accept: "application/json", "User-Agent": "pokemon-app/card-lookup" },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
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

/**
 * Nome inglese della carta giapponese: specie Pokémon (con suffisso ex/V/…)
 * oppure energia base. Null se serve l'elenco del set (allenatore, strumento,
 * Pokémon di un allenatore).
 */
export async function englishJapaneseCardName(
  dexId: number | null,
  japaneseName: string,
  fetcher: FetchLike = fetch,
  options?: { loose?: boolean },
): Promise<string | null> {
  const energy = BASIC_ENERGY[japaneseName.trim()];
  if (energy) return energy;
  const loose = options?.loose ?? false;

  if (dexId) {
    const species = await loadSpecies(dexId, fetcher);
    if (species) {
      const { base, suffix } = splitLatinSuffix(japaneseName.trim());
      const tail = suffix ? ` ${suffix}` : "";
      const translated = speciesEnglish(base, species, tail, loose);
      if (translated) return translated;
    }
  }

  const names = await loadSpeciesByJapaneseName(fetcher);
  if (!names) return null;
  const { base, suffix } = splitLatinSuffix(japaneseName.trim());
  const tail = suffix ? ` ${suffix}` : "";
  const direct = names.get(base);
  if (direct) return `${direct}${tail}`;
  for (const [japanesePrefix, englishPrefix] of FORM_PREFIXES) {
    if (!base.startsWith(japanesePrefix)) continue;
    const rest = base.slice(japanesePrefix.length);
    const speciesName = names.get(rest);
    if (speciesName) return `${englishPrefix} ${speciesName}${tail}`;
    for (const [speciesJa, speciesEn] of names) {
      if (!rest.startsWith(speciesJa) || !/^[A-Z]$/.test(rest.slice(speciesJa.length))) continue;
      return `${englishPrefix} ${speciesEn} ${rest.slice(speciesJa.length)}${tail}`;
    }
  }
  if (!loose) return null;
  let bestJa = "";
  let bestEn = "";
  for (const [speciesJa, speciesEn] of names) {
    if (speciesJa.length < 2 || speciesJa.length <= bestJa.length) continue;
    if (base.includes(speciesJa)) {
      bestJa = speciesJa;
      bestEn = speciesEn;
    }
  }
  return bestEn ? `${bestEn}${tail}` : null;
}

export function readDexId(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const dexId = (body as { dexId?: unknown }).dexId;
  if (Array.isArray(dexId) && typeof dexId[0] === "number") return dexId[0];
  return typeof dexId === "number" ? dexId : null;
}

export function readPrintedCount(body: unknown): number | null {
  if (!body || typeof body !== "object") return null;
  const count = (body as { set?: { cardCount?: { official?: unknown; total?: unknown } } }).set
    ?.cardCount;
  if (typeof count?.official === "number" && count.official > 0) return count.official;
  if (typeof count?.total === "number" && count.total > 0) return count.total;
  return null;
}
