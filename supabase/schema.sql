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
-- Fine script.
-- ============================================================================
