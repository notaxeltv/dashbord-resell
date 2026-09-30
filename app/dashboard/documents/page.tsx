import { FileText, Receipt } from "lucide-react";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { BusinessProfileForm } from "@/components/documents/business-profile-form";
import { InvoicesBrowser } from "@/components/documents/invoices-browser";
import { ReceiptsBrowser } from "@/components/documents/receipts-browser";
import type { SaleOption } from "@/components/documents/invoice-dialog";
import type { PurchaseOptionForReceipt } from "@/components/documents/receipt-dialog";
import type {
  BusinessProfile,
  Invoice,
  Profile,
  PurchaseReceipt,
} from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  const supabase = await createSupabaseServerClient();

  const [
    { data: businessProfileRows },
    { data: invoices, error: invoicesError },
    { data: receipts, error: receiptsError },
    { data: profiles },
    { data: sales },
    { data: cards },
    { data: purchases },
  ] = await Promise.all([
    supabase.from("business_profile").select("*").limit(1),
    supabase.from("invoices").select("*").order("year", { ascending: false }).order("number", { ascending: false }),
    supabase
      .from("purchase_receipts")
      .select("*")
      .order("year", { ascending: false })
      .order("number", { ascending: false }),
    supabase.from("profiles").select("id, email, display_name, role, created_at"),
    supabase.from("sales").select("id, sale_date, sale_price, net_amount, buyer_info, card_id"),
    supabase.from("cards").select("id, name"),
    supabase.from("purchases").select("id, date, source, total_amount").eq("source", "privato"),
  ]);

  const businessProfile = (businessProfileRows?.[0] ?? null) as BusinessProfile | null;
  const invoiceList = (invoices ?? []) as Invoice[];
  const receiptList = (receipts ?? []) as PurchaseReceipt[];
  const profileList = (profiles ?? []) as Profile[];

  const cardMap = new Map((cards ?? []).map((card) => [card.id as string, card.name as string]));
  const invoicedSaleIds = new Set(invoiceList.map((invoice) => invoice.sale_id).filter(Boolean));
  const saleOptions: SaleOption[] = (sales ?? [])
    .filter((sale) => !invoicedSaleIds.has(sale.id as string))
    .map((sale) => ({
      id: sale.id as string,
      sale_date: sale.sale_date as string,
      sale_price: Number(sale.sale_price),
      net_amount: Number(sale.net_amount),
      buyer_info: sale.buyer_info as string | null,
      card_name: cardMap.get(sale.card_id as string) ?? null,
    }));

  const receiptedPurchaseIds = new Set(
    receiptList.map((receipt) => receipt.purchase_id).filter(Boolean),
  );
  const purchaseOptions: PurchaseOptionForReceipt[] = (purchases ?? [])
    .filter((purchase) => !receiptedPurchaseIds.has(purchase.id as string))
    .map((purchase) => ({
      id: purchase.id as string,
      date: purchase.date as string,
      source: purchase.source as string,
      total_amount: Number(purchase.total_amount),
    }));

  const currentYear = new Date().getFullYear();
  const invoicedThisYear = invoiceList
    .filter((invoice) => invoice.year === currentYear)
    .reduce((sum, invoice) => sum + Number(invoice.total_amount), 0);
  const receiptedThisYear = receiptList
    .filter((receipt) => receipt.year === currentYear)
    .reduce((sum, receipt) => sum + Number(receipt.amount), 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fatture e ricevute</h1>
        <p className="text-sm text-muted-foreground">
          Documenti stampabili per vendite a clienti con partita IVA e per
          acquisti da privati. Non sono fatture elettroniche trasmesse allo
          SdI: se sei obbligata/o alla fatturazione elettronica usa un
          software abilitato e considera questi come promemoria interni.
        </p>
      </div>

      {(invoicesError || receiptsError) && (
        <p className="rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/50 dark:text-red-300">
          Errore: {invoicesError?.message ?? receiptsError?.message}
          {" — probabilmente le tabelle non esistono ancora: esegui "}
          <code>supabase/documents.sql</code> nel SQL Editor di Supabase.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <KpiCard
          label="Fatture emesse"
          value={invoiceList.length}
          accent="violet"
          icon={FileText}
        />
        <KpiCard
          label={`Fatturato ${currentYear}`}
          value={`€${invoicedThisYear.toFixed(2)}`}
          accent="gold"
          icon={FileText}
        />
        <KpiCard
          label="Ricevute emesse"
          value={receiptList.length}
          accent="magenta"
          icon={Receipt}
        />
        <KpiCard
          label={`Acquisti da privati ${currentYear}`}
          value={`€${receiptedThisYear.toFixed(2)}`}
          accent="emerald"
          icon={Receipt}
        />
      </div>

      <BusinessProfileForm profile={businessProfile} />

      <Card>
        <CardHeader>
          <CardTitle>Fatture di vendita</CardTitle>
        </CardHeader>
        <CardContent>
          <InvoicesBrowser
            invoices={invoiceList}
            profiles={profileList}
            saleOptions={saleOptions}
            businessProfile={businessProfile}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Ricevute di acquisto da privati</CardTitle>
        </CardHeader>
        <CardContent>
          <ReceiptsBrowser
            receipts={receiptList}
            profiles={profileList}
            purchaseOptions={purchaseOptions}
          />
        </CardContent>
      </Card>
    </div>
  );
}
