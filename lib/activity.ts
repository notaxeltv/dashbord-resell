import type { Profile } from "@/lib/types";

export const ACTIVITY_ACTION_LABELS: Record<string, string> = {
  insert: "Creato",
  update: "Modificato",
  delete: "Eliminato",
  login: "Accesso",
};

export const ACTIVITY_ENTITY_LABELS: Record<string, string> = {
  card: "Carta",
  purchase: "Lotto",
  sale: "Vendita",
  transaction: "Extra",
  session: "Sessione",
  invoice: "Fattura",
  purchase_receipt: "Ricevuta",
};

export function actorLabel(profile: Profile | undefined | null): string {
  if (!profile) return "Utente";
  return profile.display_name?.trim() || profile.email.split("@")[0] || "Utente";
}
