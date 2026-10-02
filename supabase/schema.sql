-- ============================================================================
-- Pokémon Card Manager — Schema Supabase completo
-- Esegui questo intero script nel SQL Editor di Supabase (Project > SQL Editor)
-- su un progetto Postgres vuoto. Lo script è idempotente dove possibile.
-- ============================================================================

create extension if not exists "pgcrypto";

-- ============================================================================
-- 1. TABELLA profiles
-- Estende auth.users con dati applicativi (display name, ruolo).
-- ============================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'member',
  created_at timestamptz not null default now()
);

comment on table public.profiles is
  'Profilo applicativo di ogni utente autenticato (1:1 con auth.users).';

-- ============================================================================
-- 2. TABELLA cards
-- Inventario delle singole carte Pokémon.
-- ============================================================================

create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  set_name text,
  set_code text,
  number text,
  language text not null default 'ITA',
  condition text not null default 'NM'
    check (condition in ('NM', 'EX', 'GD', 'LP', 'P')),
  is_foil boolean not null default false,
  is_japanese boolean not null default false,
  purchase_price numeric(10, 2),
  purchase_date date,
  purchase_source text
    check (purchase_source is null or purchase_source in ('vinted', 'cardmarket', 'privato', 'lotto', 'altro')),
  target_price numeric(10, 2),
  current_market_price numeric(10, 2),
  status text not null default 'in_stock'
    check (status in ('in_stock', 'listed', 'sold', 'reserved')),
  notes text,
  image_url text,
  rarity text,
  reverse_style text,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.cards is 'Inventario delle carte Pokémon in gestione.';

create index if not exists cards_owner_id_idx on public.cards (owner_id);
create index if not exists cards_status_idx on public.cards (status);

-- ============================================================================
-- 3. TABELLA purchases
-- Storico degli acquisti (lotti, singole carte, ecc.).
-- ============================================================================

create table if not exists public.purchases (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  source text not null,
  total_amount numeric(10, 2) not null default 0,
  shipping_cost numeric(10, 2) not null default 0,
  notes text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.purchases is 'Storico degli acquisti effettuati dal team.';

create index if not exists purchases_created_by_idx on public.purchases (created_by);

alter table public.cards
  add column if not exists purchase_id uuid references public.purchases (id) on delete set null;

create index if not exists cards_purchase_id_idx on public.cards (purchase_id);

-- ============================================================================
-- 4. TABELLA sales
-- Storico delle vendite, collegate a una carta dell'inventario.
-- net_amount è calcolato automaticamente: prezzo vendita + spedizione
-- rimborsata dal compratore - fee del marketplace.
-- ============================================================================

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  card_id uuid not null references public.cards (id) on delete restrict,
  marketplace text not null default 'cardmarket',
  sale_price numeric(10, 2) not null default 0,
  shipping_paid_by_buyer numeric(10, 2) not null default 0,
  fees numeric(10, 2) not null default 0,
  net_amount numeric(12, 2) generated always as
    (sale_price + shipping_paid_by_buyer - fees) stored,
  sale_date date not null default current_date,
  buyer_info text,
  notes text,
  sold_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.sales is 'Storico delle vendite di carte dell''inventario.';

create index if not exists sales_sold_by_idx on public.sales (sold_by);

do $$
begin
  if not exists (
    select 1 from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relname = 'sales_one_per_card_idx'
      and n.nspname = 'public'
  ) and not exists (
    select card_id from public.sales group by card_id having count(*) > 1
  ) then
    create unique index sales_one_per_card_idx on public.sales (card_id);
  end if;
end;
$$;

-- ============================================================================
-- 5. TABELLA transactions (opzionale)
-- Movimenti economici generici, collegabili a carte/acquisti/vendite.
-- ============================================================================

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('income', 'expense')),
  amount numeric(10, 2) not null,
  description text,
  date date not null default current_date,
  related_card_id uuid references public.cards (id) on delete set null,
  related_purchase_id uuid references public.purchases (id) on delete set null,
  related_sale_id uuid references public.sales (id) on delete set null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now()
);

comment on table public.transactions is
  'Movimenti economici generici (opzionale), utile per spese extra non legate a una singola carta.';

create index if not exists transactions_created_by_idx on public.transactions (created_by);

-- ============================================================================
-- 6. TRIGGER: aggiorna updated_at su cards ad ogni UPDATE
-- ============================================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists cards_set_updated_at on public.cards;

