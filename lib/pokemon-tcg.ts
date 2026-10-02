import { parseCardCode, type CardLookupHit } from "./card-code";
import { italianExpansionName } from "./tcgdex-sets";

export type { CardLookupHit };

const API_BASE = "https://api.pokemontcg.io/v2";
const IMAGE_HOST = "images.pokemontcg.io";
const SETS_TTL_MS = 6 * 60 * 60 * 1000;

export type CardLookupFailure = {
  ok: false;
  status: number;
  error: string;
};

export type CardLookupOutcome =
  | { ok: true; card: CardLookupHit }
  | CardLookupFailure;

type TcgSet = {
  id?: string;
  name?: string;
  ptcgoCode?: string;
};

type TcgCard = {
  name?: string;
  number?: string;
  rarity?: string;
  images?: { small?: string; large?: string };
  set?: TcgSet;
};

type SetInfo = {
  id: string;
  name: string;
  ptcgoCode: string | null;
};

type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

type SetsCache = {
  fetchedAt: number;
  sets: SetInfo[];
};

let setsCache: SetsCache | null = null;

function numberVariants(number: string): string[] {
  const variants: string[] = [];
  const add = (value: string) => {
    if (value && !variants.includes(value)) variants.push(value);
  };
  add(number);
  add(number.replace(/^0+(?=\d)/, ""));
  if (/^\d+$/.test(number) && number.length < 3) {
    add(number.padStart(3, "0"));
  }
  return variants;
}

function quoteTerm(value: string): string {
  return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function httpsImage(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && url.hostname === IMAGE_HOST) {
      return url.toString();
    }
  } catch {
    return null;
  }
  return null;
}

export function mapTcgCard(card: TcgCard): CardLookupHit | null {
  const name = card.name?.trim() ?? "";
  const setName = card.set?.name?.trim() ?? "";
  const number = card.number?.trim() ?? "";
  if (!name || !setName || !number) return null;
  const setCode = (card.set?.ptcgoCode || card.set?.id || "").trim();
  return {
    name,
    setName,
    setCode,
    number,
    rarity: card.rarity?.trim() || null,
    imageUrl: httpsImage(card.images?.large) ?? httpsImage(card.images?.small),
  };
}

function withSetCode(card: CardLookupHit, setInfo: SetInfo | null): CardLookupHit {
  if (setInfo?.ptcgoCode) card.setCode = setInfo.ptcgoCode;
  else if (!card.setCode && setInfo?.id) card.setCode = setInfo.id;
  if (!card.setName && setInfo?.name) card.setName = setInfo.name;
  return card;
}

function pickCard(
  cards: TcgCard[],
  setId: string,
  ptcgoCode: string | null,
  number: string,
): TcgCard | null {
  const num = number.toLowerCase();
  const id = setId.toLowerCase();
  const code = ptcgoCode?.toUpperCase() ?? "";
  const exactNumber = cards.filter(
    (card) => (card.number ?? "").trim().toLowerCase() === num,
  );
  return (
    exactNumber.find((card) => {
      const cardSetId = (card.set?.id ?? "").toLowerCase();
      const cardCode = (card.set?.ptcgoCode ?? "").toUpperCase();
      return cardSetId === id || (code !== "" && cardCode === code);
    }) ??
    (exactNumber.length === 1 ? exactNumber[0] : null)
  );
}

function apiHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "User-Agent": "pokemon-app/card-lookup",
  };
  const key = process.env.POKEMONTCG_API_KEY?.trim();
  if (key) headers["X-Api-Key"] = key;
  return headers;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type HttpResult =
  | { kind: "ok"; body: unknown }
  | { kind: "miss" }
  | { kind: "down" };

