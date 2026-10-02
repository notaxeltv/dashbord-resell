-- Cancellazione del registro solo con due chiavi (una per email).
-- Esegui nel SQL Editor se activity_log esiste già.

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
    created_by,
    code_a_hash,
    code_b_hash,
    email_a,
    email_b,
    target_ids,
    expires_at
  )
  values (
    uid,
    p_code_a_hash,
    p_code_b_hash,
    p_email_a,
    p_email_b,
    p_target_ids,
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

  select *
  into ch
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
    delete from public.activity_log
    where id = any (ch.target_ids);
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
    'Ha eliminato '
      || removed
      || case when removed = 1 then ' voce' else ' voci' end
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
