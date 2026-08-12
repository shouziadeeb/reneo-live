-- Tighten RLS so sellers cannot read another seller's products,
-- even if those products were featured on a live/ended session.
-- Also lock down message mutations and security-definer grants.

-- ---------------------------------------------------------------------------
-- Products: seller isolation vs customer live access
-- ---------------------------------------------------------------------------

drop policy if exists "Customers can select active products on live" on public.products;
drop policy if exists "Customers can select products featured on lives" on public.products;

-- Customers may read a product only when it is (or was) featured on a live
-- they can already see. Sellers never match this policy.
create policy "Customers can select products featured on lives"
  on public.products for select
  to authenticated
  using (
    public.current_user_role() = 'customer'
    and exists (
      select 1 from public.live_sessions ls
      where ls.product_id = products.id
        and ls.status in ('live', 'ended')
    )
  );

-- ---------------------------------------------------------------------------
-- Messages: insert only on active lives; no update/delete
-- ---------------------------------------------------------------------------

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
    )
  );

-- Explicit deny for UPDATE (no UPDATE policy = clients cannot edit).
-- Do not add a DELETE trigger: live_sessions/profiles cascade must still work.
-- Client DELETE is already denied because no DELETE policy exists.

create or replace function public.prevent_message_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'Chat messages cannot be modified';
end;
$$;

drop trigger if exists prevent_message_update on public.messages;
create trigger prevent_message_update
  before update on public.messages
  for each row execute function public.prevent_message_update();

drop trigger if exists prevent_message_delete on public.messages;
drop function if exists public.prevent_message_mutation();

-- ---------------------------------------------------------------------------
-- Function grants: do not leave SECURITY DEFINER helpers executable by anon
-- ---------------------------------------------------------------------------

revoke all on function public.current_user_role() from public;
grant execute on function public.current_user_role() to authenticated;

revoke all on function public.is_seller() from public;
grant execute on function public.is_seller() to authenticated;