async function requestJson(fetcher: FetchLike, url: string): Promise<HttpResult> {
  let response: Response;
  try {
    response = await fetcher(url, {
      headers: apiHeaders(),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    return { kind: "down" };
  }

  if (response.status === 404) return { kind: "miss" };
  if (!response.ok) return { kind: "down" };

  const body = await readJson(response);
  if (!body || typeof body !== "object") return { kind: "miss" };
  return { kind: "ok", body };
}

async function requestJsonRetry(
  fetcher: FetchLike,
  url: string,
): Promise<HttpResult> {
  let last: HttpResult = { kind: "down" };
  for (let attempt = 0; attempt < 3; attempt += 1) {
    last = await requestJson(fetcher, url);
    if (last.kind !== "down") return last;
    if (attempt < 2) await wait(200 * (attempt + 1));
  }
  return last;
}

function readSets(body: unknown): { sets: SetInfo[]; totalCount: number } | null {
  if (!body || typeof body !== "object") return null;
  const record = body as { data?: unknown; totalCount?: unknown };
  if (!Array.isArray(record.data)) return null;
  const sets: SetInfo[] = [];
  for (const row of record.data) {
    if (!row || typeof row !== "object") continue;
    const item = row as { id?: unknown; name?: unknown; ptcgoCode?: unknown };
    const id = typeof item.id === "string" ? item.id.trim() : "";
    const name = typeof item.name === "string" ? item.name.trim() : "";
    if (!id || !name) continue;
    const ptcgoCode =
      typeof item.ptcgoCode === "string" && item.ptcgoCode.trim()
        ? item.ptcgoCode.trim()
        : null;
    sets.push({ id, name, ptcgoCode });
  }
  const totalCount =
    typeof record.totalCount === "number" ? record.totalCount : sets.length;
  return { sets, totalCount };
}

async function loadSets(fetcher: FetchLike): Promise<SetInfo[] | "down"> {
  const sets: SetInfo[] = [];
  let totalCount = Number.POSITIVE_INFINITY;

  for (let page = 1; page <= 5 && sets.length < totalCount; page += 1) {
    const params = new URLSearchParams({
      page: String(page),
      pageSize: "250",
      select: "id,name,ptcgoCode",
    });
    const result = await requestJsonRetry(
      fetcher,
      `${API_BASE}/sets?${params.toString()}`,
    );
    if (result.kind === "down") return sets.length > 0 ? sets : "down";
    if (result.kind === "miss") break;
    const pageSets = readSets(result.body);
    if (!pageSets || pageSets.sets.length === 0) break;
    totalCount = pageSets.totalCount;
    sets.push(...pageSets.sets);
  }

  return sets.length > 0 ? sets : "down";
}

async function getSets(fetcher: FetchLike): Promise<SetInfo[] | "down"> {
  const now = Date.now();
  if (
    fetcher === fetch &&
    setsCache &&
    now - setsCache.fetchedAt < SETS_TTL_MS
  ) {
    return setsCache.sets;
  }

  const loaded = await loadSets(fetcher);
  if (loaded !== "down" && fetcher === fetch) {
    setsCache = { fetchedAt: now, sets: loaded };
  }
  return loaded;
}

function resolveSet(sets: SetInfo[], token: string): SetInfo | null {
  const byId = sets.find((set) => set.id.toLowerCase() === token.toLowerCase());
  const byCode = sets.find(
    (set) => (set.ptcgoCode ?? "").toUpperCase() === token.toUpperCase(),
  );
  if (/^[A-Za-z]+$/.test(token)) return byCode ?? byId ?? null;
  return byId ?? byCode ?? null;
}

function readCards(body: unknown): TcgCard[] | null {
  if (!body || typeof body !== "object") return null;
  const data = (body as { data?: unknown }).data;
  if (!Array.isArray(data)) return null;
  return data as TcgCard[];
}

async function searchCards(
  fetcher: FetchLike,
  query: string,
): Promise<TcgCard[] | "miss" | "down"> {
  const params = new URLSearchParams({ q: query, pageSize: "5" });
  const result = await requestJsonRetry(
    fetcher,
    `${API_BASE}/cards?${params.toString()}`,
  );
  if (result.kind !== "ok") return result.kind;
  const cards = readCards(result.body);
  if (!cards || cards.length === 0) return "miss";
  return cards;
}

async function getCardById(
  fetcher: FetchLike,
  id: string,
): Promise<TcgCard | "miss" | "down"> {
  if (!/^[a-z0-9-]+$/.test(id)) return "miss";
  const result = await requestJsonRetry(fetcher, `${API_BASE}/cards/${id}`);
  if (result.kind !== "ok") return result.kind;
  const data = (result.body as { data?: unknown }).data;
  if (!data || typeof data !== "object") return "miss";
  return data as TcgCard;
}

function failureFor(kind: "not_found" | "down"): CardLookupFailure {
  if (kind === "down") {
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

/**
 * Cerca una carta sull'API pubblica pokemontcg.io a partire dal codice.
 * Non restituisce condizione, costo, foil o reverse: quelli restano in form.
 */
export async function lookupCardFromCode(
  rawCode: string,
  fetcher: FetchLike = fetch,
): Promise<CardLookupOutcome> {
  const parsed = parseCardCode(rawCode);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      error: "Codice non riconosciuto. Esempi: PAL 193, sv2-193, TRR-15.",
    };
  }

  const setToken = parsed.setToken;
  const variants = numberVariants(parsed.number);
  let sawDown = false;
  let sawMiss = false;

  const sets = await getSets(fetcher);
  if (sets === "down") sawDown = true;
  const setInfo = sets === "down" ? null : resolveSet(sets, setToken);

  async function fromCards(
    cards: TcgCard[] | "miss" | "down",
    number: string,
    info: SetInfo | null,
  ): Promise<CardLookupHit | null> {
    if (cards === "down") {
      sawDown = true;
      return null;
    }
    if (cards === "miss") {
      sawMiss = true;
      return null;
    }
    const picked = pickCard(
      cards,
      info?.id ?? setToken,
      info?.ptcgoCode ?? null,
      number,
    );
    if (!picked) {
      sawMiss = true;
      return null;
    }
    const mapped = mapTcgCard(picked);
    if (!mapped) {
      sawMiss = true;
      return null;
    }
    const named = withSetCode(mapped, info);
    const italian = await italianExpansionName(
      {
        setId: info?.id || picked.set?.id || "",
        englishName: named.setName,
        setCode: named.setCode,
      },
      fetcher,
    );
    if (italian) named.setName = italian;
    return named;
  }

  if (setInfo) {
    for (const number of variants) {
      const cards = await searchCards(
        fetcher,
        `set.id:${quoteTerm(setInfo.id)} number:${quoteTerm(number)}`,
      );
      const hit = await fromCards(cards, number, setInfo);
      if (hit) return { ok: true, card: hit };
    }
  } else {
    for (const number of variants) {
      const queries = [
        `set.id:${quoteTerm(setToken)} number:${quoteTerm(number)}`,
        `set.ptcgoCode:${quoteTerm(setToken.toUpperCase())} number:${quoteTerm(number)}`,
      ];
      for (const query of queries) {
        const cards = await searchCards(fetcher, query);
        const hit = await fromCards(cards, number, null);
        if (hit) return { ok: true, card: hit };
      }

      const direct = await getCardById(
        fetcher,
        `${setToken}-${number}`.toLowerCase(),
      );
      if (direct === "down" || direct === "miss") {
        const hit = await fromCards(direct, number, null);
        if (hit) return { ok: true, card: hit };
        continue;
      }
      const hit = await fromCards([direct], number, null);
      if (hit) return { ok: true, card: hit };
    }
  }

  if (sawMiss) return failureFor("not_found");
  if (sawDown) return failureFor("down");
  return failureFor("not_found");
}