create trigger cards_set_updated_at
  before update on public.cards
  for each row
  execute function public.set_updated_at();

-- ============================================================================
-- 6b. TRIGGER: allinea lo stato della carta alle vendite
-- ============================================================================

create or replace function public.handle_sale_insert()
returns trigger
language plpgsql
as $$
begin
  update public.cards
    set status = 'sold'
    where id = new.card_id;
  return new;
end;
$$;

drop trigger if exists sales_after_insert_set_sold on public.sales;

create trigger sales_after_insert_set_sold
  after insert on public.sales
  for each row
  execute function public.handle_sale_insert();

create or replace function public.handle_sale_delete()
returns trigger
language plpgsql
as $$
begin
  update public.cards
    set status = 'in_stock'
    where id = old.card_id
      and status = 'sold'
      and not exists (
        select 1 from public.sales s
        where s.card_id = old.card_id
          and s.id <> old.id
      );
  return old;
end;
$$;

drop trigger if exists sales_after_delete_restore_status on public.sales;

create trigger sales_after_delete_restore_status
  after delete on public.sales
  for each row
  execute function public.handle_sale_delete();

create or replace function public.guard_card_sold_status()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'sold'
     and (tg_op = 'INSERT' or old.status is distinct from 'sold')
     and not exists (select 1 from public.sales where card_id = new.id)
  then
    raise exception 'Per marcare una carta come venduta registra una vendita.';
  end if;

  if tg_op = 'UPDATE'
     and old.status = 'sold'
     and new.status is distinct from 'sold'
     and exists (select 1 from public.sales where card_id = new.id)
  then
    raise exception 'Elimina prima la vendita collegata a questa carta.';
  end if;

  return new;
end;
$$;

drop trigger if exists cards_guard_sold_status on public.cards;

create trigger cards_guard_sold_status
  before insert or update of status on public.cards
  for each row
  execute function public.guard_card_sold_status();

-- ============================================================================
-- 7. TRIGGER: crea automaticamente un profilo quando viene creato un nuovo
-- utente in auth.users (es. dopo un invito via email da Supabase Auth).
-- ============================================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'member'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- ============================================================================
-- 8. ROW LEVEL SECURITY
-- Policy semplici: qualsiasi utente autenticato può leggere/scrivere su tutte
-- le tabelle. Adatto a un piccolo team (2+ socie/i) con fiducia reciproca,
-- senza ruoli complessi.
-- ============================================================================

alter table public.profiles enable row level security;
alter table public.cards enable row level security;
alter table public.purchases enable row level security;
alter table public.sales enable row level security;
alter table public.transactions enable row level security;

-- profiles
drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated" on public.profiles
  for select to authenticated using (true);

drop policy if exists "profiles_insert_authenticated" on public.profiles;
create policy "profiles_insert_authenticated" on public.profiles
  for insert to authenticated with check (true);

drop policy if exists "profiles_update_authenticated" on public.profiles;
create policy "profiles_update_authenticated" on public.profiles
  for update to authenticated using (true) with check (true);

drop policy if exists "profiles_delete_authenticated" on public.profiles;
create policy "profiles_delete_authenticated" on public.profiles
  for delete to authenticated using (true);

-- cards
drop policy if exists "cards_select_authenticated" on public.cards;
create policy "cards_select_authenticated" on public.cards
  for select to authenticated using (true);

drop policy if exists "cards_insert_authenticated" on public.cards;
create policy "cards_insert_authenticated" on public.cards
  for insert to authenticated with check (true);

drop policy if exists "cards_update_authenticated" on public.cards;
create policy "cards_update_authenticated" on public.cards
  for update to authenticated using (true) with check (true);

drop policy if exists "cards_delete_authenticated" on public.cards;
create policy "cards_delete_authenticated" on public.cards
  for delete to authenticated using (true);

-- purchases
drop policy if exists "purchases_select_authenticated" on public.purchases;
create policy "purchases_select_authenticated" on public.purchases
  for select to authenticated using (true);

drop policy if exists "purchases_insert_authenticated" on public.purchases;
create policy "purchases_insert_authenticated" on public.purchases
  for insert to authenticated with check (true);

drop policy if exists "purchases_update_authenticated" on public.purchases;
create policy "purchases_update_authenticated" on public.purchases
  for update to authenticated using (true) with check (true);

drop policy if exists "purchases_delete_authenticated" on public.purchases;
create policy "purchases_delete_authenticated" on public.purchases
  for delete to authenticated using (true);

