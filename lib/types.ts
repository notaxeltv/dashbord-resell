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
  owner_id: string;
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
  related_card_id: string | null;
  related_purchase_id: string | null;
  related_sale_id: string | null;
  created_by: string;
  created_at: string;
}
