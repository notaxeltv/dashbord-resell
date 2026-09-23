/**
 * Integrazione (server-only) con l'API di CardTrader per recuperare
 * l'immagine di una carta Pokémon a partire da nome e set.
 *
 * Feature "best effort": se il token non è configurato, o la ricerca non
 * trova corrispondenze, si restituisce semplicemente `null` senza mai
 * lanciare eccezioni che possano rompere il resto dell'app.
 *
 * Il token (`CARDTRADER_API_TOKEN`) resta sempre lato server: non viene mai
 * esposto al browser né usato in variabili `NEXT_PUBLIC_*`.
 */

const CARDTRADER_API_BASE = "https://api.cardtrader.com/api/v2";
const CARDTRADER_IMAGE_BASE = "https://www.cardtrader.com";
const POKEMON_GAME_ID = 5;
const FETCH_TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6 ore
const MAX_EXPANSION_CANDIDATES = 3;
const MAX_BLUEPRINT_PAGES = 6; // limite di sicurezza: 6 * 50 = 300 blueprint per set

interface CardTraderExpansion {
  id: number;
  game_id: number;
  code: string;
  name: string;
}

interface CardTraderBlueprint {
  id: number;
  name: string;
  expansion_id: number;
  image?: {
    url?: string;
    show?: { url?: string };
    preview?: { url?: string };
  } | null;
}

let expansionsCache: { data: CardTraderExpansion[]; fetchedAt: number } | null = null;
const blueprintsCache = new Map<number, { data: CardTraderBlueprint[]; fetchedAt: number }>();

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function cardTraderFetch(path: string): Promise<unknown | null> {
  const token = process.env.CARDTRADER_API_TOKEN;
  if (!token) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(`${CARDTRADER_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

async function getPokemonExpansions(): Promise<CardTraderExpansion[]> {
  if (expansionsCache && Date.now() - expansionsCache.fetchedAt < CACHE_TTL_MS) {
    return expansionsCache.data;
  }

  const raw = await cardTraderFetch("/expansions");
  if (!Array.isArray(raw)) return expansionsCache?.data ?? [];

  const pokemonExpansions = (raw as CardTraderExpansion[]).filter(
    (expansion) => expansion.game_id === POKEMON_GAME_ID,
  );

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

  const blueprints: CardTraderBlueprint[] = [];
  for (let page = 1; page <= MAX_BLUEPRINT_PAGES; page += 1) {
    const raw = await cardTraderFetch(
      `/blueprints?expansion_id=${expansionId}&page=${page}`,
    );
    if (!Array.isArray(raw) || raw.length === 0) break;

    blueprints.push(...(raw as CardTraderBlueprint[]));
    if (raw.length < 50) break;
  }

  blueprintsCache.set(expansionId, { data: blueprints, fetchedAt: Date.now() });
  return blueprints;
}

function extractImageUrl(blueprint: CardTraderBlueprint): string | null {
  const relativeUrl =
    blueprint.image?.show?.url ??
    blueprint.image?.preview?.url ??
    blueprint.image?.url ??
    null;

  if (!relativeUrl || relativeUrl.includes("fallbacks/card_uploader")) {
    return null;
  }

  return relativeUrl.startsWith("http")
    ? relativeUrl
    : `${CARDTRADER_IMAGE_BASE}${relativeUrl}`;
}

/**
 * Cerca l'immagine di una carta Pokémon su CardTrader a partire da nome e
 * (opzionalmente) set. Richiede un set per essere efficace: senza set,
 * bisognerebbe scandire centinaia di espansioni, troppo lento/costoso.
 */
export async function findCardImageUrl(params: {
  name: string;
  setName?: string | null;
}): Promise<string | null> {
  const { name, setName } = params;
  if (!process.env.CARDTRADER_API_TOKEN) return null;
  if (!name?.trim() || !setName?.trim()) return null;

  const normalizedName = normalize(name);
  const normalizedSet = normalize(setName);
  if (!normalizedName || !normalizedSet) return null;

  try {
    const expansions = await getPokemonExpansions();
    if (expansions.length === 0) return null;

    const scored = expansions
      .map((expansion) => {
        const normalizedExpansionName = normalize(expansion.name);
        let score = -1;
        if (normalizedExpansionName === normalizedSet) score = 3;
        else if (normalizedExpansionName.startsWith(normalizedSet)) score = 2;
        else if (
          normalizedExpansionName.includes(normalizedSet) ||
          normalizedSet.includes(normalizedExpansionName)
        )
          score = 1;
        return { expansion, score };
      })
      .filter((entry) => entry.score >= 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, MAX_EXPANSION_CANDIDATES);

    for (const { expansion } of scored) {
      const blueprints = await getBlueprintsForExpansion(expansion.id);

      const match =
        blueprints.find((bp) => normalize(bp.name) === normalizedName) ??
        blueprints.find((bp) => normalize(bp.name).startsWith(normalizedName));

      if (match) {
        const imageUrl = extractImageUrl(match);
        if (imageUrl) return imageUrl;
      }
    }

    return null;
  } catch {
    return null;
  }
}
