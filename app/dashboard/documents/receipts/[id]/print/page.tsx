import { notFound } from "next/navigation";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/documents/print-button";
import { formatISODate } from "@/lib/dates";
import { optionLabel, PAYMENT_METHODS } from "@/lib/constants";
import type { BusinessProfile, PurchaseReceipt } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ReceiptPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const [{ data: receipt }, { data: profileRows }] = await Promise.all([
    supabase.from("purchase_receipts").select("*").eq("id", id).single(),
    supabase.from("business_profile").select("*").limit(1),
  ]);

  if (!receipt) notFound();

  const rec = receipt as PurchaseReceipt;
  const buyer = (profileRows?.[0] ?? null) as BusinessProfile | null;

  return (
    <div className="mx-auto max-w-3xl bg-white p-8 text-black print:p-0">
      <div className="mb-6 flex justify-end print:hidden">
        <PrintButton />
      </div>

      <div className="space-y-6 rounded-lg border border-gray-300 p-8 print:border-0 print:p-0">
        <div className="border-b border-gray-300 pb-4">
          <h1 className="text-2xl font-bold">Ricevuta di acquisto da privato</h1>
          <p className="text-sm text-gray-600">
            n. {rec.number}/{rec.year} del {formatISODate(rec.issue_date)}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="text-xs uppercase text-gray-500">Venditore (privato)</p>
            <p className="font-semibold">{rec.seller_name}</p>
            {rec.seller_tax_code && <p>CF: {rec.seller_tax_code}</p>}
            {rec.seller_address && <p>{rec.seller_address}</p>}
            {rec.seller_id_document && <p>Documento: {rec.seller_id_document}</p>}
          </div>
          <div>
            <p className="text-xs uppercase text-gray-500">Acquirente</p>
            <p className="font-semibold">{buyer?.legal_name ?? "—"}</p>
            {buyer?.vat_number && <p>P.IVA: {buyer.vat_number}</p>}
            {buyer?.tax_code && <p>CF: {buyer.tax_code}</p>}
            {buyer?.address && <p>{buyer.address}</p>}
          </div>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th className="py-2">Descrizione</th>
              <th className="py-2 text-right">Importo</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-3">{rec.description}</td>
              <td className="py-3 text-right">€{Number(rec.amount).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div className="flex justify-end">
          <p className="text-lg font-bold">
            Totale: €{Number(rec.amount).toFixed(2)}
          </p>
        </div>

        {rec.payment_method && (
          <p className="text-sm">
            Modalità di pagamento: {optionLabel(PAYMENT_METHODS, rec.payment_method)}
          </p>
        )}

        <p className="border-t border-gray-200 pt-4 text-xs text-gray-600">
          Il venditore dichiara sotto la propria responsabilità di aver
          posseduto il bene sopra descritto in qualità di privato, e di
          averlo venduto all&apos;acquirente per l&apos;importo indicato.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-6 text-sm">
          <div>
            <div className="border-t border-gray-400 pt-1">Firma del venditore</div>
          </div>
          <div>
            <div className="border-t border-gray-400 pt-1">Firma dell&apos;acquirente</div>
          </div>
        </div>

        <p className="border-t border-gray-200 pt-4 text-xs text-gray-400">
          Documento generato dall&apos;app come autodichiarazione di acquisto
          da privato: utile per la contabilità interna, non costituisce
          fattura.
        </p>
      </div>
    </div>
  );
}
