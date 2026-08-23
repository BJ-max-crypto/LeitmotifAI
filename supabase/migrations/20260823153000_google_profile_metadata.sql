-- Prefer Google OAuth name/avatar fields when a user is created via Sign in with Google.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, avatar_url, plan_tier)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    new.email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture'
    ),
    'free'
  )
  on conflict (id) do update
    set
      full_name = coalesce(public.profiles.full_name, excluded.full_name),
      email = coalesce(excluded.email, public.profiles.email),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url);

  insert into public.user_credits (user_id, credits_used, credits_limit)
  values (new.id, 0, 50)
  on conflict (user_id) do nothing;

  insert into public.documents (user_id, title, content)
  select new.id, 'Untitled', ''
  where not exists (
    select 1 from public.documents where user_id = new.id
  );

  return new;
end;
$$;
