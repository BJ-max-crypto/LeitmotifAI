-- Idempotent workspace bootstrap for email and Google users.

create or replace function public.ensure_user_workspace()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  meta jsonb;
  email text;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select u.raw_user_meta_data, u.email
    into meta, email
  from auth.users u
  where u.id = uid;

  insert into public.profiles (id, full_name, email, avatar_url, plan_tier)
  values (
    uid,
    coalesce(
      meta->>'full_name',
      meta->>'name',
      split_part(coalesce(email, ''), '@', 1)
    ),
    email,
    coalesce(meta->>'avatar_url', meta->>'picture'),
    'free'
  )
  on conflict (id) do update
    set
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  insert into public.user_credits (user_id, credits_used, credits_limit)
  values (uid, 0, 50)
  on conflict (user_id) do nothing;

  insert into public.documents (user_id, title, content)
  select uid, 'Untitled', ''
  where not exists (
    select 1 from public.documents where user_id = uid
  );
end;
$$;

grant execute on function public.ensure_user_workspace() to authenticated;
