-- Round 2 Part A: Interactive Live (speak requests / invites / roles)
-- Authoritative participant state lives in Postgres; clients cannot self-promote.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table if not exists public.live_interactions (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  mode text not null check (mode in ('audio', 'audio_video')),
  origin text not null check (origin in ('request', 'invite')),
  status text not null check (
    status in (
      'pending',
      'accepted',
      'active',
      'rejected',
      'cancelled',
      'expired',
      'ended'
    )
  ),
  participant_role text check (
    participant_role is null
    or participant_role in ('speaker', 'cohost')
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  expires_at timestamptz,
  responded_at timestamptz,
  ended_at timestamptz
);

create index if not exists live_interactions_live_id_idx
  on public.live_interactions (live_id);

create index if not exists live_interactions_user_id_idx
  on public.live_interactions (user_id);

create index if not exists live_interactions_live_status_idx
  on public.live_interactions (live_id, status);

-- One open interaction per viewer per live (prevents duplicate active requests)
create unique index if not exists live_interactions_one_open_per_user
  on public.live_interactions (live_id, user_id)
  where status in ('pending', 'accepted', 'active');

comment on table public.live_interactions is
  'Authoritative interactive-live request/invite/role state. Clients cannot self-assign cohost.';

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.touch_live_interaction_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists touch_live_interaction_updated_at on public.live_interactions;
create trigger touch_live_interaction_updated_at
  before update on public.live_interactions
  for each row execute function public.touch_live_interaction_updated_at();

create or replace function public.is_live_host(p_live_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.live_sessions ls
    where ls.id = p_live_id
      and ls.host_id = auth.uid()
  );
$$;

revoke all on function public.is_live_host(uuid) from public;
grant execute on function public.is_live_host(uuid) to authenticated;

create or replace function public.role_for_mode(p_mode text)
returns text
language sql
immutable
as $$
  select case
    when p_mode = 'audio_video' then 'cohost'
    else 'speaker'
  end;
$$;

-- Expire stale pending/accepted rows (also called from RPCs)
create or replace function public.expire_stale_live_interactions(p_live_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  update public.live_interactions
  set
    status = 'expired',
    ended_at = coalesce(ended_at, now()),
    participant_role = null
  where status in ('pending', 'accepted')
    and expires_at is not null
    and expires_at < now()
    and (p_live_id is null or live_id = p_live_id);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.expire_stale_live_interactions(uuid) from public;
grant execute on function public.expire_stale_live_interactions(uuid) to authenticated;

-- When a live ends, terminate open interactions
create or replace function public.cleanup_interactions_on_live_end()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'ended' and old.status is distinct from 'ended' then
    update public.live_interactions
    set
      status = case
        when status in ('pending', 'accepted') then 'cancelled'
        when status = 'active' then 'ended'
        else status
      end,
      ended_at = coalesce(ended_at, now()),
      participant_role = null
    where live_id = new.id
      and status in ('pending', 'accepted', 'active');
  end if;
  return new;
end;
$$;

drop trigger if exists cleanup_interactions_on_live_end on public.live_sessions;
create trigger cleanup_interactions_on_live_end
  after update of status on public.live_sessions
  for each row execute function public.cleanup_interactions_on_live_end();

-- ---------------------------------------------------------------------------
-- RPCs (authoritative mutations)
-- ---------------------------------------------------------------------------

create or replace function public.request_to_speak(p_live_id uuid, p_mode text)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  live_row public.live_sessions;
  result public.live_interactions;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_mode not in ('audio', 'audio_video') then
    raise exception 'Invalid mode';
  end if;

  perform public.expire_stale_live_interactions(p_live_id);

  select * into live_row from public.live_sessions where id = p_live_id;
  if not found then
    raise exception 'Live session not found';
  end if;
  if live_row.status <> 'live' then
    raise exception 'Live session is not active';
  end if;
  if live_row.host_id = uid then
    raise exception 'Host cannot request to speak';
  end if;

  if exists (
    select 1 from public.live_interactions
    where live_id = p_live_id
      and user_id = uid
      and status in ('pending', 'accepted', 'active')
  ) then
    raise exception 'You already have an active request or intervention';
  end if;

  insert into public.live_interactions (
    live_id, user_id, mode, origin, status, expires_at
  ) values (
    p_live_id, uid, p_mode, 'request', 'pending', now() + interval '2 minutes'
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.request_to_speak(uuid, text) from public;
grant execute on function public.request_to_speak(uuid, text) to authenticated;

create or replace function public.cancel_speak_request(p_interaction_id uuid)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.live_interactions;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into row from public.live_interactions where id = p_interaction_id for update;
  if not found then
    raise exception 'Request not found';
  end if;
  if row.user_id <> uid then
    raise exception 'Only the requester can cancel this request';
  end if;
  if row.status not in ('pending', 'accepted') then
    raise exception 'Request cannot be cancelled in its current state';
  end if;

  update public.live_interactions
  set status = 'cancelled', ended_at = now(), participant_role = null
  where id = p_interaction_id
  returning * into row;

  return row;
end;
$$;

revoke all on function public.cancel_speak_request(uuid) from public;
grant execute on function public.cancel_speak_request(uuid) to authenticated;

create or replace function public.respond_to_speak_request(
  p_interaction_id uuid,
  p_accept boolean
)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.live_interactions;
  active_count integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into row from public.live_interactions where id = p_interaction_id for update;
  if not found then
    raise exception 'Request not found';
  end if;

  perform public.expire_stale_live_interactions(row.live_id);

  select * into row from public.live_interactions where id = p_interaction_id;
  if row.status = 'expired' then
    raise exception 'This request has expired';
  end if;
  if not public.is_live_host(row.live_id) then
    raise exception 'Only the host can accept or reject requests';
  end if;
  if row.origin <> 'request' or row.status <> 'pending' then
    raise exception 'Request is not pending';
  end if;

  if p_accept then
    select count(*) into active_count
    from public.live_interactions
    where live_id = row.live_id
      and status in ('accepted', 'active');

    if active_count >= 4 then
      raise exception 'Maximum of 4 simultaneous speakers/co-hosts reached';
    end if;

    update public.live_interactions
    set
      status = 'accepted',
      responded_at = now(),
      expires_at = now() + interval '2 minutes',
      participant_role = public.role_for_mode(row.mode)
    where id = p_interaction_id
    returning * into row;
  else
    update public.live_interactions
    set
      status = 'rejected',
      responded_at = now(),
      ended_at = now(),
      participant_role = null
    where id = p_interaction_id
    returning * into row;
  end if;

  return row;
end;
$$;

revoke all on function public.respond_to_speak_request(uuid, boolean) from public;
grant execute on function public.respond_to_speak_request(uuid, boolean) to authenticated;

create or replace function public.invite_to_speak(
  p_live_id uuid,
  p_user_id uuid,
  p_mode text
)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  live_row public.live_sessions;
  result public.live_interactions;
  active_count integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_mode not in ('audio', 'audio_video') then
    raise exception 'Invalid mode';
  end if;
  if not public.is_live_host(p_live_id) then
    raise exception 'Only the host can invite viewers';
  end if;
  if p_user_id = uid then
    raise exception 'Host cannot invite themselves';
  end if;

  perform public.expire_stale_live_interactions(p_live_id);

  select * into live_row from public.live_sessions where id = p_live_id;
  if not found or live_row.status <> 'live' then
    raise exception 'Live session is not active';
  end if;

  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'Viewer not found';
  end if;

  if exists (
    select 1 from public.live_interactions
    where live_id = p_live_id
      and user_id = p_user_id
      and status in ('pending', 'accepted', 'active')
  ) then
    raise exception 'Viewer already has an active request or intervention';
  end if;

  select count(*) into active_count
  from public.live_interactions
  where live_id = p_live_id
    and status in ('accepted', 'active');

  if active_count >= 4 then
    raise exception 'Maximum of 4 simultaneous speakers/co-hosts reached';
  end if;

  insert into public.live_interactions (
    live_id, user_id, mode, origin, status, expires_at, participant_role
  ) values (
    p_live_id,
    p_user_id,
    p_mode,
    'invite',
    'pending',
    now() + interval '2 minutes',
    public.role_for_mode(p_mode)
  )
  returning * into result;

  return result;
end;
$$;

revoke all on function public.invite_to_speak(uuid, uuid, text) from public;
grant execute on function public.invite_to_speak(uuid, uuid, text) to authenticated;

create or replace function public.respond_to_invite(
  p_interaction_id uuid,
  p_accept boolean
)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.live_interactions;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into row from public.live_interactions where id = p_interaction_id for update;
  if not found then
    raise exception 'Invitation not found';
  end if;

  perform public.expire_stale_live_interactions(row.live_id);
  select * into row from public.live_interactions where id = p_interaction_id;

  if row.status = 'expired' then
    raise exception 'This invitation has expired';
  end if;
  if row.user_id <> uid then
    raise exception 'Only the invited viewer can respond';
  end if;
  if row.origin <> 'invite' or row.status <> 'pending' then
    raise exception 'Invitation is not pending';
  end if;

  if p_accept then
    update public.live_interactions
    set
      status = 'accepted',
      responded_at = now(),
      expires_at = now() + interval '2 minutes',
      participant_role = public.role_for_mode(row.mode)
    where id = p_interaction_id
    returning * into row;
  else
    update public.live_interactions
    set
      status = 'rejected',
      responded_at = now(),
      ended_at = now(),
      participant_role = null
    where id = p_interaction_id
    returning * into row;
  end if;

  return row;
end;
$$;

revoke all on function public.respond_to_invite(uuid, boolean) from public;
grant execute on function public.respond_to_invite(uuid, boolean) to authenticated;

-- After explicit device consent + publish, mark active
create or replace function public.confirm_participant_media(p_interaction_id uuid)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.live_interactions;
  live_row public.live_sessions;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into row from public.live_interactions where id = p_interaction_id for update;
  if not found then
    raise exception 'Interaction not found';
  end if;
  if row.user_id <> uid then
    raise exception 'Only the participant can confirm media';
  end if;

  perform public.expire_stale_live_interactions(row.live_id);
  select * into row from public.live_interactions where id = p_interaction_id;

  if row.status <> 'accepted' then
    raise exception 'Interaction is not awaiting media consent';
  end if;

  select * into live_row from public.live_sessions where id = row.live_id;
  if not found or live_row.status <> 'live' then
    raise exception 'Live session is not active';
  end if;

  update public.live_interactions
  set
    status = 'active',
    expires_at = null,
    participant_role = public.role_for_mode(row.mode)
  where id = p_interaction_id
  returning * into row;

  return row;
end;
$$;

revoke all on function public.confirm_participant_media(uuid) from public;
grant execute on function public.confirm_participant_media(uuid) to authenticated;

create or replace function public.end_intervention(p_interaction_id uuid)
returns public.live_interactions
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row public.live_interactions;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into row from public.live_interactions where id = p_interaction_id for update;
  if not found then
    raise exception 'Interaction not found';
  end if;

  if not (
    public.is_live_host(row.live_id)
    or row.user_id = uid
  ) then
    raise exception 'Not allowed to end this intervention';
  end if;

  if row.status not in ('pending', 'accepted', 'active') then
    return row;
  end if;

  update public.live_interactions
  set
    status = case
      when row.status = 'active' then 'ended'
      else 'cancelled'
    end,
    ended_at = now(),
    participant_role = null
  where id = p_interaction_id
  returning * into row;

  return row;
end;
$$;

revoke all on function public.end_intervention(uuid) from public;
grant execute on function public.end_intervention(uuid) to authenticated;

-- Host cleanup when a participant disappears from presence
create or replace function public.end_intervention_for_user(
  p_live_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not public.is_live_host(p_live_id) then
    raise exception 'Only the host can clean up participant state';
  end if;

  update public.live_interactions
  set
    status = case when status = 'active' then 'ended' else 'cancelled' end,
    ended_at = now(),
    participant_role = null
  where live_id = p_live_id
    and user_id = p_user_id
    and status in ('pending', 'accepted', 'active');

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.end_intervention_for_user(uuid, uuid) from public;
grant execute on function public.end_intervention_for_user(uuid, uuid) to authenticated;

-- Used by agora-token Edge Function (via user JWT + RLS-bypass through SECURITY DEFINER)
create or replace function public.user_can_publish_on_live(p_live_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.live_sessions ls
    where ls.id = p_live_id
      and ls.status = 'live'
      and ls.host_id = p_user_id
  )
  or exists (
    select 1 from public.live_interactions li
    where li.live_id = p_live_id
      and li.user_id = p_user_id
      and li.status in ('accepted', 'active')
  );
$$;

revoke all on function public.user_can_publish_on_live(uuid, uuid) from public;
grant execute on function public.user_can_publish_on_live(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.live_interactions enable row level security;

drop policy if exists "Participants and host can read interactions" on public.live_interactions;
create policy "Participants and host can read interactions"
  on public.live_interactions for select
  to authenticated
  using (
    user_id = auth.uid()
    or public.is_live_host(live_id)
    or exists (
      select 1 from public.live_sessions ls
      where ls.id = live_interactions.live_id
        and ls.status in ('live', 'ended')
    )
  );

-- No direct INSERT/UPDATE/DELETE from clients — mutations go through RPCs.
-- (Absence of policies denies those operations under RLS.)

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.live_interactions;
