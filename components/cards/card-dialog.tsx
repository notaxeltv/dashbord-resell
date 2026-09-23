"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ImageOff, RefreshCw } from "lucide-react";

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
  CARD_LANGUAGES,
  CARD_STATUSES,
  PURCHASE_SOURCES,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Card as CardRow } from "@/lib/types";

/**
 * Popup unico per visualizzare, modificare ed eliminare una carta esistente.
 * Il `trigger` (il riquadro mobile o la riga della tabella desktop) apre il
 * popup al click, evitando di dover navigare su una pagina separata.
 */
export function CardDialog({
  card,
  trigger,
  triggerClassName,
}: {
  card: CardRow;
  trigger: ReactNode;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState(card.image_url);
  const [searchingImage, setSearchingImage] = useState(false);

  const [form, setForm] = useState<CardRow>(card);

  function update<K extends keyof CardRow>(key: K, value: CardRow[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function resetForm() {
    setForm(card);
    setImageUrl(card.image_url);
    setError(null);
  }

  async function searchImage() {
    if (!form.name?.trim()) return;
    setSearchingImage(true);
    try {
      const response = await fetch(`/api/cards/${card.id}/image`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name, setName: form.set_name }),
      });
      const data = await response.json();
      if (data?.imageUrl) {
        setImageUrl(data.imageUrl);
        router.refresh();
      }
    } catch {
      // Ricerca immagine "best effort": nessun errore bloccante da mostrare.
    } finally {
      setSearchingImage(false);
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetForm();
      return;
    }
    if (!card.image_url) {
      void searchImage();
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const { error: updateError } = await supabase
      .from("cards")
      .update({
        name: form.name,
        set_name: form.set_name || null,
        set_code: form.set_code || null,
        number: form.number || null,
        language: form.language,
        condition: form.condition,
        is_foil: !!form.is_foil,
        is_japanese: !!form.is_japanese,
        purchase_price: form.purchase_price ?? null,
        purchase_date: form.purchase_date || null,
        purchase_source: form.purchase_source || null,
        target_price: form.target_price ?? null,
        current_market_price: form.current_market_price ?? null,
        status: form.status,
        notes: form.notes || null,
      })
      .eq("id", card.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    if (form.status !== card.status && form.name) {
      await notify(
        formatCardStatusChangeMessage({
          name: form.name,
          oldStatus: card.status,
          newStatus: form.status,
        }),
      );
    }

    setOpen(false);
    router.refresh();
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      "Vuoi davvero eliminare questa carta? L'operazione non è reversibile.",
    );
    if (!confirmed) return;

    setDeleting(true);
    const { error: deleteError } = await supabase
      .from("cards")
      .delete()
      .eq("id", card.id);
    setDeleting(false);

    if (deleteError) {
      setError(deleteError.message);
      return;
    }

    setOpen(false);
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <div
          className={cn(
            "cursor-pointer text-left transition hover:border-primary/40 hover:bg-muted/40",
            triggerClassName,
          )}
          role="button"
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              event.currentTarget.click();
            }
          }}
        >
          {trigger}
        </div>
      </DialogTrigger>
      <DialogContent className="max-w-lg sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{card.name}</DialogTitle>
          <DialogDescription>
            Visualizza, modifica o elimina questa carta.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex items-center gap-4">
            <div className="flex h-28 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border/60 bg-muted">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={form.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageOff className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                Immagine recuperata automaticamente da CardTrader in base a
                nome e set.
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={searchImage}
                disabled={searchingImage}
              >
                <RefreshCw
                  className={cn("mr-2 h-3.5 w-3.5", searchingImage && "animate-spin")}
                />
                {searchingImage ? "Ricerca..." : "Cerca immagine"}
              </Button>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="cd_name">Nome carta *</Label>
              <Input
                id="cd_name"
                value={form.name ?? ""}
                onChange={(event) => update("name", event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cd_set_name">Set</Label>
              <Input
                id="cd_set_name"
                value={form.set_name ?? ""}
                onChange={(event) => update("set_name", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cd_set_code">Codice set</Label>
              <Input
                id="cd_set_code"
                value={form.set_code ?? ""}
                onChange={(event) => update("set_code", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cd_number">Numero</Label>
              <Input
                id="cd_number"
                value={form.number ?? ""}
                onChange={(event) => update("number", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cd_language">Lingua</Label>
              <Select
                value={form.language ?? "ITA"}
                onValueChange={(value) => update("language", value)}
              >
                <SelectTrigger id="cd_language">
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
              <Label htmlFor="cd_condition">Condizione</Label>
              <Select
                value={form.condition ?? "NM"}
                onValueChange={(value) => update("condition", value)}
              >
                <SelectTrigger id="cd_condition">
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
                id="cd_is_foil"
                checked={!!form.is_foil}
                onCheckedChange={(value) => update("is_foil", value === true)}
              />
              <Label htmlFor="cd_is_foil">Foil</Label>
            </div>

            <div className="flex items-center gap-2 pt-6">
              <Checkbox
                id="cd_is_japanese"
                checked={!!form.is_japanese}
                onCheckedChange={(value) =>
                  update("is_japanese", value === true)
                }
              />
              <Label htmlFor="cd_is_japanese">Edizione giapponese</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cd_purchase_price">Prezzo acquisto (€)</Label>
              <Input
                id="cd_purchase_price"
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
              <Label htmlFor="cd_purchase_date">Data acquisto</Label>
              <Input
                id="cd_purchase_date"
                type="date"
                value={form.purchase_date ?? ""}
                onChange={(event) => update("purchase_date", event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="cd_purchase_source">Fonte acquisto</Label>
              <Select
                value={form.purchase_source ?? "altro"}
                onValueChange={(value) => update("purchase_source", value)}
              >
                <SelectTrigger id="cd_purchase_source">
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
              <Label htmlFor="cd_target_price">Prezzo target (€)</Label>
              <Input
                id="cd_target_price"
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
              <Label htmlFor="cd_current_market_price">
                Prezzo mercato attuale (€)
              </Label>
              <Input
                id="cd_current_market_price"
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
              <Label htmlFor="cd_status">Stato</Label>
              <Select
                value={form.status ?? "in_stock"}
                onValueChange={(value) => update("status", value as CardRow["status"])}
              >
                <SelectTrigger id="cd_status">
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
              <Label htmlFor="cd_notes">Note</Label>
              <Textarea
                id="cd_notes"
                value={form.notes ?? ""}
                onChange={(event) => update("notes", event.target.value)}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="sm:justify-between">
            <Button
              type="button"
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? "Eliminazione..." : "Elimina carta"}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
              >
                Annulla
              </Button>
              <Button type="submit" disabled={saving || deleting}>
                {saving ? "Salvataggio..." : "Salva modifiche"}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
