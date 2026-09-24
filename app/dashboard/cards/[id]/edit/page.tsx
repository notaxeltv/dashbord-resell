"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

import { supabase } from "@/lib/supabase";
import { notify, formatCardStatusChangeMessage } from "@/lib/notify";
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
import type { Card as CardRow, PurchaseOption } from "@/lib/types";

export default function EditCardPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const cardId = params.id;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState<Partial<CardRow>>({});
  const [initialStatus, setInitialStatus] = useState<string | null>(null);
  const [purchases, setPurchases] = useState<PurchaseOption[]>([]);
  const [hasSale, setHasSale] = useState(false);

  useEffect(() => {
    async function loadCard() {
      const { data, error } = await supabase
        .from("cards")
        .select("*")
        .eq("id", cardId)
        .maybeSingle();

      if (error || !data) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setForm(data as CardRow);
      setInitialStatus((data as CardRow).status);
      setLoading(false);

      const [{ data: purchaseRows }, { data: saleRows }] = await Promise.all([
        supabase
          .from("purchases")
          .select("id, date, source, total_amount")
          .order("date", { ascending: false }),
        supabase.from("sales").select("id").eq("card_id", cardId).limit(1),
      ]);
      setPurchases((purchaseRows ?? []) as PurchaseOption[]);
      setHasSale((saleRows ?? []).length > 0);
    }

    loadCard();
  }, [cardId]);

  function update<K extends keyof CardRow>(key: K, value: CardRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const { error } = await supabase
      .from("cards")
      .update({
        name: form.name,
        set_name: form.set_name || null,
        set_code: form.set_code || null,
        number: form.number || null,
        language: form.language,
        condition: form.condition,
        is_foil: !!form.is_foil,
        is_japanese: form.language === "JAP" ? true : !!form.is_japanese,
        purchase_price: form.purchase_price ?? null,
        purchase_date: form.purchase_date || null,
        purchase_source:
          form.purchase_source && form.purchase_source !== SELECT_NONE
            ? form.purchase_source
            : null,
        purchase_id: form.purchase_id || null,
        target_price: form.target_price ?? null,
        current_market_price: form.current_market_price ?? null,
        status: form.status,
        notes: form.notes || null,
      })
      .eq("id", cardId);

    setSaving(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (
      initialStatus &&
      form.status &&
      form.status !== initialStatus &&
      form.name
    ) {
      await notify(
        formatCardStatusChangeMessage({
          name: form.name,
          oldStatus: initialStatus,
          newStatus: form.status,
        }),
      );
    }

    router.push("/dashboard");
    router.refresh();
  }

  if (loading) {
    return <p className="text-sm text-muted-foreground">Caricamento...</p>;
  }

  if (notFound) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-red-600">Carta non trovata.</p>
        <Button asChild variant="outline">
          <Link href="/dashboard">Torna alla dashboard</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Modifica carta</h1>
        <p className="text-sm text-muted-foreground">
          Aggiorna i dettagli della carta selezionata.
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
                  value={form.name ?? ""}
                  onChange={(event) => update("name", event.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="set_name">Set</Label>
                <Input
                  id="set_name"
                  value={form.set_name ?? ""}
                  onChange={(event) => update("set_name", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="set_code">Codice set</Label>
                <Input
                  id="set_code"
                  value={form.set_code ?? ""}
                  onChange={(event) => update("set_code", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="number">Numero</Label>
                <Input
                  id="number"
                  value={form.number ?? ""}
                  onChange={(event) => update("number", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="language">Lingua</Label>
                <Select
                  value={form.language ?? "ITA"}
                  onValueChange={(value) => {
                    update("language", value);
                    if (value === "JAP") update("is_japanese", true);
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
                <Select
                  value={form.condition ?? "NM"}
                  onValueChange={(value) => update("condition", value)}
                >
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
                  checked={!!form.is_foil}
                  onCheckedChange={(value) => update("is_foil", value === true)}
                />
                <Label htmlFor="is_foil">Foil</Label>
              </div>

              <div className="flex items-center gap-2 pt-6">
                <Checkbox
                  id="is_japanese"
                  checked={form.language === "JAP" || !!form.is_japanese}
                  disabled={form.language === "JAP"}
                  onCheckedChange={(value) =>
                    update("is_japanese", value === true)
                  }
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
                  value={form.purchase_price ?? ""}
                  onChange={(event) =>
                    update(
                      "purchase_price",
                      event.target.value === "" ? null : Number(event.target.value),
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase_date">Data acquisto</Label>
                <Input
                  id="purchase_date"
                  type="date"
                  value={form.purchase_date ?? ""}
                  onChange={(event) => update("purchase_date", event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="purchase_source">Fonte acquisto</Label>
                <Select
                  value={form.purchase_source ?? SELECT_NONE}
                  onValueChange={(value) =>
                    update("purchase_source", value === SELECT_NONE ? null : value)
                  }
                >
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
                <Select
                  value={form.purchase_id ?? SELECT_NONE}
                  onValueChange={(value) =>
                    update("purchase_id", value === SELECT_NONE ? null : value)
                  }
                >
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
                  value={form.target_price ?? ""}
                  onChange={(event) =>
                    update(
                      "target_price",
                      event.target.value === "" ? null : Number(event.target.value),
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="current_market_price">
                  Prezzo mercato attuale (€)
                </Label>
                <Input
                  id="current_market_price"
                  type="number"
                  step="0.01"
                  min="0"
                  value={form.current_market_price ?? ""}
                  onChange={(event) =>
                    update(
                      "current_market_price",
                      event.target.value === "" ? null : Number(event.target.value),
                    )
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Stato</Label>
                <Select
                  value={form.status ?? "in_stock"}
                  onValueChange={(value) => update("status", value as CardRow["status"])}
                  disabled={hasSale || form.status === "sold"}
                >
                  <SelectTrigger id="status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {hasSale || form.status === "sold" ? (
                      <SelectItem value="sold">Venduta</SelectItem>
                    ) : (
                      CARD_STATUSES_EDITABLE.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="notes">Note</Label>
                <Textarea
                  id="notes"
                  value={form.notes ?? ""}
                  onChange={(event) => update("notes", event.target.value)}
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
              <Button type="submit" disabled={saving}>
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
