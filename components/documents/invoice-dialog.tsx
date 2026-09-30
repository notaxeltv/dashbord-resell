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
import {
  computeInvoiceTotal,
  computeVatAmount,
  isDuplicateNumberError,
  nextDocumentNumber,
} from "@/lib/documents";
import type { BusinessProfile, Invoice } from "@/lib/types";

export interface SaleOption {
  id: string;
  sale_date: string;
  sale_price: number;
  net_amount: number;
  buyer_info: string | null;
  card_name: string | null;
}

export function InvoiceDialog({
  invoice,
  saleOptions,
  businessProfile,
  triggerClassName,
}: {
  invoice?: Invoice;
  saleOptions: SaleOption[];
  businessProfile: BusinessProfile | null;
  triggerClassName?: string;
}) {
  const isEdit = Boolean(invoice);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const defaultLegalNote =
    businessProfile?.tax_regime === "ordinario"
      ? ""
      : "Operazione effettuata ai sensi dell'art. 1, commi 54-89, L. 190/2014 (regime forfettario): operazione non soggetta a IVA né a ritenuta d'acconto.";

  const [saleId, setSaleId] = useState(invoice?.sale_id ?? SELECT_NONE);
  const [issueDate, setIssueDate] = useState(invoice?.issue_date ?? todayISO());
  const [clientName, setClientName] = useState(invoice?.client_name ?? "");
  const [clientVatNumber, setClientVatNumber] = useState(invoice?.client_vat_number ?? "");
  const [clientTaxCode, setClientTaxCode] = useState(invoice?.client_tax_code ?? "");
  const [clientAddress, setClientAddress] = useState(invoice?.client_address ?? "");
  const [clientSdiCode, setClientSdiCode] = useState(invoice?.client_sdi_code ?? "");
  const [clientPec, setClientPec] = useState(invoice?.client_pec ?? "");
  const [description, setDescription] = useState(
    invoice?.description ?? "Vendita carte Pokémon",
  );
  const [taxableAmount, setTaxableAmount] = useState(
    invoice ? String(invoice.taxable_amount) : "",
  );
  const [vatRate, setVatRate] = useState(invoice ? String(invoice.vat_rate) : "0");
  const [paymentMethod, setPaymentMethod] = useState(invoice?.payment_method ?? "bonifico");
  const [legalNote, setLegalNote] = useState(invoice?.legal_note ?? defaultLegalNote);
  const [notes, setNotes] = useState(invoice?.notes ?? "");

  function resetForm() {
    setSaleId(invoice?.sale_id ?? SELECT_NONE);
    setIssueDate(invoice?.issue_date ?? todayISO());
    setClientName(invoice?.client_name ?? "");
    setClientVatNumber(invoice?.client_vat_number ?? "");
    setClientTaxCode(invoice?.client_tax_code ?? "");
    setClientAddress(invoice?.client_address ?? "");
    setClientSdiCode(invoice?.client_sdi_code ?? "");
    setClientPec(invoice?.client_pec ?? "");
    setDescription(invoice?.description ?? "Vendita carte Pokémon");
    setTaxableAmount(invoice ? String(invoice.taxable_amount) : "");
    setVatRate(invoice ? String(invoice.vat_rate) : "0");
    setPaymentMethod(invoice?.payment_method ?? "bonifico");
    setLegalNote(invoice?.legal_note ?? defaultLegalNote);
    setNotes(invoice?.notes ?? "");
    setError(null);
  }

  function handleSaleChange(nextSaleId: string) {
    setSaleId(nextSaleId);
    if (nextSaleId === SELECT_NONE) return;
    const sale = saleOptions.find((option) => option.id === nextSaleId);
    if (!sale) return;
    if (sale.buyer_info) setClientName(sale.buyer_info);
    setTaxableAmount(String(sale.net_amount));
    setDescription(
      sale.card_name ? `Vendita carta «${sale.card_name}»` : "Vendita carte Pokémon",
    );
  }

  const taxable = Number(taxableAmount || 0);
  const rate = Number(vatRate || 0);
  const vatAmount = computeVatAmount(taxable, rate);
  const totalAmount = computeInvoiceTotal(taxable, rate);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    if (!clientName.trim()) {
      setError("Indica il nome/ragione sociale del cliente.");
      return;
    }

    setLoading(true);
    setError(null);

    const basePayload = {
      sale_id: saleId === SELECT_NONE ? null : saleId,
      issue_date: issueDate,
      client_name: clientName.trim(),
      client_vat_number: clientVatNumber || null,
      client_tax_code: clientTaxCode || null,
      client_address: clientAddress || null,
      client_sdi_code: clientSdiCode || null,
      client_pec: clientPec || null,
      description,
      taxable_amount: taxable,
      vat_rate: rate,
      vat_amount: vatAmount,
      total_amount: totalAmount,
      payment_method: paymentMethod || null,
      legal_note: legalNote || null,
      notes: notes || null,
    };

    if (isEdit && invoice) {
      const { error: updateError } = await supabase
        .from("invoices")
        .update(basePayload)
        .eq("id", invoice.id);

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
      const number = (await nextDocumentNumber(supabase, "invoices", year)) + attempt;
      const { error: insertError } = await supabase.from("invoices").insert({
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
    setError("Numero fattura già in uso, riprova.");
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
          <Button className={cn(triggerClassName)}>+ Nuova fattura</Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifica fattura" : "Nuova fattura di vendita"}</DialogTitle>
          <DialogDescription>
            Documento generato dall&apos;app, non trasmesso allo SdI. Per
            l&apos;obbligo di fatturazione elettronica usa un software
            abilitato.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          {!isEdit && saleOptions.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="inv_sale">Collega a una vendita (facoltativo)</Label>
              <Select value={saleId} onValueChange={handleSaleChange}>
                <SelectTrigger id="inv_sale">
                  <SelectValue placeholder="Nessuna vendita collegata" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SELECT_NONE}>Nessuna vendita collegata</SelectItem>
                  {saleOptions.map((option) => (
                    <SelectItem key={option.id} value={option.id}>
                      {option.card_name ?? "Vendita"} · €{Number(option.net_amount).toFixed(2)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="inv_client">Cliente (nome / ragione sociale) *</Label>
              <Input
                id="inv_client"
                value={clientName}
                onChange={(event) => setClientName(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv_date">Data emissione *</Label>
              <Input
                id="inv_date"
                type="date"
                value={issueDate}
                onChange={(event) => setIssueDate(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv_payment">Metodo di pagamento</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="inv_payment">
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

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv_vat_number">Partita IVA cliente</Label>
              <Input
                id="inv_vat_number"
                value={clientVatNumber}
                onChange={(event) => setClientVatNumber(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv_tax_code">Codice fiscale cliente</Label>
              <Input
                id="inv_tax_code"
                value={clientTaxCode}
                onChange={(event) => setClientTaxCode(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_address">Indirizzo cliente</Label>
            <Input
              id="inv_address"
              value={clientAddress}
              onChange={(event) => setClientAddress(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv_sdi">Codice destinatario SDI</Label>
              <Input
                id="inv_sdi"
                value={clientSdiCode}
                onChange={(event) => setClientSdiCode(event.target.value)}
                placeholder="Facoltativo"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv_pec">PEC cliente</Label>
              <Input
                id="inv_pec"
                value={clientPec}
                onChange={(event) => setClientPec(event.target.value)}
                placeholder="Facoltativo"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_description">Descrizione *</Label>
            <Textarea
              id="inv_description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={2}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="inv_taxable">Imponibile (€) *</Label>
              <Input
                id="inv_taxable"
                type="number"
                step="0.01"
                min="0"
                value={taxableAmount}
                onChange={(event) => setTaxableAmount(event.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="inv_vat_rate">Aliquota IVA (%)</Label>
              <Input
                id="inv_vat_rate"
                type="number"
                step="0.01"
                min="0"
                value={vatRate}
                onChange={(event) => setVatRate(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-md border border-border/60 bg-muted/40 p-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">IVA</span>
              <span>€{vatAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold">
              <span>Totale documento</span>
              <span>€{totalAmount.toFixed(2)}</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_legal_note">Dicitura fiscale</Label>
            <Textarea
              id="inv_legal_note"
              value={legalNote}
              onChange={(event) => setLegalNote(event.target.value)}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="inv_notes">Note interne (non stampate)</Label>
            <Textarea
              id="inv_notes"
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
