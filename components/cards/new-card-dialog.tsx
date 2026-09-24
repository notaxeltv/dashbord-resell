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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  CARD_CONDITIONS,
  CARD_CONDITION_LABELS,
  CARD_LANGUAGES,
  CARD_STATUSES_EDITABLE,
  PURCHASE_SOURCES,
  SELECT_NONE,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import { formatISODate } from "@/lib/dates";
import type { PurchaseOption } from "@/lib/types";

export function NewCardDialog({
  purchases = [],
  triggerClassName,
}: {
  purchases?: PurchaseOption[];
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMore, setShowMore] = useState(false);

  const [name, setName] = useState("");
  const [setName_, setSetName] = useState("");
  const [number, setNumber] = useState("");
  const [condition, setCondition] = useState("NM");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [setCode, setSetCode] = useState("");
  const [language, setLanguage] = useState("ITA");
  const [isFoil, setIsFoil] = useState(false);
  const [isJapanese, setIsJapanese] = useState(false);
  const [purchaseDate, setPurchaseDate] = useState("");
  const [purchaseSource, setPurchaseSource] = useState(SELECT_NONE);
  const [purchaseId, setPurchaseId] = useState(SELECT_NONE);
  const [targetPrice, setTargetPrice] = useState("");
  const [marketPrice, setMarketPrice] = useState("");
  const [status, setStatus] = useState("in_stock");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setName("");
    setSetName("");
    setNumber("");
    setCondition("NM");
    setPurchasePrice("");
    setSetCode("");
    setLanguage("ITA");
    setIsFoil(false);
    setIsJapanese(false);
    setPurchaseDate("");
    setPurchaseSource(SELECT_NONE);
    setPurchaseId(SELECT_NONE);
    setTargetPrice("");
    setMarketPrice("");
    setStatus("in_stock");
    setNotes("");
    setShowMore(false);
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError("Sessione non valida.");
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

    setLoading(false);
    setOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger asChild>
        <Button className={cn(triggerClassName)}>+ Nuova carta</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Nuova carta</DialogTitle>
          <DialogDescription>
            Nome, set e costo bastano. Il resto è opzionale.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">{error}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="nc_name">Nome *</Label>
            <Input
              id="nc_name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              placeholder="es. Charizard"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="nc_set">Set</Label>
              <Input
                id="nc_set"
                value={setName_}
                onChange={(event) => setSetName(event.target.value)}
                placeholder="es. Base Set"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nc_number">Numero</Label>
              <Input
                id="nc_number"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
                placeholder="es. 4/102"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Condizione</Label>
              <Select value={condition} onValueChange={setCondition}>
                <SelectTrigger>
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
            <div className="space-y-2">
              <Label htmlFor="nc_price">Costo (€)</Label>
              <Input
                id="nc_price"
                type="number"
                step="0.01"
                min="0"
                value={purchasePrice}
                onChange={(event) => setPurchasePrice(event.target.value)}
              />
            </div>
          </div>

          <button
            type="button"
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setShowMore((value) => !value)}
          >
            {showMore ? "Nascondi altri campi" : "Altri campi (foil, lotto, target…)"}
          </button>

          {showMore && (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Codice set</Label>
                <Input
                  value={setCode}
                  onChange={(event) => setSetCode(event.target.value)}
                  placeholder="es. BS"
                />
              </div>
              <div className="space-y-2">
                <Label>Lingua</Label>
                <Select
                  value={language}
                  onValueChange={(value) => {
                    setLanguage(value);
                    if (value === "JAP") setIsJapanese(true);
                  }}
                >
                  <SelectTrigger>
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
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="nc_foil"
                  checked={isFoil}
                  onCheckedChange={(value) => setIsFoil(value === true)}
                />
                <Label htmlFor="nc_foil">Foil</Label>
              </div>
              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="nc_jp"
                  checked={language === "JAP" || isJapanese}
                  disabled={language === "JAP"}
                  onCheckedChange={(value) => setIsJapanese(value === true)}
                />
                <Label htmlFor="nc_jp">JP</Label>
              </div>
              <div className="space-y-2">
                <Label>Stato</Label>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger>
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
              <div className="space-y-2">
                <Label>Target (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={targetPrice}
                  onChange={(event) => setTargetPrice(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Mercato (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={marketPrice}
                  onChange={(event) => setMarketPrice(event.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Data acquisto</Label>
                <Input
                  type="date"
                  value={purchaseDate}
                  onChange={(event) => setPurchaseDate(event.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Lotto collegato</Label>
                <Select value={purchaseId} onValueChange={setPurchaseId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={SELECT_NONE}>Nessuno</SelectItem>
                    {purchases.map((purchase) => (
                      <SelectItem key={purchase.id} value={purchase.id}>
                        {formatISODate(purchase.date)} · {purchase.source} · €
                        {Number(purchase.total_amount).toFixed(2)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Fonte</Label>
                <Select value={purchaseSource} onValueChange={setPurchaseSource}>
                  <SelectTrigger>
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
                <Label>Note</Label>
                <Textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Annulla
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Salvataggio..." : "Salva"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
