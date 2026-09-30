"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";
import { todayISO, yearFromISODate } from "@/lib/dates";
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
import { PAYMENT_METHODS, SELECT_NONE } from "@/lib/constants";
import { isDuplicateNumberError, nextDocumentNumber } from "@/lib/documents";
import type { PurchaseReceipt } from "@/lib/types";

export interface PurchaseOptionForReceipt {
  id: string;
  date: string;
  source: string;
  total_amount: number;
}

export function ReceiptDialog({
  receipt,
  purchaseOptions,
  triggerClassName,
}: {
  receipt?: PurchaseReceipt;
  purchaseOptions: PurchaseOptionForReceipt[];
  triggerClassName?: string;
}) {
  const isEdit = Boolean(receipt);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [purchaseId, setPurchaseId] = useState(receipt?.purchase_id ?? SELECT_NONE);
  const [issueDate, setIssueDate] = useState(receipt?.issue_date ?? todayISO());
  const [sellerName, setSellerName] = useState(receipt?.seller_name ?? "");
  const [sellerTaxCode, setSellerTaxCode] = useState(receipt?.seller_tax_code ?? "");
  const [sellerAddress, setSellerAddress] = useState(receipt?.seller_address ?? "");
  const [sellerIdDocument, setSellerIdDocument] = useState(
    receipt?.seller_id_document ?? "",
  );
  const [description, setDescription] = useState(
    receipt?.description ?? "Acquisto carte Pokémon",
  );
  const [amount, setAmount] = useState(receipt ? String(receipt.amount) : "");
  const [paymentMethod, setPaymentMethod] = useState(receipt?.payment_method ?? "contanti");
  const [notes, setNotes] = useState(receipt?.notes ?? "");

  function resetForm() {
    setPurchaseId(receipt?.purchase_id ?? SELECT_NONE);
    setIssueDate(receipt?.issue_date ?? todayISO());
    setSellerName(receipt?.seller_name ?? "");
    setSellerTaxCode(receipt?.seller_tax_code ?? "");
    setSellerAddress(receipt?.seller_address ?? "");
    setSellerIdDocument(receipt?.seller_id_document ?? "");
    setDescription(receipt?.description ?? "Acquisto carte Pokémon");
    setAmount(receipt ? String(receipt.amount) : "");
    setPaymentMethod(receipt?.payment_method ?? "contanti");
    setNotes(receipt?.notes ?? "");
    setError(null);
  }

  function handlePurchaseChange(nextPurchaseId: string) {
    setPurchaseId(nextPurchaseId);
    if (nextPurchaseId === SELECT_NONE) return;
    const purchase = purchaseOptions.find((option) => option.id === nextPurchaseId);
    if (!purchase) return;
    setAmount(String(purchase.total_amount));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!sellerName.trim()) {
      setError("Indica il nome del venditore privato.");
      return;
    }

    setLoading(true);
    setError(null);

    const basePayload = {
      purchase_id: purchaseId === SELECT_NONE ? null : purchaseId,
      issue_date: issueDate,
      seller_name: sellerName.trim(),
      seller_tax_code: sellerTaxCode || null,
      seller_address: sellerAddress || null,
      seller_id_document: sellerIdDocument || null,
      description,
      amount: Number(amount || 0),
      payment_method: paymentMethod || null,
      notes: notes || null,
    };

    if (isEdit && receipt) {
      const { error: updateError } = await supabase
        .from("purchase_receipts")
        .update(basePayload)
        .eq("id", receipt.id);

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

    const year = yearFromISODate(issueDate);

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const number = (await nextDocumentNumber(supabase, "purchase_receipts", year)) + attempt;
      const { error: insertError } = await supabase.from("purchase_receipts").insert({
        ...basePayload,
        number,
        year,
        created_by: userData.user.id,
      });

      if (!insertError) {
        setLoading(false);
        setOpen(false);
        resetForm();
        router.refresh();
        return;
      }

      if (!isDuplicateNumberError(insertError)) {
        setLoading(false);
        setError(insertError.message);
        return;
      }
    }

    setLoading(false);
    setError("Numero ricevuta già in uso, riprova.");
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
          <Button className={cn(triggerClassName)}>+ Nuova ricevuta</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica ricevuta" : "Nuova ricevuta di acquisto"}</DialogTitle>
          <DialogDescription>
            Autodichiarazione del venditore privato: utile per documentare in
            contabilità il costo di carte acquistate da privati.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          {!isEdit && purchaseOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="rec_purchase">Collega a un lotto (facoltativo)</Label>
              <Select value={purchaseId} onValueChange={handlePurchaseChange}>
                <SelectTrigger id="rec_purchase">
                  <SelectValue placeholder="Nessun lotto collegato" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE}>Nessun lotto collegato</SelectItem>
                  {purchaseOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.date} · €{Number(option.total_amount).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="rec_seller">Nome e cognome venditore *</Label>
              <Input
                id="rec_seller"
                value={sellerName}
                onChange={(event) => setSellerName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec_date">Data *</Label>
              <Input
                id="rec_date"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rec_payment">Metodo di pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="rec_payment">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec_tax_code">Codice fiscale venditore</Label>
            <Input
              id="rec_tax_code"
              value={sellerTaxCode}
              onChange={(event) => setSellerTaxCode(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec_address">Indirizzo venditore</Label>
            <Input
              id="rec_address"
              value={sellerAddress}
              onChange={(event) => setSellerAddress(event.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec_id_doc">Documento d&apos;identità (tipo e numero)</Label>
            <Input
              id="rec_id_doc"
              value={sellerIdDocument}
              onChange={(event) => setSellerIdDocument(event.target.value)}
              placeholder="Facoltativo, es. CI n. AB1234567"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec_description">Descrizione *</Label>
            <Textarea
              id="rec_description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec_amount">Importo (€) *</Label>
            <Input
              id="rec_amount"
              type="number"
              step="0.01"
              min="0"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="rec_notes">Note interne (non stampate)</Label>
            <Textarea
              id="rec_notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={2}
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
