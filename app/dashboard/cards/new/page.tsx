"use client";

import { useState, type FormEvent } from "react";
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
  CARD_LANGUAGES,
  CARD_STATUSES,
  PURCHASE_SOURCES,
} from "@/lib/constants";

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
  const [purchaseSource, setPurchaseSource] = useState("cardmarket");
  const [targetPrice, setTargetPrice] = useState("");
  const [status, setStatus] = useState("in_stock");
  const [notes, setNotes] = useState("");

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

    const { error: insertError } = await supabase.from("cards").insert({
      name,
      set_name: setName_ || null,
      set_code: setCode || null,
      number: number || null,
      language,
      condition,
      is_foil: isFoil,
      is_japanese: isJapanese,
      purchase_price: purchasePrice ? Number(purchasePrice) : null,
      purchase_date: purchaseDate || null,
      purchase_source: purchaseSource || null,
      target_price: targetPrice ? Number(targetPrice) : null,
      status,
      notes: notes || null,
      owner_id: userData.user.id,
    });

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
                <Select value={language} onValueChange={setLanguage}>
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
                        {item}
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
                  checked={isJapanese}
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
                    {PURCHASE_SOURCES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
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
                <Label htmlFor="status">Stato</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CARD_STATUSES.map((item) => (
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