-- sales
drop policy if exists "sales_select_authenticated" on public.sales;
create policy "sales_select_authenticated" on public.sales
  for select to authenticated using (true);

drop policy if exists "sales_insert_authenticated" on public.sales;
create policy "sales_insert_authenticated" on public.sales
  for insert to authenticated with check (true);

drop policy if exists "sales_update_authenticated" on public.sales;
create policy "sales_update_authenticated" on public.sales
  for update to authenticated using (true) with check (true);

drop policy if exists "sales_delete_authenticated" on public.sales;
create policy "sales_delete_authenticated" on public.sales
  for delete to authenticated using (true);

-- transactions
drop policy if exists "transactions_select_authenticated" on public.transactions;
create policy "transactions_select_authenticated" on public.transactions
  for select to authenticated using (true);

drop policy if exists "transactions_insert_authenticated" on public.transactions;
create policy "transactions_insert_authenticated" on public.transactions
  for insert to authenticated with check (true);

drop policy if exists "transactions_update_authenticated" on public.transactions;
create policy "transactions_update_authenticated" on public.transactions
  for update to authenticated using (true) with check (true);

drop policy if exists "transactions_delete_authenticated" on public.transactions;
create policy "transactions_delete_authenticated" on public.transactions
  for delete to authenticated using (true);

-- ============================================================================
-- 9. MIGRAZIONI IDEMPOTENTI (progetti già esistenti)
-- ============================================================================

alter table public.cards
  add column if not exists image_url text;

alter table public.cards add column if not exists rarity text;
alter table public.cards add column if not exists reverse_style text;

alter table public.transactions
  add column if not exists date date;

update public.transactions
  set date = created_at::date
  where date is null;

alter table public.transactions
  alter column date set default current_date;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'transactions'
      and column_name = 'date'
      and is_nullable = 'YES'
  ) then
    alter table public.transactions alter column date set not null;
  end if;
end;
$$;

alter table public.sales drop constraint if exists sales_card_id_fkey;
alter table public.sales
  add constraint sales_card_id_fkey
  foreign key (card_id) references public.cards (id) on delete restrict;

-- ============================================================================
-- 10. REGISTRO ATTIVITÀ
-- ============================================================================

alter table public.cards
  add column if not exists updated_by uuid references public.profiles (id) on delete set null;

create index if not exists cards_updated_by_idx on public.cards (updated_by);

create table if not exists public.activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  summary text not null
);

comment on table public.activity_log is
  'Registro delle azioni del team sulla dashboard (chi ha fatto cosa).';

create index if not exists activity_log_created_at_idx
  on public.activity_log (created_at desc);

create index if not exists activity_log_actor_id_idx
  on public.activity_log (actor_id);

create or replace function public.set_card_actor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    new.updated_by := coalesce(auth.uid(), new.owner_id);
  else
    new.updated_by := coalesce(auth.uid(), new.updated_by, new.owner_id);
  end if;
  return new;
end;
$$;

drop trigger if exists cards_set_actor on public.cards;

create trigger cards_set_actor
  before insert or update on public.cards
  for each row
  execute function public.set_card_actor();

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

drop trigger if exists cards_activity_log on public.cards;
create trigger cards_activity_log
  after insert or update or delete on public.cards
  for each row
  execute function public.log_row_activity();

drop trigger if exists purchases_activity_log on public.purchases;
create trigger purchases_activity_log
  after insert or update or delete on public.purchases
  for each row
  execute function public.log_row_activity();

drop trigger if exists sales_activity_log on public.sales;
create trigger sales_activity_log
  after insert or update or delete on public.sales
  for each row
  execute function public.log_row_activity();

drop trigger if exists transactions_activity_log on public.transactions;
create trigger transactions_activity_log
  after insert or update or delete on public.transactions
  for each row
  execute function public.log_row_activity();

alter table public.activity_log enable row level security;

drop policy if exists "activity_log_select_authenticated" on public.activity_log;
create policy "activity_log_select_authenticated" on public.activity_log
  for select to authenticated using (true);

drop policy if exists "activity_log_insert_authenticated" on public.activity_log;
create policy "activity_log_insert_authenticated" on public.activity_log
  for insert to authenticated with check (actor_id = auth.uid());

-- La cancellazione del registro non è consentita dal client.
-- Passa da request/confirm_activity_delete (vedi anche supabase/activity_delete.sql).

