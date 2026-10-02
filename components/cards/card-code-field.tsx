"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CardLookupHit } from "@/lib/card-code";

export function CardCodeField({
  id,
  onFilled,
}: {
  id: string;
  onFilled: (card: CardLookupHit) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fill() {
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Inserisci un codice carta.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/cards/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: trimmed }),
      });
      const data = (await response.json().catch(() => null)) as {
        error?: unknown;
        name?: unknown;
        setName?: unknown;
        setCode?: unknown;
        number?: unknown;
        rarity?: unknown;
        imageUrl?: unknown;
        language?: unknown;
      } | null;

      if (!response.ok || !data || typeof data.name !== "string") {
        setError(
          typeof data?.error === "string" ? data.error : "Ricerca non riuscita.",
        );
        return;
      }

      onFilled({
        name: data.name,
        setName: typeof data.setName === "string" ? data.setName : "",
        setCode: typeof data.setCode === "string" ? data.setCode : "",
        number: typeof data.number === "string" ? data.number : "",
        rarity:
          typeof data.rarity === "string" && data.rarity.trim()
            ? data.rarity
            : null,
        imageUrl:
          typeof data.imageUrl === "string" && data.imageUrl.trim()
            ? data.imageUrl
            : null,
        language: data.language === "JAP" ? "JAP" : undefined,
      });
    } catch {
      setError("Ricerca non riuscita.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>Codice carta</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="es. PAL 193, sv2-193, SV2a-001"
          autoComplete="off"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void fill();
            }
          }}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={() => void fill()}
          disabled={loading}
        >
          {loading ? "Ricerca..." : "Compila"}
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Compila nome, espansione, codice set, numero, rarità e immagine. I
        campi restano modificabili prima del salvataggio. L&apos;espansione è
        in italiano quando TCGdex la conosce, altrimenti resta in inglese. Un
        codice giapponese di qualsiasi era, per esempio SV3-066 o PMCG4-001,
        compila nome carta e espansione in inglese (Ruler of the Black Flame,
        non il nome del set occidentale) e imposta la lingua su Giapponese.
        Condizione, costo, foil e reverse non vengono presi dal codice.
      </p>
      {error && (
        <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
      )}
    </div>
  );
}
