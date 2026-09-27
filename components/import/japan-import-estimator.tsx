"use client";

import { useEffect, useMemo, useState } from "react";
import { Landmark, Package, Plane, Receipt } from "lucide-react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_JPY_PER_EUR,
  DUTY_EXEMPTION_EUR,
  IMPORT_CATEGORIES,
  SHIPPING_PRESETS,
  estimateJapanImport,
  formatEur,
} from "@/lib/japan-import";
import { cn } from "@/lib/utils";

function parseAmount(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

export function JapanImportEstimator() {
  const [goodsJpy, setGoodsJpy] = useState("");
  const [shippingJpy, setShippingJpy] = useState("");
  const [insuranceJpy, setInsuranceJpy] = useState("");
  const [proxyJpy, setProxyJpy] = useState("");
  const [includeProxyInCustoms, setIncludeProxyInCustoms] = useState(false);
  const [jpyPerEur, setJpyPerEur] = useState(String(DEFAULT_JPY_PER_EUR));
  const [fxHint, setFxHint] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof IMPORT_CATEGORIES)[number]["id"]>("cards");
  const [dutyRate, setDutyRate] = useState("2.7");
  const [vatRate, setVatRate] = useState("22");
  const [extraEur, setExtraEur] = useState("0");
  const [shippingPreset, setShippingPreset] = useState("custom");
  const [applyDutyExemption, setApplyDutyExemption] = useState(false);
  const [quantity, setQuantity] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("https://api.frankfurter.app/latest?from=EUR&to=JPY")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { rates?: { JPY?: number }; date?: string } | null) => {
        if (cancelled || !data?.rates?.JPY) return;
        setJpyPerEur(String(Math.round(data.rates.JPY * 100) / 100));
        setFxHint(
          data.date
            ? `Cambio BCE del ${new Date(`${data.date}T00:00:00`).toLocaleDateString("it-IT")}`
            : "Cambio BCE",
        );
      })
      .catch(() => {
        if (!cancelled) setFxHint("Cambio BCE non disponibile: usa il valore indicativo.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const selectedCategory = IMPORT_CATEGORIES.find((item) => item.id === category);

  const result = useMemo(
    () =>
      estimateJapanImport({
        goodsJpy: parseAmount(goodsJpy),
        shippingJpy: parseAmount(shippingJpy),
        insuranceJpy: parseAmount(insuranceJpy),
        proxyJpy: parseAmount(proxyJpy),
        includeProxyInCustoms,
        jpyPerEur: parseAmount(jpyPerEur) || DEFAULT_JPY_PER_EUR,
        dutyRatePct: parseAmount(dutyRate),
        vatRatePct: parseAmount(vatRate),
        extraEur: parseAmount(extraEur),
        applyDutyExemptionUnder150: applyDutyExemption,
        quantity: parseAmount(quantity),
      }),
    [
      goodsJpy,
      shippingJpy,
      insuranceJpy,
      proxyJpy,
      includeProxyInCustoms,
      jpyPerEur,
      dutyRate,
      vatRate,
      extraEur,
      applyDutyExemption,
      quantity,
    ],
  );

  function applyPreset(id: string) {
    setShippingPreset(id);
    const preset = SHIPPING_PRESETS.find((item) => item.id === id);
    if (!preset || preset.id === "custom") return;
    setShippingJpy(preset.shippingJpy);
    setExtraEur(preset.extraEur);
    if (preset.id === "proxy") {
      const goods = parseAmount(goodsJpy);
      setProxyJpy(goods > 0 ? String(Math.round(goods * 0.05)) : "1500");
    }
  }

  function applyCategory(id: string) {
    const next = IMPORT_CATEGORIES.find((item) => item.id === id);
    if (!next) return;
    setCategory(next.id);
    if (next.dutyPct != null) setDutyRate(String(next.dutyPct));
  }

  const rows = [
    { label: "Merce", value: result.goodsEur },
    { label: "Spedizione", value: result.shippingEur },
    { label: "Assicurazione", value: result.insuranceEur },
    { label: "Commissione proxy", value: result.proxyEur },
    { label: "Valore in dogana (CIF)", value: result.customsValue, emphasis: true },
    {
      label: result.dutyExempt
        ? `Dazio (esente sotto ${DUTY_EXEMPTION_EUR} €)`
        : "Dazio doganale",
      value: result.duty,
    },
    { label: "Spese corriere / svincolo", value: result.extraEur },
    { label: "IVA all’importazione", value: result.vat },
  ];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      <Card className="lg:col-span-3">
        <CardHeader>
          <CardTitle>Dati dell’acquisto</CardTitle>
          <CardDescription>
            Importi giapponesi in yen. Il totale è il costo sbarcato in Italia
            (merce + spedizione + dazi + IVA + extra).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="goods">Valore merce (¥)</Label>
              <Input
                id="goods"
                type="number"
                min="0"
                step="1"
                placeholder="es. 45000"
                value={goodsJpy}
                onChange={(event) => setGoodsJpy(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="qty">Pezzi (opzionale)</Label>
              <Input
                id="qty"
                type="number"
                min="0"
                step="1"
                placeholder="es. 20"
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Spedizione (stima)</Label>
            <Select value={shippingPreset} onValueChange={applyPreset}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SHIPPING_PRESETS.map((preset) => (
                  <SelectItem key={preset.id} value={preset.id}>
                    {preset.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="shipping">Spedizione internazionale (¥)</Label>
              <Input
                id="shipping"
                type="number"
                min="0"
                step="1"
                value={shippingJpy}
                onChange={(event) => setShippingJpy(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="insurance">Assicurazione (¥)</Label>
              <Input
                id="insurance"
                type="number"
                min="0"
                step="1"
                value={insuranceJpy}
                onChange={(event) => setInsuranceJpy(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proxy">Commissione proxy / servizio (¥)</Label>
              <Input
                id="proxy"
                type="number"
                min="0"
                step="1"
                value={proxyJpy}
                onChange={(event) => setProxyJpy(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="extra">Svincolo / diritti corriere (€)</Label>
              <Input
                id="extra"
                type="number"
                min="0"
                step="0.01"
                value={extraEur}
                onChange={(event) => setExtraEur(event.target.value)}
              />
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={includeProxyInCustoms}
              onCheckedChange={(value) => setIncludeProxyInCustoms(value === true)}
              className="mt-0.5"
            />
            <span>Includi la commissione proxy nel valore in dogana</span>
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label>Categoria merce / dazio</Label>
              <Select value={category} onValueChange={applyCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORT_CATEGORIES.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.label}
                      {item.dutyPct != null ? ` · ${item.dutyPct}%` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {selectedCategory?.id === "cards"
                  ? "Le carte Pokémon sono di solito classificate come playing cards. L’ufficio doganale può scegliere un codice diverso."
                  : "Le aliquote TARIC cambiano: verifica sul sito Agenzia delle Dogane se l’importo è alto."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="duty">Aliquota dazio (%)</Label>
              <Input
                id="duty"
                type="number"
                min="0"
                step="0.1"
                value={dutyRate}
                onChange={(event) => setDutyRate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="vat">IVA Italia (%)</Label>
              <Input
                id="vat"
                type="number"
                min="0"
                step="0.1"
                value={vatRate}
                onChange={(event) => setVatRate(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="fx">Cambio ¥ per 1 €</Label>
              <Input
                id="fx"
                type="number"
                min="1"
                step="0.01"
                value={jpyPerEur}
                onChange={(event) => setJpyPerEur(event.target.value)}
              />
              {fxHint && <p className="text-xs text-muted-foreground">{fxHint}</p>}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm">
            <Checkbox
              checked={applyDutyExemption}
              onCheckedChange={(value) => setApplyDutyExemption(value === true)}
              className="mt-0.5"
            />
            <span>
              Dazio a 0 se il valore in dogana è ≤ {DUTY_EXEMPTION_EUR} € (esenzione UE
              tipica B2C; sui lotti commerciali spesso non si applica)
            </span>
          </label>
        </CardContent>
      </Card>

      <div className="space-y-4 lg:col-span-2">
        <div className="grid grid-cols-1 gap-3">
          <KpiCard
            label="Costo sbarcato"
            value={formatEur(result.total)}
            accent="magenta"
            icon={Package}
            hint="Quanto ti costa tutto compreso"
          />
          <KpiCard
            label="Dazi + IVA + svincolo"
            value={formatEur(result.importCharges)}
            accent="gold"
            icon={Landmark}
            hint="Soldi da pagare in più rispetto a merce e nolo"
          />
          <KpiCard
            label="IVA"
            value={formatEur(result.vat)}
            accent="violet"
            icon={Receipt}
            hint={`Base ${formatEur(result.vatBase)}`}
          />
          <KpiCard
            label={result.perUnit != null ? "Costo a pezzo" : "Spedizione"}
            value={
              result.perUnit != null
                ? formatEur(result.perUnit)
                : formatEur(result.shippingEur)
            }
            accent="emerald"
            icon={Plane}
            hint={
              result.perUnit != null
                ? "Totale diviso i pezzi inseriti"
                : "Solo nolo internazionale"
            }
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Riparto</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/60 text-sm">
              {rows.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 py-2"
                >
                  <span
                    className={cn(
                      "text-muted-foreground",
                      row.emphasis && "font-medium text-foreground",
                    )}
                  >
                    {row.label}
                  </span>
                  <span className="font-medium tabular-nums text-foreground">
                    {formatEur(row.value)}
                  </span>
                </li>
              ))}
              <li className="flex items-center justify-between gap-3 py-2">
                <span className="font-semibold text-foreground">Totale</span>
                <span className="font-semibold tabular-nums text-foreground">
                  {formatEur(result.total)}
                </span>
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">
              Stima operativa, non un parere doganale. IVA = (valore in dogana +
              dazio + svincolo) × aliquota. Il corriere può aggiungere IVA sul
              proprio diritto di svincolo.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
