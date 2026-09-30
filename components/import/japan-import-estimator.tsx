"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Landmark, Package, Percent, TrendingUp } from "lucide-react";

import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";
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
  formatJpy,
} from "@/lib/japan-import";
import { cn } from "@/lib/utils";

type MoneyCurrency = "JPY" | "EUR";

function parseAmount(value: string) {
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : 0;
}

function toJpy(amount: string, currency: MoneyCurrency, fx: number) {
  const n = parseAmount(amount);
  return currency === "EUR" ? n * fx : n;
}

function convertAmount(
  amount: string,
  from: MoneyCurrency,
  to: MoneyCurrency,
  fx: number,
) {
  if (from === to) return amount;
  const n = parseAmount(amount);
  if (n <= 0 || fx <= 0) return amount;
  if (to === "EUR") return String(Math.round((n / fx) * 100) / 100);
  return String(Math.round(n * fx));
}

function fromJpy(jpy: number, currency: MoneyCurrency, fx: number) {
  if (jpy <= 0) return "";
  if (currency === "EUR") {
    if (fx <= 0) return "";
    return String(Math.round((jpy / fx) * 100) / 100);
  }
  return String(Math.round(jpy));
}

function MoneyField({
  id,
  label,
  amount,
  currency,
  fx,
  placeholderJpy,
  placeholderEur,
  onAmountChange,
}: {
  id: string;
  label: string;
  amount: string;
  currency: MoneyCurrency;
  fx: number;
  placeholderJpy: string;
  placeholderEur: string;
  onAmountChange: (value: string) => void;
}) {
  const jpy = toJpy(amount, currency, fx);
  const eur = fx > 0 ? jpy / fx : 0;

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="number"
        min="0"
        step={currency === "EUR" ? "0.01" : "1"}
        placeholder={currency === "EUR" ? placeholderEur : placeholderJpy}
        value={amount}
        onChange={(event) => onAmountChange(event.target.value)}
      />
      {parseAmount(amount) > 0 && (
        <p className="text-xs text-muted-foreground">
          {currency === "EUR"
            ? `≈ ${formatJpy(jpy)}`
            : `≈ ${formatEur(eur)}`}
        </p>
      )}
    </div>
  );
}

