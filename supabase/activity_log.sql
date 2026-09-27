-- ============================================================================
-- Registro attività (esegui questo script nel SQL Editor di Supabase)
-- Traccia chi crea, modifica o elimina carte, lotti, vendite e movimenti.
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
