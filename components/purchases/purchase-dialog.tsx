"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { notify, formatNewPurchaseMessage } from "@/lib/notify";
import { todayISO } from "@/lib/dates";
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
import { cn } from "@/lib/utils";
import { PURCHASE_SOURCES } from "@/lib/constants";
import type { Purchase } from "@/lib/types";

export function PurchaseDialog({
  purchase,
  triggerClassName,
}: {
  purchase?: Purchase;
  triggerClassName?: string;
}) {
  const isEdit = Boolean(purchase);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(purchase?.date ?? todayISO());
  const [source, setSource] = useState(purchase?.source ?? "cardmarket");
  const [totalAmount, setTotalAmount] = useState(
    purchase ? String(purchase.total_amount) : "",
  );
  const [shippingCost, setShippingCost] = useState(
    purchase ? String(purchase.shipping_cost ?? 0) : "0",
  );
  const [notes, setNotes] = useState(purchase?.notes ?? "");

  function resetForm() {
    setDate(purchase?.date ?? todayISO());
    setSource(purchase?.source ?? "cardmarket");
    setTotalAmount(purchase ? String(purchase.total_amount) : "");
    setShippingCost(purchase ? String(purchase.shipping_cost ?? 0) : "0");
    setNotes(purchase?.notes ?? "");
    setError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (isEdit && purchase) {
      const { error: updateError } = await supabase
        .from("purchases")
        .update({
          date,
          source,
          total_amount: Number(totalAmount || 0),
          shipping_cost: Number(shippingCost || 0),
          notes: notes || null,
        })
        .eq("id", purchase.id);

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

    const { error: insertError } = await supabase.from("purchases").insert({
      date,
      source,
      total_amount: Number(totalAmount || 0),
      shipping_cost: Number(shippingCost || 0),
      notes: notes || null,
      created_by: userData.user.id,
    });

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    await notify(
      formatNewPurchaseMessage({
        source,
        totalAmount: Number(totalAmount || 0),
        shippingCost: Number(shippingCost || 0),
      }),
    );

    setOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) resetForm();
      }}
    >
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="outline" size="sm" className={cn(triggerClassName)}>
            Modifica
          </Button>
        ) : (
          <Button className={cn(triggerClassName)}>+ Nuovo lotto</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica lotto" : "Nuovo lotto"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Correggi i dati di questo lotto."
              : "Registra quanto hai pagato per un ordine o un lotto (cassa)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="p_date">Data *</Label>
            <Input
              id="p_date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="p_source">Fonte *</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger id="p_source">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="p_total">Totale (€) *</Label>
              <Input
                id="p_total"
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(event) => setTotalAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="p_shipping">Spedizione (€)</Label>
              <Input
                id="p_shipping"
                type="number"
                step="0.01"
                min="0"
                value={shippingCost}
                onChange={(event) => setShippingCost(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="p_notes">Note</Label>
            <Textarea
              id="p_notes"
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
