"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TAX_REGIMES, optionLabel } from "@/lib/constants";
import { formatDateTime } from "@/lib/dates";
import type { BusinessProfile } from "@/lib/types";

export function BusinessProfileForm({
  profile,
}: {
  profile: BusinessProfile | null;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(!profile);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [legalName, setLegalName] = useState(profile?.legal_name ?? "");
  const [taxRegime, setTaxRegime] = useState(profile?.tax_regime ?? "forfettario");
  const [vatNumber, setVatNumber] = useState(profile?.vat_number ?? "");
  const [taxCode, setTaxCode] = useState(profile?.tax_code ?? "");
  const [address, setAddress] = useState(profile?.address ?? "");
  const [iban, setIban] = useState(profile?.iban ?? "");
  const [notes, setNotes] = useState(profile?.notes ?? "");

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const payload = {
      legal_name: legalName,
      tax_regime: taxRegime,
      vat_number: vatNumber || null,
      tax_code: taxCode || null,
      address: address || null,
      iban: iban || null,
      notes: notes || null,
    };

    const { error: saveError } = profile
      ? await supabase.from("business_profile").update(payload).eq("id", profile.id)
      : await supabase.from("business_profile").insert(payload);

    setLoading(false);

    if (saveError) {
      setError(saveError.message);
      return;
    }

    setEditing(false);
    router.refresh();
  }

  if (!editing && profile) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Dati del venditore</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            <Pencil className="mr-2 h-4 w-4" />
            Modifica
          </Button>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">Ragione sociale / nome</p>
            <p className="font-medium text-foreground">{profile.legal_name || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Regime fiscale</p>
            <p className="font-medium text-foreground">
              {optionLabel(TAX_REGIMES, profile.tax_regime)}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">Partita IVA</p>
            <p className="font-medium text-foreground">{profile.vat_number || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Codice fiscale</p>
            <p className="font-medium text-foreground">{profile.tax_code || "-"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-muted-foreground">Indirizzo</p>
            <p className="font-medium text-foreground">{profile.address || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">IBAN</p>
            <p className="font-medium text-foreground">{profile.iban || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Ultimo aggiornamento</p>
            <p className="font-medium text-foreground">
              {formatDateTime(profile.updated_at)}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Dati del venditore</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Questi dati compaiono come intestazione su fatture e ricevute
            stampabili. Vanno inseriti una sola volta e aggiornati se
            cambiano.
          </p>

          {error && (
            <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bp_name">Ragione sociale / nome e cognome *</Label>
              <Input
                id="bp_name"
                value={legalName}
                onChange={(event) => setLegalName(event.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bp_regime">Regime fiscale *</Label>
              <Select value={taxRegime} onValueChange={setTaxRegime}>
                <SelectTrigger id="bp_regime">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TAX_REGIMES.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bp_vat">Partita IVA</Label>
              <Input
                id="bp_vat"
                value={vatNumber}
                onChange={(event) => setVatNumber(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bp_tax_code">Codice fiscale</Label>
              <Input
                id="bp_tax_code"
                value={taxCode}
                onChange={(event) => setTaxCode(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bp_iban">IBAN</Label>
              <Input
                id="bp_iban"
                value={iban}
                onChange={(event) => setIban(event.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bp_address">Indirizzo</Label>
              <Input
                id="bp_address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>

            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="bp_notes">Note (facoltative)</Label>
              <Textarea
                id="bp_notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                rows={2}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            {profile && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditing(false)}
              >
                Annulla
              </Button>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Salvataggio..." : "Salva"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
