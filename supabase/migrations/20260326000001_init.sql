-- Reneo Live schema + RLS
-- Apply via Supabase SQL Editor or `supabase db push`

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  avatar text,
  role text not null check (role in ('seller', 'customer')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 120),
  description text not null default '' check (char_length(description) <= 2000),
  price numeric(12, 2) not null check (price > 0),
  image_url text,
  stock integer not null default 0 check (stock >= 0),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now()
);

create table if not exists public.live_sessions (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'ended')),
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  live_id uuid not null references public.live_sessions (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  message text not null check (char_length(trim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

create index if not exists products_seller_id_idx on public.products (seller_id);
create index if not exists products_status_idx on public.products (status);
create index if not exists live_sessions_status_idx on public.live_sessions (status);
create index if not exists live_sessions_host_id_idx on public.live_sessions (host_id);
create index if not exists live_sessions_product_id_idx on public.live_sessions (product_id);
create index if not exists messages_live_id_created_at_idx on public.messages (live_id, created_at);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

create or replace function public.is_seller()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'seller'
  );
$$;

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

alter function public.handle_new_user() owner to postgres;

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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Prevent role/id spoofing on profile updates
create or replace function public.protect_profile_columns()
returns trigger
language plpgsql
as $$
begin
  if new.id <> old.id then
    raise exception 'Cannot change profile id';
  end if;
  if new.role <> old.role then
    raise exception 'Cannot change role';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_profile_columns on public.profiles;
create trigger protect_profile_columns
  before update on public.profiles
  for each row execute function public.protect_profile_columns();

-- Force seller_id / host_id / user_id from auth.uid() — never trust client payload
create or replace function public.set_product_seller_id()
returns trigger
language plpgsql
as $$
begin
  if not public.is_seller() then
    raise exception 'Only sellers can manage products';
  end if;
  new.seller_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_product_seller_id on public.products;
create trigger set_product_seller_id
  before insert on public.products
  for each row execute function public.set_product_seller_id();

create or replace function public.prevent_product_seller_change()
returns trigger
language plpgsql
as $$
begin
  if new.seller_id <> old.seller_id then
    raise exception 'Cannot transfer product ownership';
  end if;
  return new;
end;
$$;

drop trigger if exists prevent_product_seller_change on public.products;
create trigger prevent_product_seller_change
  before update on public.products
  for each row execute function public.prevent_product_seller_change();

create or replace function public.set_live_host_id()
returns trigger
language plpgsql
as $$
begin
  if not public.is_seller() then
    raise exception 'Only sellers can create live sessions';
  end if;

  if not exists (
    select 1 from public.products p
    where p.id = new.product_id
      and p.seller_id = auth.uid()
      and p.status = 'active'
  ) then
    raise exception 'Product not found or not owned by you';
  end if;

  new.host_id := auth.uid();
  return new;
end;
$$;

drop trigger if exists set_live_host_id on public.live_sessions;
create trigger set_live_host_id
  before insert on public.live_sessions
  for each row execute function public.set_live_host_id();

create or replace function public.protect_live_session()
returns trigger
language plpgsql
as $$
begin
  if new.host_id <> old.host_id then
    raise exception 'Cannot change live host';
  end if;
  if new.product_id <> old.product_id then
    raise exception 'Cannot change live product';
  end if;
  if auth.uid() is distinct from old.host_id then
    raise exception 'Only the host can update this live session';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_live_session on public.live_sessions;
create trigger protect_live_session
  before update on public.live_sessions
  for each row execute function public.protect_live_session();

create or replace function public.set_message_user_id()
returns trigger
language plpgsql
as $$
begin
  new.user_id := auth.uid();

  if not exists (
    select 1 from public.live_sessions ls
    where ls.id = new.live_id
      and ls.status = 'live'
  ) then
    raise exception 'Cannot chat on an inactive live session';
  end if;

  return new;
end;
$$;

drop trigger if exists set_message_user_id on public.messages;
create trigger set_message_user_id
  before insert on public.messages
  for each row execute function public.set_message_user_id();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.live_sessions enable row level security;
alter table public.messages enable row level security;

-- Profiles
drop policy if exists "Profiles are viewable by authenticated users" on public.profiles;
create policy "Profiles are viewable by authenticated users"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Products
drop policy if exists "Sellers can insert own products" on public.products;
create policy "Sellers can insert own products"
  on public.products for insert
  to authenticated
  with check (
    seller_id = auth.uid()
    and public.is_seller()
  );

drop policy if exists "Sellers can select own products" on public.products;
create policy "Sellers can select own products"
  on public.products for select
  to authenticated
  using (seller_id = auth.uid());

drop policy if exists "Customers can select active products on live" on public.products;
create policy "Customers can select active products on live"
  on public.products for select
  to authenticated
  using (
    status = 'active'
    and (
      public.current_user_role() = 'customer'
      or exists (
        select 1 from public.live_sessions ls
        where ls.product_id = products.id
          and ls.status in ('live', 'ended')
      )
    )
  );

drop policy if exists "Sellers can update own products" on public.products;
create policy "Sellers can update own products"
  on public.products for update
  to authenticated
  using (seller_id = auth.uid())
  with check (seller_id = auth.uid());

drop policy if exists "Sellers can delete own products" on public.products;
create policy "Sellers can delete own products"
  on public.products for delete
  to authenticated
  using (seller_id = auth.uid());

-- Live sessions
drop policy if exists "Sellers can create own live sessions" on public.live_sessions;
create policy "Sellers can create own live sessions"
  on public.live_sessions for insert
  to authenticated
  with check (
    host_id = auth.uid()
    and public.is_seller()
  );

drop policy if exists "Authenticated users can read live sessions" on public.live_sessions;
create policy "Authenticated users can read live sessions"
  on public.live_sessions for select
  to authenticated
  using (
    host_id = auth.uid()
    or status in ('live', 'ended')
  );

drop policy if exists "Hosts can update own live sessions" on public.live_sessions;
create policy "Hosts can update own live sessions"
  on public.live_sessions for update
  to authenticated
  using (host_id = auth.uid())
  with check (host_id = auth.uid());

-- Messages
drop policy if exists "Users can read messages for accessible lives" on public.messages;
create policy "Users can read messages for accessible lives"
  on public.messages for select
  to authenticated
  using (
    exists (
      select 1 from public.live_sessions ls
      where ls.id = messages.live_id
        and (
          ls.host_id = auth.uid()
          or ls.status in ('live', 'ended')
        )
    )
  );

drop policy if exists "Users can insert own messages" on public.messages;
create policy "Users can insert own messages"
  on public.messages for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.live_sessions ls
      where ls.id = live_id
        and ls.status = 'live'
        and (ls.host_id = auth.uid() or true)
    )
  );

-- ---------------------------------------------------------------------------
-- Realtime
-- ---------------------------------------------------------------------------

alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.live_sessions;

-- ---------------------------------------------------------------------------
-- Storage: product-images bucket
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public read product images" on storage.objects;
create policy "Public read product images"
  on storage.objects for select
  to public
  using (bucket_id = 'product-images');

drop policy if exists "Sellers upload own product images" on storage.objects;
create policy "Sellers upload own product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and public.is_seller()
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Sellers update own product images" on storage.objects;
create policy "Sellers update own product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Sellers delete own product images" on storage.objects;
create policy "Sellers delete own product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
