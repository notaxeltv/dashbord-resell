"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

function calcIrpef(reddito: number) {
  if (reddito <= 0) return 0;
  if (reddito <= 28_000) return reddito * 0.23;
  if (reddito <= 50_000) return 28_000 * 0.23 + (reddito - 28_000) * 0.35;
  return 28_000 * 0.23 + (50_000 - 28_000) * 0.35 + (reddito - 50_000) * 0.43;
}

export function TaxEstimator({
  totalRevenue,
  netProfit,
}: {
  totalRevenue: number;
  netProfit: number;
}) {
  const [regime, setRegime] = useState<"forfettario" | "ordinario">("forfettario");
  const [coefficiente, setCoefficiente] = useState("40");
  const [aliquota, setAliquota] = useState("5");
  const [includeInps, setIncludeInps] = useState(true);
  const [aliquotaInps, setAliquotaInps] = useState("24");

  const forfettario = useMemo(() => {
    const redditoImponibile =
      Math.max(0, totalRevenue) * (Number(coefficiente || 0) / 100);
    const imposta = redditoImponibile * (Number(aliquota || 0) / 100);
    const inps = includeInps
      ? redditoImponibile * (Number(aliquotaInps || 0) / 100)
      : 0;
    return { redditoImponibile, imposta, inps, totale: imposta + inps };
  }, [totalRevenue, coefficiente, aliquota, includeInps, aliquotaInps]);

  const ordinario = useMemo(() => {
    const redditoImponibile = Math.max(0, netProfit);
    const irpef = calcIrpef(redditoImponibile);
    const addizionali = redditoImponibile * 0.02;
    return { redditoImponibile, irpef, addizionali, totale: irpef + addizionali };
  }, [netProfit]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={regime === "forfettario" ? "default" : "outline"}
          onClick={() => setRegime("forfettario")}
        >
          Regime forfettario
        </Button>
        <Button
          type="button"
          size="sm"
          variant={regime === "ordinario" ? "default" : "outline"}
          onClick={() => setRegime("ordinario")}
        >
          Regime ordinario (semplificato)
        </Button>
      </div>

      {regime === "forfettario" ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="coeff">Coefficiente di redditività (%)</Label>
              <Input
                id="coeff"
                type="number"
                min="0"
                max="100"
                value={coefficiente}
                onChange={(event) => setCoefficiente(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                40% è il coefficiente standard per il commercio al dettaglio
                (verifica il codice ATECO corretto per la tua attività).
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aliq">Aliquota imposta sostitutiva (%)</Label>
              <Input
                id="aliq"
                type="number"
                min="0"
                max="100"
                value={aliquota}
                onChange={(event) => setAliquota(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                5% nei primi 5 anni di attività (se hai i requisiti
                start-up), altrimenti 15%.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Checkbox
              id="inps"
              checked={includeInps}
              onCheckedChange={(value) => setIncludeInps(value === true)}
            />
            <Label htmlFor="inps" className="cursor-pointer">
              Includi stima contributi INPS
            </Label>
            {includeInps && (
              <>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={aliquotaInps}
                  onChange={(event) => setAliquotaInps(event.target.value)}
                  className="h-8 w-20"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/60 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Ricavi totali</p>
              <p className="text-lg font-semibold text-foreground">
                €{totalRevenue.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Reddito imponibile</p>
              <p className="text-lg font-semibold text-foreground">
                €{forfettario.redditoImponibile.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Imposta sostitutiva</p>
              <p className="text-lg font-semibold text-amber-600">
                €{forfettario.imposta.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Contributi INPS stimati
              </p>
              <p className="text-lg font-semibold text-amber-600">
                €{forfettario.inps.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="rounded-lg bg-fuchsia-500/10 p-4">
            <p className="text-sm text-muted-foreground">
              Totale stimato da accantonare
            </p>
            <p className="text-2xl font-bold text-foreground">
              €{forfettario.totale.toFixed(2)}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4 rounded-lg border border-border/60 p-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-muted-foreground">Utile netto (anno)</p>
              <p className="text-lg font-semibold text-foreground">
                €{Math.max(0, netProfit).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                IRPEF stimata (scaglioni)
              </p>
              <p className="text-lg font-semibold text-amber-600">
                €{ordinario.irpef.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">
                Addizionali reg./com. (stima 2%)
              </p>
              <p className="text-lg font-semibold text-amber-600">
                €{ordinario.addizionali.toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Totale stimato</p>
              <p className="text-lg font-semibold text-foreground">
                €{ordinario.totale.toFixed(2)}
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Scaglioni IRPEF applicati: 23% fino a €28.000, 35% da €28.001 a
            €50.000, 43% oltre €50.000. Non tiene conto di deduzioni,
            detrazioni personali o contributi INPS (gestione
            artigiani/commercianti o separata).
          </p>
        </div>
      )}

      <p className="rounded-md bg-amber-50 p-3 text-xs text-amber-800">
        ⚠️ Questa è una <strong>stima indicativa</strong> a scopo di
        pianificazione, calcolata solo sui dati inseriti in questa app. Non
        sostituisce la consulenza di un commercialista e non tiene conto di
        altre entrate, deduzioni, detrazioni o specificità del tuo regime
        fiscale reale.
      </p>
    </div>
  );
}
