/**
 * Nomi italiani per i set che il catalogo italiano di TCGdex non ha.
 * La chiave è il codice set (TRR, G1, LC, …) oppure l'id del set (ex7).
 * Se la chiave c'è, questo nome sostituisce sia TCGdex sia l'inglese.
 *
 * Set senza nome italiano su TCGdex, da compilare qui se servono:
 * B2 Base Set 2, G1 Gym Heroes, G2 Gym Challenge, LC Legendary Collection,
 * TRR Team Rocket Returns, PK Power Keepers, SV Supreme Victors,
 * LTR Legendary Treasures, DCR Double Crisis, BP Best of Game,
 * FUT20 Pokémon Futsal Collection.
 */
export const MANUAL_SET_NAMES_IT: Record<string, string> = {};

export function manualItalianSetName(
  setCode: string,
  setId: string,
): string | null {
  const byCode = MANUAL_SET_NAMES_IT[setCode.trim().toUpperCase()];
  const byId = MANUAL_SET_NAMES_IT[setId.trim()];
  const value = (byCode || byId || "").trim();
  return value || null;
}
