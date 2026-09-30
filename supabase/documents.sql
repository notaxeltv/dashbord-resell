-- ============================================================================
-- Fatture di vendita e ricevute di acquisto (esegui questo script nel SQL
-- Editor di Supabase se hai già un progetto esistente e non vuoi rieseguire
-- schema.sql per intero).
--
-- Aggiunge:
-- - business_profile: dati del venditore (ragione sociale, P.IVA, regime)
--   usati come intestazione dei documenti.
-- - invoices: fatture di vendita emesse a clienti con partita IVA.
-- - purchase_receipts: ricevute di acquisto da privati.
--
-- Documenti generati e stampabili dall'app, NON trasmessi allo SdI: per
-- l'obbligo di fatturazione elettronica usa un software abilitato.
-- ============================================================================

create table if not exists public.business_profile (
  id uuid primary key default gen_random_uuid(),
  legal_name text not null default '',
  tax_regime text not null default 'forfettario'
    check (tax_regime in ('forfettario', 'ordinario')),
  vat_number text,
  tax_code text,
  address text,
  iban text,
  notes text,
  updated_by uuid references public.profiles (id) on delete set null,
  updated_at timestamptz not null default now()
);

comment on table public.business_profile is
  'Dati del venditore (ragione sociale, P.IVA, regime fiscale) usati come intestazione di fatture e ricevute. Una sola riga in uso.';

create or replace function public.set_business_profile_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists business_profile_set_actor on public.business_profile;
create trigger business_profile_set_actor
  before insert or update on public.business_profile
  for each row
  execute function public.set_business_profile_actor();

create table if not exists public.invoices (
  id uuid primary key default gen_random_uuid(),
  number integer not null,
  year integer not null,
  issue_date date not null default current_date,
  sale_id uuid references public.sales (id) on delete set null,
  client_name text not null,
  client_vat_number text,
  client_tax_code text,
  client_address text,
  client_sdi_code text,
  client_pec text,
  description text not null,
  taxable_amount numeric(10, 2) not null default 0,
  vat_rate numeric(5, 2) not null default 0,
  vat_amount numeric(10, 2) not null default 0,
  total_amount numeric(10, 2) not null default 0,
  payment_method text,
  legal_note text,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (year, number)
);

comment on table public.invoices is
  'Fatture di vendita emesse a clienti con partita IVA (documento generato e stampabile dall''app, non trasmesso allo SdI: per l''obbligo di fatturazione elettronica usa un software abilitato).';

create index if not exists invoices_sale_id_idx on public.invoices (sale_id);
create index if not exists invoices_year_number_idx on public.invoices (year, number);

create table if not exists public.purchase_receipts (
  id uuid primary key default gen_random_uuid(),
  number integer not null,
  year integer not null,
  issue_date date not null default current_date,
  purchase_id uuid references public.purchases (id) on delete set null,
  card_id uuid references public.cards (id) on delete set null,
  seller_name text not null,
  seller_tax_code text,
  seller_address text,
  seller_id_document text,
  description text not null,
  amount numeric(10, 2) not null default 0,
  payment_method text,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (year, number)
);

comment on table public.purchase_receipts is
  'Ricevute di acquisto da privati: autodichiarazione del venditore privato, utile per documentare il costo in contabilità.';

create index if not exists purchase_receipts_purchase_id_idx on public.purchase_receipts (purchase_id);
create index if not exists purchase_receipts_year_number_idx on public.purchase_receipts (year, number);

alter table public.business_profile enable row level security;
alter table public.invoices enable row level security;
alter table public.purchase_receipts enable row level security;

-- business_profile
drop policy if exists "business_profile_select_authenticated" on public.business_profile;
create policy "business_profile_select_authenticated" on public.business_profile
  for select to authenticated using (true);

drop policy if exists "business_profile_insert_authenticated" on public.business_profile;
create policy "business_profile_insert_authenticated" on public.business_profile
  for insert to authenticated with check (true);

drop policy if exists "business_profile_update_authenticated" on public.business_profile;
create policy "business_profile_update_authenticated" on public.business_profile
  for update to authenticated using (true) with check (true);

drop policy if exists "business_profile_delete_authenticated" on public.business_profile;
create policy "business_profile_delete_authenticated" on public.business_profile
  for delete to authenticated using (true);

-- invoices
drop policy if exists "invoices_select_authenticated" on public.invoices;
create policy "invoices_select_authenticated" on public.invoices
  for select to authenticated using (true);

drop policy if exists "invoices_insert_authenticated" on public.invoices;
create policy "invoices_insert_authenticated" on public.invoices
  for insert to authenticated with check (true);

