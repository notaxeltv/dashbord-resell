"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { notify, formatNewSaleMessage } from "@/lib/notify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { MARKETPLACES } from "@/lib/constants";
import type { Sale } from "@/lib/types";

export interface CardOption {
  id: string;
  name: string;
  set_name: string | null;
  status: string;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function SaleDialog({
  cards,
  sale,
  cardLabel,
}: {
  cards: CardOption[];
  sale?: Sale;
  cardLabel?: string;
}) {
  const isEdit = Boolean(sale);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [cardId, setCardId] = useState(sale?.card_id ?? "");
  const [marketplace, setMarketplace] = useState(sale?.marketplace ?? "cardmarket");
  const [salePrice, setSalePrice] = useState(sale ? String(sale.sale_price) : "");
  const [shippingPaidByBuyer, setShippingPaidByBuyer] = useState(
    sale ? String(sale.shipping_paid_by_buyer ?? 0) : "0",
  );
  const [fees, setFees] = useState(sale ? String(sale.fees ?? 0) : "0");
  const [saleDate, setSaleDate] = useState(sale?.sale_date ?? todayISO());
  const [buyerInfo, setBuyerInfo] = useState(sale?.buyer_info ?? "");
  const [notes, setNotes] = useState(sale?.notes ?? "");

  function resetForm() {
    setCardId(sale?.card_id ?? "");
    setMarketplace(sale?.marketplace ?? "cardmarket");
    setSalePrice(sale ? String(sale.sale_price) : "");
    setShippingPaidByBuyer(sale ? String(sale.shipping_paid_by_buyer ?? 0) : "0");
    setFees(sale ? String(sale.fees ?? 0) : "0");
    setSaleDate(sale?.sale_date ?? todayISO());
    setBuyerInfo(sale?.buyer_info ?? "");
    setNotes(sale?.notes ?? "");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!isEdit && !cardId) {
      setError("Seleziona la carta venduta.");
      return;
    }

    setLoading(true);
    setError(null);

    if (isEdit && sale) {
      const { error: updateError } = await supabase
        .from("sales")
        .update({
          marketplace,
          sale_price: Number(salePrice || 0),
          shipping_paid_by_buyer: Number(shippingPaidByBuyer || 0),
          fees: Number(fees || 0),
          sale_date: saleDate,
          buyer_info: buyerInfo || null,
          notes: notes || null,
        })
        .eq("id", sale.id);

      setLoading(false);

      if (updateError) {
        setError(updateError.message);
        return;
      }

      setOpen(false);
      router.refresh();
      return;
    }

    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData.user) {
      setError("Sessione non valida.");
      setLoading(false);
      return;
    }

    const { error: insertError } = await supabase.from("sales").insert({
      card_id: cardId,
      marketplace,
      sale_price: Number(salePrice || 0),
      shipping_paid_by_buyer: Number(shippingPaidByBuyer || 0),
      fees: Number(fees || 0),
      sale_date: saleDate,
      buyer_info: buyerInfo || null,
      notes: notes || null,
      sold_by: userData.user.id,
    });

    if (insertError) {
      setError(insertError.message);
      setLoading(false);
      return;
    }

    // Aggiorna lo stato della carta a "venduta". Operazione best-effort:
    // eventuali errori non bloccano la registrazione della vendita già salvata.
    await supabase.from("cards").update({ status: "sold" }).eq("id", cardId);

    const soldCard = cards.find((card) => card.id === cardId);
    await notify(
      formatNewSaleMessage({
        cardName: soldCard?.name ?? "Carta",
        marketplace,
        salePrice: Number(salePrice || 0),
        netAmount:
          Number(salePrice || 0) +
          Number(shippingPaidByBuyer || 0) -
          Number(fees || 0),
      }),
    );

    setLoading(false);
    setOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm">
            Modifica
          </Button>
        ) : (
          <Button>+ Nuova vendita</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica vendita" : "Nuova vendita"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Correggi i dati di questa vendita."
              : "Registra la vendita di una carta in stock o in vendita."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          {isEdit ? (
            <div className="space-y-2">
              <Label>Carta</Label>
              <p className="rounded-md border border-input bg-muted px-3 py-2 text-sm text-muted-foreground">
                {cardLabel ?? "Carta"}
              </p>
              <p className="text-xs text-muted-foreground">
                Per cambiare la carta venduta, elimina questa vendita e
                creane una nuova.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="s_card">Carta *</Label>
              <Select value={cardId} onValueChange={setCardId}>
                <SelectTrigger id="s_card">
                  <SelectValue placeholder="Seleziona una carta" />
                </SelectTrigger>
                <SelectContent>
                  {cards.length === 0 && (
                    <SelectItem value="__none" disabled>
                      Nessuna carta disponibile
                    </SelectItem>
                  )}
                  {cards.map((card) => (
                    <SelectItem key={card.id} value={card.id}>
                      {card.name}
                      {card.set_name ? ` (${card.set_name})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="s_marketplace">Marketplace</Label>
            <Select value={marketplace} onValueChange={setMarketplace}>
              <SelectTrigger id="s_marketplace">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MARKETPLACES.map((item) => (
                  <SelectItem key={item.value} value={item.value}>
                    {item.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s_price">Prezzo vendita (€) *</Label>
              <Input
                id="s_price"
                type="number"
                step="0.01"
                min="0"
                value={salePrice}
                onChange={(event) => setSalePrice(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_date">Data vendita *</Label>
              <Input
                id="s_date"
                type="date"
                value={saleDate}
                onChange={(event) => setSaleDate(event.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="s_shipping">Spedizione rimborsata (€)</Label>
              <Input
                id="s_shipping"
                type="number"
                step="0.01"
                min="0"
                value={shippingPaidByBuyer}
                onChange={(event) => setShippingPaidByBuyer(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s_fees">Fee marketplace (€)</Label>
              <Input
                id="s_fees"
                type="number"
                step="0.01"
                min="0"
                value={fees}
                onChange={(event) => setFees(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="s_buyer">Info acquirente</Label>
            <Input
              id="s_buyer"
              value={buyerInfo}
              onChange={(event) => setBuyerInfo(event.target.value)}
              placeholder="Nickname, contatto..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="s_notes">Note</Label>
            <Textarea
              id="s_notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
            />
          </div>

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
