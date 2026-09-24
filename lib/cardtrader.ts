/**
 * Integrazione (server-only) con l'API di CardTrader per recuperare
 * l'immagine di una carta Pokémon a partire da nome e set.
 *
 * Usa GET /blueprints/export (documentazione ufficiale) e il campo image_url.
 */

const CARDTRADER_API_BASE = "https://api.cardtrader.com/api/v2";
const CARDTRADER_IMAGE_BASE = "https://www.cardtrader.com";
const FALLBACK_POKEMON_GAME_ID = 5;
const FETCH_TIMEOUT_MS = 25_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_EXPANSION_CANDIDATES = 5;

interface CardTraderGame {
  id: number;
  name?: string;
  display_name?: string;
}

interface CardTraderExpansion {
  id: number;
  game_id: number;
  code: string;
  name: string;
}

interface CardTraderBlueprint {
  id: number;
  name: string;
  version?: string | null;
  expansion_id: number;
  category_id?: number;
  image_url?: string | null;
  image?: {
    url?: string;
    show?: { url?: string };
    preview?: { url?: string };
  } | null;
}

export type ImageSearchReason =
  | "ok"
  | "no_token"
  | "missing_name"
  | "missing_set"
  | "no_expansion"
  | "not_found"
  | "error";

export interface ImageSearchResult {
  imageUrl: string | null;
  reason: ImageSearchReason;
}

let pokemonGameIdCache: { id: number; fetchedAt: number } | null = null;
let singlesCategoryCache: { id: number | null; fetchedAt: number } | null = null;
let expansionsCache: { data: CardTraderExpansion[]; fetchedAt: number } | null =
  null;
const blueprintsCache = new Map<
  number,
  { data: CardTraderBlueprint[]; fetchedAt: number }
>();

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function asArray<T>(raw: unknown): T[] {
  if (Array.isArray(raw)) return raw as T[];
  if (raw && typeof raw === "object") {
    const record = raw as Record<string, unknown>;
    if (Array.isArray(record.array)) return record.array as T[];
    if (Array.isArray(record.data)) return record.data as T[];
    if (Array.isArray(record.blueprints)) return record.blueprints as T[];
    if (Array.isArray(record.expansions)) return record.expansions as T[];
    if (Array.isArray(record.games)) return record.games as T[];
  }
  return [];
}

