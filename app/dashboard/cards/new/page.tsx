"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { notify, formatNewCardMessage } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  CARD_CONDITIONS,
  CARD_CONDITION_LABELS,
  CARD_LANGUAGES,
  CARD_STATUSES_EDITABLE,
  PURCHASE_SOURCES,
  SELECT_NONE,
} from "@/lib/constants";
import { formatISODate } from "@/lib/dates";
import type { PurchaseOption } from "@/lib/types";

export default function NewCardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [setName_, setSetName] = useState("");
  const [setCode, setSetCode] = useState("");
  const [number, setNumber] = useState("");
  const [language, setLanguage] = useState("ITA");
  const [condition, setCondition] = useState("NM");
  const [isFoil, setIsFoil] = useState(false);
  const [isJapanese, setIsJapanese] = useState(false);
  const [purchasePrice, setPurchasePrice] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseSource, setPurchaseSource] = useState(SELECT_NONE);
  const [purchaseId, setPurchaseId] = useState(SELECT_NONE);
  const [targetPrice, setTargetPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [status, setStatus] = useState("in_stock");
  const [notes, setNotes] = useState("");
  const [purchases, setPurchases] = useState<PurchaseOption[]>([]);

  useEffect(() => {
    void supabase
      .from("purchases")
      .select("id, date, source, total_amount")
      .order("date", { ascending: false })
      .then(({ data }) => {
        setPurchases((data ?? []) as PurchaseOption[]);
      });
  }, []);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (userError || !userData.user) {
      setError("Sessione non valida. Effettua nuovamente il login.");
      setLoading(false);
      return;
    }

    const { data: inserted, error: insertError } = await supabase
      .from("cards")
      .insert({
      name,
      set_name: setName_ || null,
      set_code: setCode || null,
      number: number || null,
      language,
      condition,
      is_foil: isFoil,
      is_japanese: language === "JAP" ? true : isJapanese,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      purchase_date: purchaseDate || null,
      purchase_source:
        purchaseSource && purchaseSource !== SELECT_NONE ? purchaseSource : null,
      purchase_id: purchaseId !== SELECT_NONE ? purchaseId : null,
      target_price: targetPrice ? Number(targetPrice) : null,
      current_market_price: marketPrice ? Number(marketPrice) : null,
      status,
      notes: notes || null,
      owner_id: userData.user.id,
    })
      .select("id")
      .single();

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    await notify(
      formatNewCardMessage({
        name,
        setName: setName_ || null,
        status,
        purchasePrice: purchasePrice ? Number(purchasePrice) : null,
      }),
    );

    if (inserted?.id && (setName_ || setCode)) {
      await fetch(`/api/cards/${inserted.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          setName: setName_,
          setCode,
          number,
          isJapanese: language === "JAP" ? true : isJapanese,
        }),
      });
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Nuova carta</h1>
        <p className="text-sm text-muted-foreground">
          Inserisci i dettagli della carta acquistata.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dettagli carta</CardTitle>
          <CardDescription>
            I campi contrassegnati con * sono obbligatori.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                {error}
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="name">Nome carta *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  placeholder="es. Charizard"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="set_name">Set</Label>
                <Input
                  id="set_name"
                  value={setName_}
                  onChange={(event) => setSetName(event.target.value)}
                  placeholder="es. Base Set"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="set_code">Codice set</Label>
                <Input
                  id="set_code"
                  value={setCode}
                  onChange={(event) => setSetCode(event.target.value)}
                  placeholder="es. BS"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="number">Numero</Label>
                <Input
                  id="number"
                  value={number}
                  onChange={(event) => setNumber(event.target.value)}
                  placeholder="es. 4/102"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Lingua</Label>
                <Select
                  value={language}
                  onValueChange={(value) => {
                    setLanguage(value);
                    if (value === "JAP") setIsJapanese(true);
                  }}
                >
                  <SelectTrigger id="language">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_LANGUAGES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="condition">Condizione</Label>
                <Select value={condition} onValueChange={setCondition}>
                  <SelectTrigger id="condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_CONDITIONS.map((item) => (
                    <SelectItem key={item} value={item}>
                      {CARD_CONDITION_LABELS[item] ?? item}
                    </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="is_foil"
                  checked={isFoil}
                  onCheckedChange={(value) => setIsFoil(value === true)}
                />
                <Label htmlFor="is_foil">Foil</Label>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="is_japanese"
                  checked={language === "JAP" || isJapanese}
                  disabled={language === "JAP"}
                  onCheckedChange={(value) => setIsJapanese(value === true)}
                />
                <Label htmlFor="is_japanese">Edizione giapponese</Label>
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase_price">Prezzo acquisto (€)</Label>
                <Input
                  id="purchase_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={purchasePrice}
                  onChange={(event) => setPurchasePrice(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase_date">Data acquisto</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase_source">Fonte acquisto</Label>
                <Select value={purchaseSource} onValueChange={setPurchaseSource}>
                  <SelectTrigger id="purchase_source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE}>Non specificata</SelectItem>
                    {PURCHASE_SOURCES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="purchase_id">Lotto / acquisto collegato</Label>
                <Select value={purchaseId} onValueChange={setPurchaseId}>
                  <SelectTrigger id="purchase_id">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE}>
                      Nessuno (costo singolo)
                    </SelectItem>
                    {purchases.map((purchase) => (
                      <SelectItem key={purchase.id} value={purchase.id}>
                        {formatISODate(purchase.date)} · {purchase.source} · €
                        {Number(purchase.total_amount).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="target_price">Prezzo target (€)</Label>
                <Input
                  id="target_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetPrice}
                  onChange={(event) => setTargetPrice(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="market_price">Prezzo mercato attuale (€)</Label>
                <Input
                  id="market_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={marketPrice}
                  onChange={(event) => setMarketPrice(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Stato</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_STATUSES_EDITABLE.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/dashboard")}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvataggio..." : "Salva carta"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
