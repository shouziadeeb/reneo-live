-- Fix profile creation during signup
-- Run in Supabase SQL Editor if you already applied 20260326000001_init.sql

-- Ensure the auth trigger can insert profiles (bypasses RLS as definer owner)
alter function public.handle_new_user() owner to postgres;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  chosen_role text;
  chosen_name text;
begin
  chosen_role := coalesce(new.raw_user_meta_data->>'role', 'customer');
  if chosen_role not in ('seller', 'customer') then
    chosen_role := 'customer';
  end if;

  chosen_name := coalesce(
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    split_part(new.email, '@', 1),
    'User'
  );

  insert into public.profiles (id, name, role)
  values (new.id, left(chosen_name, 80), chosen_role)
  on conflict (id) do nothing;

  return new;
end;
$$;

-- Fallback for users created before the trigger existed, or if trigger was missing
create or replace function public.ensure_profile()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  user_record auth.users;
  chosen_role text;
  chosen_name text;
  result public.profiles;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select * into result from public.profiles where id = uid;
  if found then
    return result;
  end if;

  select * into user_record from auth.users where id = uid;
  if not found then
    raise exception 'User not found';
  end if;

  chosen_role := coalesce(user_record.raw_user_meta_data->>'role', 'customer');
  if chosen_role not in ('seller', 'customer') then
    chosen_role := 'customer';
  end if;

  chosen_name := coalesce(
    nullif(trim(user_record.raw_user_meta_data->>'name'), ''),
    split_part(user_record.email, '@', 1),
    'User'
  );

  insert into public.profiles (id, name, role)
  values (uid, left(chosen_name, 80), chosen_role)
  on conflict (id) do nothing
  returning * into result;

  if result.id is null then
    select * into result from public.profiles where id = uid;
  end if;

  return result;
end;
$$;

revoke all on function public.ensure_profile() from public;
grant execute on function public.ensure_profile() to authenticated;

-- Backfill profiles for existing auth users missing a row
insert into public.profiles (id, name, role)
select
  u.id,
  left(
    coalesce(
      nullif(trim(u.raw_user_meta_data->>'name'), ''),
      split_part(u.email, '@', 1),
      'User'
    ),
    80
  ),
  case
    when u.raw_user_meta_data->>'role' in ('seller', 'customer')
      then u.raw_user_meta_data->>'role'
    else 'customer'
  end
from auth.users u
left join public.profiles p on p.id = u.id
where p.id is null
on conflict (id) do nothing;