async function cardTraderFetch(path: string): Promise<unknown | null> {
  const token = process.env.CARDTRADER_API_TOKEN;
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${CARDTRADER_API_BASE}${path}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      signal: controller.signal,
      cache: "no-store",
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getPokemonGameId(): Promise<number> {
  if (pokemonGameIdCache && Date.now() - pokemonGameIdCache.fetchedAt < CACHE_TTL_MS) {
    return pokemonGameIdCache.id;
  }

  const raw = await cardTraderFetch("/games");
  const games = asArray<CardTraderGame>(raw);
  const pokemon = games.find((game) =>
    /pokemon/.test(normalize(`${game.name ?? ""} ${game.display_name ?? ""}`)),
  );
  const id = pokemon?.id ?? FALLBACK_POKEMON_GAME_ID;
  pokemonGameIdCache = { id, fetchedAt: Date.now() };
  return id;
}

async function getPokemonSinglesCategoryId(): Promise<number | null> {
  if (singlesCategoryCache && Date.now() - singlesCategoryCache.fetchedAt < CACHE_TTL_MS) {
    return singlesCategoryCache.id;
  }

  const gameId = await getPokemonGameId();
  const raw = await cardTraderFetch(`/categories?game_id=${gameId}`);
  const categories = asArray<{ id: number; name?: string }>(raw);
  const singles = categories.find((category) =>
    /single/.test(normalize(category.name ?? "")),
  );
  const id = singles?.id ?? 73;
  singlesCategoryCache = { id, fetchedAt: Date.now() };
  return id;
}

async function getPokemonExpansions(): Promise<CardTraderExpansion[]> {
  if (expansionsCache && Date.now() - expansionsCache.fetchedAt < CACHE_TTL_MS) {
    return expansionsCache.data;
  }

  const gameId = await getPokemonGameId();
  const raw = await cardTraderFetch("/expansions");
  const all = asArray<CardTraderExpansion>(raw);
  const pokemonExpansions = all.filter((expansion) => expansion.game_id === gameId);

  expansionsCache = { data: pokemonExpansions, fetchedAt: Date.now() };
  return pokemonExpansions;
}

async function getBlueprintsForExpansion(
  expansionId: number,
): Promise<CardTraderBlueprint[]> {
  const cached = blueprintsCache.get(expansionId);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const raw = await cardTraderFetch(
    `/blueprints/export?expansion_id=${expansionId}`,
  );
  const blueprints = asArray<CardTraderBlueprint>(raw);

  blueprintsCache.set(expansionId, { data: blueprints, fetchedAt: Date.now() });
  return blueprints;
}

function canonicalizeImageHost(url: string): string {
  return url.replace(/^https:\/\/cardtrader\.com/i, "https://www.cardtrader.com");
}

function resolveImageUrl(value: string | null | undefined): string | null {
  if (!value || value.includes("fallbacks/card_uploader")) return null;
  if (value.startsWith("//")) return canonicalizeImageHost(`https:${value}`);
  if (value.startsWith("http://") || value.startsWith("https://")) {
    return canonicalizeImageHost(value);
  }
  if (value.startsWith("/")) return `${CARDTRADER_IMAGE_BASE}${value}`;
  return `${CARDTRADER_IMAGE_BASE}/${value}`;
}

function extractImageUrl(blueprint: CardTraderBlueprint): string | null {
  return resolveImageUrl(
    blueprint.image?.show?.url ??
      blueprint.image?.preview?.url ??
      blueprint.image_url ??
      blueprint.image?.url ??
      null,
  );
}

function expansionScore(
  expansion: CardTraderExpansion,
  setName: string | null | undefined,
  setCode: string | null | undefined,
  preferJapanese: boolean,
): number {
  const expansionName = normalize(expansion.name ?? "");
  const expansionCode = normalize(expansion.code ?? "");
  const queryName = setName ? normalize(setName) : "";
  const queryCode = setCode ? normalize(setCode) : "";
  let score = -1;

  if (queryCode && expansionCode && expansionCode === queryCode) score = 5;
  else if (queryName && expansionName === queryName) score = 4;
  else if (queryName && (expansionName.startsWith(queryName) || queryName.startsWith(expansionName)))
    score = 3;
  else if (
    queryName &&
    (expansionName.includes(queryName) || queryName.includes(expansionName))
  )
    score = 2;
  else if (queryCode && (expansionName.includes(queryCode) || expansionCode.includes(queryCode)))
    score = 1;

  if (score >= 0 && preferJapanese) {
    if (/\bjap|\bjp\b|japan/.test(expansionName) || expansionCode.endsWith("jp")) {
      score += 1;
    }
  }

  return score;
}

function blueprintScore(
  blueprint: CardTraderBlueprint,
  cardName: string,
  number?: string | null,
  singlesCategoryId?: number | null,
): number {
  const bpName = normalize(
    `${blueprint.name ?? ""}${blueprint.version ? ` ${blueprint.version}` : ""}`,
  );
  const query = normalize(cardName);
  if (!bpName || !query) return -1;

  let score = -1;
  if (bpName === query) score = 100;
  else if (bpName.startsWith(`${query} `)) score = 80;
  else if (query.startsWith(`${bpName} `) && bpName.length >= 4) score = 70;
  else if (` ${bpName} `.includes(` ${query} `)) score = 55;
  else {
    const tokens = query.split(" ").filter((token) => token.length > 1);
    if (tokens.length > 0 && tokens.every((token) => bpName.includes(token))) {
      score = 40;
    }
  }

  if (score < 0) return -1;

  if (singlesCategoryId && blueprint.category_id === singlesCategoryId) {
    score += 25;
  }

  if (number) {
    const haystack = normalize(
      `${bpName} ${blueprint.image_url ?? ""} ${blueprint.image?.show?.url ?? ""}`,
    );
    const raw = number.trim();
    const parts = raw.split(/[\/\-]/).map((part) => normalize(part)).filter(Boolean);
    if (parts[0] && haystack.includes(parts[0])) {
      score += 20;
    }
    if (parts[1] && haystack.includes(parts[1])) {
      score += 10;
    }
  }

  return score;
}

export async function findCardImageUrl(params: {
  name: string;
  setName?: string | null;
  setCode?: string | null;
  number?: string | null;
  isJapanese?: boolean;
}): Promise<ImageSearchResult> {
  if (!process.env.CARDTRADER_API_TOKEN) {
    return { imageUrl: null, reason: "no_token" };
  }

  const name = params.name?.trim() ?? "";
  const setName = params.setName?.trim() || null;
  const setCode = params.setCode?.trim() || null;

  if (!name) return { imageUrl: null, reason: "missing_name" };
  if (!setName && !setCode) return { imageUrl: null, reason: "missing_set" };

  try {
    const expansions = await getPokemonExpansions();
    if (expansions.length === 0) {
      return { imageUrl: null, reason: "no_expansion" };
    }

    const scored = expansions
      .map((expansion) => ({
        expansion,
        score: expansionScore(
          expansion,
          setName,
          setCode,
          Boolean(params.isJapanese),
        ),
      }))
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_EXPANSION_CANDIDATES);

    if (scored.length === 0) {
      return { imageUrl: null, reason: "no_expansion" };
    }

    const singlesCategoryId = await getPokemonSinglesCategoryId();

    let best: { score: number; extra: number; collector: number; url: string } | null =
      null;

    for (const { expansion } of scored) {
      const blueprints = await getBlueprintsForExpansion(expansion.id);
      for (const blueprint of blueprints) {
        const score = blueprintScore(
          blueprint,
          name,
          params.number,
          singlesCategoryId,
        );
        if (score < 40) continue;
        const imageUrl = extractImageUrl(blueprint);
        if (!imageUrl) continue;
        const extra = Math.max(
          0,
          normalize(blueprint.name).split(" ").length - normalize(name).split(" ").length,
        );
        const collectorMatch = imageUrl.match(/(\d+)[-_](\d+)/);
        const collector = collectorMatch ? Number(collectorMatch[1]) : 9999;
        if (
          !best ||
          score > best.score ||
          (score === best.score && extra < best.extra) ||
          (score === best.score && extra === best.extra && collector < best.collector)
        ) {
          best = { score, extra, collector, url: imageUrl };
        }
      }
    }

    if (!best) return { imageUrl: null, reason: "not_found" };
    return { imageUrl: best.url, reason: "ok" };
  } catch {
    return { imageUrl: null, reason: "error" };
  }
}
