"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
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
import type { Transaction } from "@/lib/types";

export function TransactionDialog({
  transaction,
  triggerClassName,
}: {
  transaction?: Transaction;
  triggerClassName?: string;
}) {
  const isEdit = Boolean(transaction);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [type, setType] = useState<"income" | "expense">(
    transaction?.type ?? "expense",
  );
  const [amount, setAmount] = useState(
    transaction ? String(transaction.amount) : "",
  );
  const [description, setDescription] = useState(transaction?.description ?? "");

  function resetForm() {
    setType(transaction?.type ?? "expense");
    setAmount(transaction ? String(transaction.amount) : "");
    setDescription(transaction?.description ?? "");
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    if (isEdit && transaction) {
      const { error: updateError } = await supabase
        .from("transactions")
        .update({
          type,
          amount: Number(amount || 0),
          description: description || null,
        })
        .eq("id", transaction.id);

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

    const { error: insertError } = await supabase.from("transactions").insert({
      type,
      amount: Number(amount || 0),
      description: description || null,
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
        {isEdit ? (
          <Button variant="outline" size="sm" className={cn(triggerClassName)}>
            Modifica
          </Button>
        ) : (
          <Button className={cn(triggerClassName)}>+ Movimento extra</Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Modifica movimento" : "Nuovo movimento extra"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Correggi i dati di questo movimento."
              : "Registra un'entrata o una spesa non legata a una singola carta (es. abbonamenti, materiali di imballaggio, commissioni)."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="t_type">Tipo *</Label>
            <Select value={type} onValueChange={(value) => setType(value as "income" | "expense")}>
              <SelectTrigger id="t_type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Spesa</SelectItem>
                <SelectItem value="income">Entrata</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="t_amount">Importo (€) *</Label>
            <Input
              id="t_amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="t_description">Descrizione</Label>
            <Textarea
              id="t_description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="es. abbonamento Cardmarket, materiale imballaggio..."
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
