const CARDTRADER_HOST = /(^|\.)cardtrader\.com$/i;

export function isCardTraderImageUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && CARDTRADER_HOST.test(parsed.hostname);
  } catch {
    return false;
  }
}

/** URL da usare nel browser: le immagini CardTrader passano dal proxy autenticato. */
export function cardImageSrc(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  if (isCardTraderImageUrl(imageUrl)) {
    return `/api/images/proxy?url=${encodeURIComponent(imageUrl)}`;
  }
  return imageUrl;
}
