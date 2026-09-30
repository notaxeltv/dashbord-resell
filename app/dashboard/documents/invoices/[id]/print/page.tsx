import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/documents/print-button";
import { formatISODate } from "@/lib/dates";
import { optionLabel, PAYMENT_METHODS, TAX_REGIMES } from "@/lib/constants";
import type { BusinessProfile, Invoice } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InvoicePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: invoice }, { data: profileRows }] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single(),
    supabase.from("business_profile").select("*").limit(1),
  ]);

  if (!invoice) notFound();

  const inv = invoice as Invoice;
  const seller = (profileRows?.[0] ?? null) as BusinessProfile | null;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="space-y-6 rounded-lg border border-gray-300 p-8 print:border-0 print:p-0">
        <div className="flex items-start justify-between border-b border-gray-300 pb-4">
          <div>
            <h1 className="text-2xl font-bold">Fattura</h1>
            <p className="text-sm text-gray-600">
              n. {inv.number}/{inv.year} del {formatISODate(inv.issue_date)}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold">{seller?.legal_name ?? "—"}</p>
            {seller?.vat_number && <p>P.IVA: {seller.vat_number}</p>}
            {seller?.tax_code && <p>CF: {seller.tax_code}</p>}
            {seller?.address && <p>{seller.address}</p>}
            {seller?.tax_regime && (
              <p className="text-gray-600">
                {optionLabel(TAX_REGIMES, seller.tax_regime)}
              </p>
            )}
          </div>
        </div>

        <div>
          <p className="text-xs uppercase text-gray-500">Cliente</p>
          <p className="font-semibold">{inv.client_name}</p>
          {inv.client_vat_number && <p className="text-sm">P.IVA: {inv.client_vat_number}</p>}
          {inv.client_tax_code && <p className="text-sm">CF: {inv.client_tax_code}</p>}
          {inv.client_address && <p className="text-sm">{inv.client_address}</p>}
          {inv.client_sdi_code && (
            <p className="text-sm">Codice SDI: {inv.client_sdi_code}</p>
          )}
          {inv.client_pec && <p className="text-sm">PEC: {inv.client_pec}</p>}
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="py-2">Descrizione</th>
              <th className="py-2 text-right">Imponibile</th>
              <th className="py-2 text-right">IVA</th>
              <th className="py-2 text-right">Totale</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-3">{inv.description}</td>
              <td className="py-3 text-right">€{Number(inv.taxable_amount).toFixed(2)}</td>
              <td className="py-3 text-right">
                {Number(inv.vat_rate).toFixed(2)}% (€{Number(inv.vat_amount).toFixed(2)})
              </td>
              <td className="py-3 text-right">€{Number(inv.total_amount).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end">
          <p className="text-lg font-bold">
            Totale documento: €{Number(inv.total_amount).toFixed(2)}
          </p>
        </div>

        {inv.payment_method && (
          <p className="text-sm">
            Modalità di pagamento: {optionLabel(PAYMENT_METHODS, inv.payment_method)}
            {seller?.iban ? ` — IBAN: ${seller.iban}` : ""}
          </p>
        )}

        {inv.legal_note && (
          <p className="border-t border-gray-200 pt-4 text-xs text-gray-600">
            {inv.legal_note}
          </p>
        )}

        <p className="border-t border-gray-200 pt-4 text-xs text-gray-400">
          Documento generato dall&apos;app, non trasmesso al Sistema di
          Interscambio (SdI). Non costituisce fattura elettronica.
        </p>
      </div>
    </div>
  );
}