export function JapanImportEstimator() {
  const router = useRouter();
  const [currency, setCurrency] = useState<MoneyCurrency>("JPY");
  const [goodsAmount, setGoodsAmount] = useState("");
  const [shippingAmount, setShippingAmount] = useState("");
  const [insuranceAmount, setInsuranceAmount] = useState("");
  const [proxyAmount, setProxyAmount] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [includeProxyInCustoms, setIncludeProxyInCustoms] = useState(false);
  const [jpyPerEur, setJpyPerEur] = useState(String(DEFAULT_JPY_PER_EUR));
  const [fxHint, setFxHint] = useState<string | null>(null);
  const [category, setCategory] = useState<(typeof IMPORT_CATEGORIES)[number]["id"]>("cards");
  const [dutyRate, setDutyRate] = useState("2.7");
  const [vatRate, setVatRate] = useState("22");
  const [shippingPreset, setShippingPreset] = useState("custom");
  const [applyDutyExemption, setApplyDutyExemption] = useState(false);
  const [quantity, setQuantity] = useState("");
  const [markupPct, setMarkupPct] = useState("40");

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
  const fx = parseAmount(jpyPerEur) || DEFAULT_JPY_PER_EUR;
  const goodsJpy = toJpy(goodsAmount, currency, fx);
  const shippingJpy = toJpy(shippingAmount, currency, fx);
  const insuranceJpy = toJpy(insuranceAmount, currency, fx);
  const proxyJpy = toJpy(proxyAmount, currency, fx);
  const extraEur = fx > 0 ? toJpy(extraAmount, currency, fx) / fx : 0;

  const result = useMemo(
    () =>
      estimateJapanImport({
        goodsJpy,
        shippingJpy,
        insuranceJpy,
        proxyJpy,
        includeProxyInCustoms,
        jpyPerEur: fx,
        dutyRatePct: parseAmount(dutyRate),
        vatRatePct: parseAmount(vatRate),
        extraEur,
        applyDutyExemptionUnder150: applyDutyExemption,
        quantity: parseAmount(quantity),
        markupPct: parseAmount(markupPct),
      }),
    [
      goodsJpy,
      shippingJpy,
      insuranceJpy,
      proxyJpy,
      includeProxyInCustoms,
      fx,
      dutyRate,
      vatRate,
      extraEur,
      applyDutyExemption,
      quantity,
      markupPct,
    ],
  );

  function switchCurrency(next: MoneyCurrency) {
    if (next === currency) return;
    setGoodsAmount(convertAmount(goodsAmount, currency, next, fx));
    setShippingAmount(convertAmount(shippingAmount, currency, next, fx));
    setInsuranceAmount(convertAmount(insuranceAmount, currency, next, fx));
    setProxyAmount(convertAmount(proxyAmount, currency, next, fx));
    setExtraAmount(convertAmount(extraAmount, currency, next, fx));
    setCurrency(next);
  }

  function money(eurValue: number) {
    return currency === "JPY" ? formatJpy(eurValue * fx) : formatEur(eurValue);
  }

  function applyPreset(id: string) {
    setShippingPreset(id);
    const preset = SHIPPING_PRESETS.find((item) => item.id === id);
    if (!preset || preset.id === "custom") return;
    setShippingAmount(fromJpy(parseAmount(preset.shippingJpy), currency, fx));
    const extraEurValue = parseAmount(preset.extraEur);
    setExtraAmount(
      extraEurValue > 0 ? fromJpy(extraEurValue * fx, currency, fx) : "",
    );
    if (preset.id === "proxy") {
      const feeJpy = goodsJpy > 0 ? goodsJpy * 0.05 : 1500;
      setProxyAmount(fromJpy(feeJpy, currency, fx));
    }
  }

  function applyCategory(id: string) {
    const next = IMPORT_CATEGORIES.find((item) => item.id === id);
    if (!next) return;
    setCategory(next.id);
    if (next.dutyPct != null) setDutyRate(String(next.dutyPct));
  }

  function applyEstimateToNewLot() {
    const params = new URLSearchParams({
      prefillTotal: Math.max(0, result.total - result.shippingEur).toFixed(2),
      prefillShipping: result.shippingEur.toFixed(2),
      prefillSource: "altro",
      prefillNotes: `Import Giappone: merce ${formatEur(result.goodsEur)} · dazio+IVA+svincolo ${formatEur(result.importCharges)}${result.proxyEur > 0 ? ` · proxy ${formatEur(result.proxyEur)}` : ""}`,
    });
    router.push(`/dashboard/purchases?${params.toString()}`);
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
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Un solo cambio per tutta la pagina: i campi e i totali usano{" "}
          {currency === "JPY" ? "yen" : "euro"}.
        </p>
        <div className="flex">
          <Button
            type="button"
            variant={currency === "JPY" ? "default" : "outline"}
            className="rounded-r-none"
            onClick={() => switchCurrency("JPY")}
          >
            ¥ Yen
          </Button>
          <Button
            type="button"
            variant={currency === "EUR" ? "default" : "outline"}
            className="rounded-l-none"
            onClick={() => switchCurrency("EUR")}
          >
            € Euro
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Dati dell’acquisto</CardTitle>
            <CardDescription>
              Inserisci gli importi nella valuta scelta sopra. Il cambio BCE è
              modificabile.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <MoneyField
                id="goods"
                label="Valore merce"
                amount={goodsAmount}
                currency={currency}
                fx={fx}
                placeholderJpy="es. 45000"
                placeholderEur="es. 250"
                onAmountChange={setGoodsAmount}
              />
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
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="markup">Ricarico sulla vendita (%)</Label>
                <Input
                  id="markup"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="es. 40"
                  value={markupPct}
                  onChange={(event) => setMarkupPct(event.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Prezzo di vendita = costo sbarcato × (1 + ricarico). Il guadagno
                  è la differenza. Il margine sul prezzo è calcolato in automatico.
                </p>
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
              <MoneyField
                id="shipping"
                label="Spedizione internazionale"
                amount={shippingAmount}
                currency={currency}
                fx={fx}
                placeholderJpy="es. 2800"
                placeholderEur="es. 16"
                onAmountChange={setShippingAmount}
              />
              <MoneyField
                id="insurance"
                label="Assicurazione"
                amount={insuranceAmount}
                currency={currency}
                fx={fx}
                placeholderJpy="es. 500"
                placeholderEur="es. 3"
                onAmountChange={setInsuranceAmount}
              />
              <MoneyField
                id="proxy"
                label="Commissione proxy / servizio"
                amount={proxyAmount}
                currency={currency}
                fx={fx}
                placeholderJpy="es. 1500"
                placeholderEur="es. 9"
                onAmountChange={setProxyAmount}
              />
              <MoneyField
                id="extra"
                label="Svincolo / diritti corriere"
                amount={extraAmount}
                currency={currency}
                fx={fx}
                placeholderJpy="es. 2500"
                placeholderEur="es. 15"
                onAmountChange={setExtraAmount}
              />
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
              value={money(result.total)}
              accent="magenta"
              icon={Package}
              hint="Quanto ti costa tutto compreso"
            />
            <KpiCard
              label="Prezzo di vendita"
              value={money(result.sellingPrice)}
              accent="gold"
              icon={Percent}
              hint={`Ricarico ${result.markupPct.toLocaleString("it-IT")}% sul costo`}
            />
            <KpiCard
              label="Guadagno"
              value={money(result.profit)}
              accent="emerald"
              icon={TrendingUp}
              hint={`Margine sul prezzo ${result.marginPct.toFixed(1)}%`}
            />
            <KpiCard
              label={result.perUnit != null ? "A pezzo" : "Dazi + IVA + svincolo"}
              value={
                result.sellingPerUnit != null
                  ? money(result.sellingPerUnit)
                  : money(result.importCharges)
              }
              accent="violet"
              icon={Landmark}
              hint={
                result.profitPerUnit != null
                  ? `Costo ${money(result.perUnit ?? 0)} · guadagno ${money(result.profitPerUnit)}`
                  : "Soldi da pagare in più rispetto a merce e nolo"
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
                      {money(row.value)}
                    </span>
                  </li>
                ))}
                <li className="flex items-center justify-between gap-3 py-2">
                  <span className="font-semibold text-foreground">Costo sbarcato</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {money(result.total)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 py-2">
                  <span className="text-muted-foreground">Prezzo di vendita</span>
                  <span className="font-medium tabular-nums text-foreground">
                    {money(result.sellingPrice)}
                  </span>
                </li>
                <li className="flex items-center justify-between gap-3 py-2">
                  <span className="font-semibold text-foreground">Guadagno</span>
                  <span className="font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                    {money(result.profit)}
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                Stima operativa, non un parere doganale. IVA = (valore in dogana +
                dazio + svincolo) × aliquota. Il corriere può aggiungere IVA sul
                proprio diritto di svincolo.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 w-full"
                disabled={result.total <= 0}
                onClick={applyEstimateToNewLot}
              >
                Usa questa stima per un nuovo lotto →
              </Button>
              <p className="mt-2 text-xs text-muted-foreground">
                Apre &quot;Nuovo lotto&quot; in Lotti con totale e spedizione
                già precompilati.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
