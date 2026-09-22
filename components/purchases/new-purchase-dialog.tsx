"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export function NewPurchaseDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [date, setDate] = useState(todayISO());
  const [source, setSource] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [shippingCost, setShippingCost] = useState("0");
  const [notes, setNotes] = useState("");

  function resetForm() {
    setDate(todayISO());
    setSource("");
    setTotalAmount("");
    setShippingCost("0");
    setNotes("");
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

    setOpen(false);
    resetForm();
    router.refresh();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>+ Nuovo acquisto</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuovo acquisto</DialogTitle>
          <DialogDescription>
            Registra un nuovo acquisto (lotto, carta singola, ecc.).
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
            <Input
              id="p_source"
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="es. vinted, cardmarket, privato, lotto"
              required
            />
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
