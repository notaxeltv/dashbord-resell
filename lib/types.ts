export type CardStatus = "in_stock" | "listed" | "sold" | "reserved";
export type CardCondition = "NM" | "EX" | "GD" | "LP" | "P";

export interface Profile {
  id: string;
  email: string;
  display_name: string | null;
  role: string;
  created_at: string;
}

export interface Card {
  id: string;
  name: string;
  set_name: string | null;
  set_code: string | null;
  number: string | null;
  language: string;
  condition: CardCondition | string;
  is_foil: boolean;
  is_japanese: boolean;
  purchase_price: number | null;
  purchase_date: string | null;
  purchase_source: string | null;
  target_price: number | null;
  current_market_price: number | null;
  status: CardStatus;
  notes: string | null;
  image_url: string | null;
  purchase_id: string | null;
  owner_id: string;
  updated_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Purchase {
  id: string;
  date: string;
  source: string;
  total_amount: number;
  shipping_cost: number;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface Sale {
  id: string;
  card_id: string;
  marketplace: string;
  sale_price: number;
  shipping_paid_by_buyer: number;
  fees: number;
  net_amount: number;
  sale_date: string;
  buyer_info: string | null;
  notes: string | null;
  sold_by: string;
  created_at: string;
}

export type TransactionType = "income" | "expense";

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string | null;
  date: string;
  related_card_id: string | null;
  related_purchase_id: string | null;
  related_sale_id: string | null;
  created_by: string;
  created_at: string;
}

export interface PurchaseOption {
  id: string;
  date: string;
  source: string;
  total_amount: number;
}

export interface ActivityLog {
  id: string;
  created_at: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  summary: string;
}

export type TaxRegime = "forfettario" | "ordinario";

export interface BusinessProfile {
  id: string;
  legal_name: string;
  tax_regime: TaxRegime | string;
  vat_number: string | null;
  tax_code: string | null;
  address: string | null;
  iban: string | null;
  notes: string | null;
  updated_by: string | null;
  updated_at: string;
}

export interface Invoice {
  id: string;
  number: number;
  year: number;
  issue_date: string;
  sale_id: string | null;
  client_name: string;
  client_vat_number: string | null;
  client_tax_code: string | null;
  client_address: string | null;
  client_sdi_code: string | null;
  client_pec: string | null;
  description: string;
  taxable_amount: number;
  vat_rate: number;
  vat_amount: number;
  total_amount: number;
  payment_method: string | null;
  legal_note: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}

export interface PurchaseReceipt {
  id: string;
  number: number;
  year: number;
  issue_date: string;
  purchase_id: string | null;
  card_id: string | null;
  seller_name: string;
  seller_tax_code: string | null;
  seller_address: string | null;
  seller_id_document: string | null;
  description: string;
  amount: number;
  payment_method: string | null;
  notes: string | null;
  created_by: string;
  created_at: string;
}
