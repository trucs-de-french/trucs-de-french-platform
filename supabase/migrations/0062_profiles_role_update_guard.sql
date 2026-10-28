create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid() and role = public.current_user_role());
