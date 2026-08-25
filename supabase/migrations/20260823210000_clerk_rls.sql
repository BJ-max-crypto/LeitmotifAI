-- Clerk third-party auth: user IDs are Clerk `user_...` strings, not auth.users UUIDs.
-- RLS reads the Clerk session token via auth.jwt()->>'sub'.

drop trigger if exists on_auth_user_created on auth.users;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type public.plan_tier as enum ('free', 'pro', 'pro_plus');
  end if;
end
$$;

create table if not exists public.profiles (
  id text primary key,
  full_name text,
  email text,
  avatar_url text,
  plan_tier public.plan_tier not null default 'free',
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_credits (
  user_id text primary key,
  credits_used integer not null default 0,
  credits_limit integer not null default 50
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id text not null,
  title text not null default 'Untitled',
  content text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'profiles' and column_name = 'id' and data_type = 'uuid'
  ) then
    alter table public.profiles drop constraint if exists profiles_pkey cascade;
    alter table public.profiles alter column id type text using id::text;
    alter table public.profiles add primary key (id);
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'user_credits' and column_name = 'user_id' and data_type = 'uuid'
  ) then
    alter table public.user_credits drop constraint if exists user_credits_pkey cascade;
    alter table public.user_credits alter column user_id type text using user_id::text;
    alter table public.user_credits add primary key (user_id);
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'documents' and column_name = 'user_id' and data_type = 'uuid'
  ) then
    alter table public.documents alter column user_id type text using user_id::text;
  end if;
end
$$;

create index if not exists documents_user_id_updated_at_idx
  on public.documents (user_id, updated_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute function public.set_updated_at();

create or replace function public.clerk_user_id()
returns text
language sql
stable
as $$
  select nullif(auth.jwt()->>'sub', '');
$$;

create or replace function public.ensure_user_workspace()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.clerk_user_id();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  insert into public.profiles (id, plan_tier)
  values (uid, 'free')
  on conflict (id) do nothing;

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

create or replace function public.consume_credit()
returns table (
  ok boolean,
  credits_used integer,
  credits_limit integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  uid text := public.clerk_user_id();
  used integer;
  lim integer;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  select uc.credits_used, uc.credits_limit
    into used, lim
  from public.user_credits uc
  where uc.user_id = uid
  for update;

  if not found then
    insert into public.user_credits (user_id, credits_used, credits_limit)
    values (uid, 0, 50)
    returning user_credits.credits_used, user_credits.credits_limit
    into used, lim;
  end if;

  if used >= lim then
    return query select false, used, lim;
    return;
  end if;

  update public.user_credits
    set credits_used = public.user_credits.credits_used + 1
    where user_id = uid
    returning public.user_credits.credits_used, public.user_credits.credits_limit
    into used, lim;

  return query select true, used, lim;
end;
$$;

alter table public.profiles enable row level security;
alter table public.user_credits enable row level security;
alter table public.documents enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can read own credits" on public.user_credits;
drop policy if exists "Users can insert own credits" on public.user_credits;
drop policy if exists "Users can update own credits" on public.user_credits;
drop policy if exists "Users can read own documents" on public.documents;
drop policy if exists "Users can insert own documents" on public.documents;
drop policy if exists "Users can update own documents" on public.documents;
drop policy if exists "Users can delete own documents" on public.documents;

create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using ((select public.clerk_user_id()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check ((select public.clerk_user_id()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select public.clerk_user_id()) = id)
  with check ((select public.clerk_user_id()) = id);

create policy "Users can read own credits"
  on public.user_credits for select
  to authenticated
  using ((select public.clerk_user_id()) = user_id);

create policy "Users can insert own credits"
  on public.user_credits for insert
  to authenticated
  with check ((select public.clerk_user_id()) = user_id);

create policy "Users can update own credits"
  on public.user_credits for update
  to authenticated
  using ((select public.clerk_user_id()) = user_id)
  with check ((select public.clerk_user_id()) = user_id);

create policy "Users can read own documents"
  on public.documents for select
  to authenticated
  using ((select public.clerk_user_id()) = user_id);

create policy "Users can insert own documents"
  on public.documents for insert
  to authenticated
  with check ((select public.clerk_user_id()) = user_id);

create policy "Users can update own documents"
  on public.documents for update
  to authenticated
  using ((select public.clerk_user_id()) = user_id)
  with check ((select public.clerk_user_id()) = user_id);

create policy "Users can delete own documents"
  on public.documents for delete
  to authenticated
  using ((select public.clerk_user_id()) = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_credits to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant execute on function public.consume_credit() to authenticated;
grant execute on function public.ensure_user_workspace() to authenticated;
grant execute on function public.clerk_user_id() to authenticated;