create table if not exists public.activity_delete_challenges (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references public.profiles (id) on delete cascade,
  code_a_hash text not null,
  code_b_hash text not null,
  email_a text not null,
  email_b text not null,
  target_ids uuid[],
  attempts integer not null default 0,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.activity_delete_challenges enable row level security;

create or replace function public.request_activity_delete(
  p_code_a_hash text,
  p_code_b_hash text,
  p_email_a text,
  p_email_b text,
  p_target_ids uuid[]
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  new_id uuid;
begin
  if uid is null then
    raise exception 'Sessione non valida';
  end if;

  if exists (
    select 1
    from public.activity_delete_challenges
    where created_by = uid
      and consumed_at is null
      and created_at > now() - interval '60 seconds'
  ) then
    raise exception 'Attendi un minuto prima di richiedere nuove chiavi';
  end if;

  insert into public.activity_delete_challenges (
    created_by, code_a_hash, code_b_hash, email_a, email_b, target_ids, expires_at
  )
  values (
    uid, p_code_a_hash, p_code_b_hash, p_email_a, p_email_b, p_target_ids,
    now() + interval '10 minutes'
  )
  returning id into new_id;

  return new_id;
end;
$$;

create or replace function public.cancel_activity_delete(p_challenge_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.activity_delete_challenges
  set consumed_at = now()
  where id = p_challenge_id
    and created_by = auth.uid()
    and consumed_at is null;
end;
$$;

create or replace function public.confirm_activity_delete(
  p_challenge_id uuid,
  p_code_a_hash text,
  p_code_b_hash text
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ch public.activity_delete_challenges%rowtype;
  removed integer := 0;
begin
  if uid is null then
    raise exception 'Sessione non valida';
  end if;

  select * into ch
  from public.activity_delete_challenges
  where id = p_challenge_id
  for update;

  if not found or ch.created_by <> uid then
    raise exception 'Richiesta non valida';
  end if;

  if ch.consumed_at is not null or ch.expires_at < now() then
    raise exception 'Chiavi scadute o già usate. Richiedine di nuove';
  end if;

  if ch.code_a_hash is distinct from p_code_a_hash
     or ch.code_b_hash is distinct from p_code_b_hash then
    update public.activity_delete_challenges
    set
      attempts = ch.attempts + 1,
      consumed_at = case when ch.attempts + 1 >= 5 then now() else consumed_at end
    where id = ch.id;

    if ch.attempts + 1 >= 5 then
      raise exception 'Troppi tentativi: richiedi nuove chiavi';
    end if;

    raise exception 'Chiavi non corrette';
  end if;

  if ch.target_ids is null then
    delete from public.activity_log where true;
  else
    delete from public.activity_log where id = any (ch.target_ids);
  end if;

  get diagnostics removed = row_count;

  update public.activity_delete_challenges
  set consumed_at = now()
  where id = ch.id;

  insert into public.activity_log (actor_id, action, entity_type, summary)
  values (
    uid,
    'delete',
    'session',
    'Ha eliminato ' || removed || case when removed = 1 then ' voce' else ' voci' end
      || ' del registro con doppia chiave'
  );

  return removed;
end;
$$;

revoke all on function public.request_activity_delete(text, text, text, text, uuid[]) from public;
revoke all on function public.request_activity_delete(text, text, text, text, uuid[]) from anon;
grant execute on function public.request_activity_delete(text, text, text, text, uuid[]) to authenticated;

revoke all on function public.cancel_activity_delete(uuid) from public;
revoke all on function public.cancel_activity_delete(uuid) from anon;
grant execute on function public.cancel_activity_delete(uuid) to authenticated;

revoke all on function public.confirm_activity_delete(uuid, text, text) from public;
revoke all on function public.confirm_activity_delete(uuid, text, text) from anon;
grant execute on function public.confirm_activity_delete(uuid, text, text) to authenticated;

-- ============================================================================
-- 11. FATTURE DI VENDITA E RICEVUTE DI ACQUISTO
-- Documenti generati e stampabili dall'app (non trasmessi allo SdI):
-- fatture per vendite a clienti con partita IVA, ricevute per acquisti da
-- privati. Vedi anche supabase/documents.sql per installarli separatamente
-- su un progetto già esistente.
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

-- Estende il registro attività (log_row_activity, vedi sezione 10) anche a
-- fatture e ricevute.
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

-- ============================================================================
-- Fine script.
-- ============================================================================
