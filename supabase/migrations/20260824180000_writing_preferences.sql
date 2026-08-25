alter table public.profiles
  add column if not exists writing_preferences jsonb;