drop policy if exists "invoices_update_authenticated" on public.invoices;
create policy "invoices_update_authenticated" on public.invoices
  for update to authenticated using (true) with check (true);

drop policy if exists "invoices_delete_authenticated" on public.invoices;
create policy "invoices_delete_authenticated" on public.invoices
  for delete to authenticated using (true);

-- purchase_receipts
drop policy if exists "purchase_receipts_select_authenticated" on public.purchase_receipts;
create policy "purchase_receipts_select_authenticated" on public.purchase_receipts
  for select to authenticated using (true);

drop policy if exists "purchase_receipts_insert_authenticated" on public.purchase_receipts;
create policy "purchase_receipts_insert_authenticated" on public.purchase_receipts
  for insert to authenticated with check (true);

drop policy if exists "purchase_receipts_update_authenticated" on public.purchase_receipts;
create policy "purchase_receipts_update_authenticated" on public.purchase_receipts
  for update to authenticated using (true) with check (true);

drop policy if exists "purchase_receipts_delete_authenticated" on public.purchase_receipts;
create policy "purchase_receipts_delete_authenticated" on public.purchase_receipts
  for delete to authenticated using (true);

-- Estende il registro attività (log_row_activity, vedi supabase/activity_log.sql)
-- anche a fatture e ricevute.
create or replace function public.log_row_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  rec_id uuid;
  label text;
  verb text;
  card_name text;
begin
  if tg_op = 'DELETE' then
    rec_id := old.id;
  else
    rec_id := new.id;
  end if;

  if tg_op = 'INSERT' then
    verb := 'Ha creato';
  elsif tg_op = 'UPDATE' then
    verb := 'Ha modificato';
  else
    verb := 'Ha eliminato';
  end if;

  if tg_table_name = 'cards' then
    label := verb || ' la carta «' || coalesce(new.name, old.name, '?') || '»';
    if tg_op = 'UPDATE' and old.status is distinct from new.status then
      label := label || ' (stato: ' || old.status || ' → ' || new.status || ')';
    end if;
  elsif tg_table_name = 'purchases' then
    label := verb || ' un lotto (' || coalesce(new.source, old.source, '?')
      || ', €' || trim(to_char(coalesce(new.total_amount, old.total_amount, 0), 'FM999999990.00')) || ')';
  elsif tg_table_name = 'sales' then
    select c.name into card_name
    from public.cards c
    where c.id = coalesce(new.card_id, old.card_id);
    label := verb || ' una vendita'
      || case when card_name is not null then ' di «' || card_name || '»' else '' end
      || ' (€' || trim(to_char(coalesce(new.sale_price, old.sale_price, 0), 'FM999999990.00')) || ')';
  elsif tg_table_name = 'transactions' then
    label := verb || ' un movimento extra ('
      || case coalesce(new.type, old.type) when 'income' then 'entrata' else 'uscita' end
      || ', €' || trim(to_char(coalesce(new.amount, old.amount, 0), 'FM999999990.00')) || ')';
  elsif tg_table_name = 'invoices' then
    label := verb || ' la fattura n. ' || coalesce(new.number, old.number) || '/' || coalesce(new.year, old.year)
      || ' a ' || coalesce(new.client_name, old.client_name, '?')
      || ' (€' || trim(to_char(coalesce(new.total_amount, old.total_amount, 0), 'FM999999990.00')) || ')';
  elsif tg_table_name = 'purchase_receipts' then
    label := verb || ' la ricevuta n. ' || coalesce(new.number, old.number) || '/' || coalesce(new.year, old.year)
      || ' da ' || coalesce(new.seller_name, old.seller_name, '?')
      || ' (€' || trim(to_char(coalesce(new.amount, old.amount, 0), 'FM999999990.00')) || ')';
  else
    label := verb || ' un record';
  end if;

  insert into public.activity_log (actor_id, action, entity_type, entity_id, summary)
  values (
    actor,
    lower(tg_op),
    case tg_table_name
      when 'cards' then 'card'
      when 'purchases' then 'purchase'
      when 'sales' then 'sale'
      when 'transactions' then 'transaction'
      when 'invoices' then 'invoice'
      when 'purchase_receipts' then 'purchase_receipt'
      else tg_table_name
    end,
    rec_id,
    label
  );

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists invoices_activity_log on public.invoices;
create trigger invoices_activity_log
  after insert or update or delete on public.invoices
  for each row
  execute function public.log_row_activity();

drop trigger if exists purchase_receipts_activity_log on public.purchase_receipts;
create trigger purchase_receipts_activity_log
  after insert or update or delete on public.purchase_receipts
  for each row
  execute function public.log_row_activity();
