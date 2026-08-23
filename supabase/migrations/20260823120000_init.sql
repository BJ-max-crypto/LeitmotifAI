-- Leitmotif schema: profiles, credits, documents, RLS, and signup trigger.

create extension if not exists pgcrypto;

do $$
begin
  if not exists (select 1 from pg_type where typname = 'plan_tier') then
    create type public.plan_tier as enum ('free', 'pro', 'pro_plus');
  end if;
end
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text,
  avatar_url text,
  plan_tier public.plan_tier not null default 'free',
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.user_credits (
  user_id uuid primary key references auth.users (id) on delete cascade,
  credits_used integer not null default 0,
  credits_limit integer not null default 50
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Untitled',
  content text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

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
  for each row execute procedure public.set_updated_at();

drop trigger if exists documents_set_updated_at on public.documents;
create trigger documents_set_updated_at
  before update on public.documents
  for each row execute procedure public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, email, plan_tier)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.email,
    'free'
  )
  on conflict (id) do nothing;

  insert into public.user_credits (user_id, credits_used, credits_limit)
  values (new.id, 0, 50)
  on conflict (user_id) do nothing;

  insert into public.documents (user_id, title, content)
  values (new.id, 'Untitled', '');

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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
  uid uuid := auth.uid();
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
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can read own credits" on public.user_credits;
create policy "Users can read own credits"
  on public.user_credits for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own credits" on public.user_credits;
create policy "Users can insert own credits"
  on public.user_credits for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own credits" on public.user_credits;
create policy "Users can update own credits"
  on public.user_credits for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can read own documents" on public.documents;
create policy "Users can read own documents"
  on public.documents for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own documents" on public.documents;
create policy "Users can insert own documents"
  on public.documents for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own documents" on public.documents;
create policy "Users can update own documents"
  on public.documents for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own documents" on public.documents;
create policy "Users can delete own documents"
  on public.documents for delete
  using (auth.uid() = user_id);

grant usage on schema public to authenticated;
grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_credits to authenticated;
grant select, insert, update, delete on public.documents to authenticated;
grant execute on function public.consume_credit() to authenticated;

do $$
begin
  alter publication supabase_realtime add table public.profiles;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.user_credits;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.documents;
exception
  when duplicate_object then null;
  when undefined_object then null;
end
$$;
