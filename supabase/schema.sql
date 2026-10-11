-- Run once in Supabase: SQL Editor -> New query -> paste -> Run.
-- Per-user documents (favorites, lists, purchases, alerts, prefs) + public shared lists.

create table if not exists public.user_state (
  user_id uuid not null references auth.users(id) on delete cascade,
  key text not null,
  value jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.user_state enable row level security;
drop policy if exists "own rows select" on public.user_state;
drop policy if exists "own rows insert" on public.user_state;
drop policy if exists "own rows update" on public.user_state;
drop policy if exists "own rows delete" on public.user_state;
create policy "own rows select" on public.user_state for select using (auth.uid() = user_id);
create policy "own rows insert" on public.user_state for insert with check (auth.uid() = user_id);
create policy "own rows update" on public.user_state for update using (auth.uid() = user_id);
create policy "own rows delete" on public.user_state for delete using (auth.uid() = user_id);

create table if not exists public.shared_lists (
  id uuid primary key default gen_random_uuid(),
  owner uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(name) <= 80),
  items jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.shared_lists enable row level security;
drop policy if exists "anyone with the id can read" on public.shared_lists;
drop policy if exists "owner writes" on public.shared_lists;
create policy "anyone with the id can read" on public.shared_lists for select using (true);
create policy "owner writes" on public.shared_lists for all using (auth.uid() = owner) with check (auth.uid() = owner);

-- Avatars (public read, each user writes only inside their own folder <uid>/...)
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true) on conflict (id) do nothing;
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars own write" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars own delete" on storage.objects;
create policy "avatars public read" on storage.objects for select using (bucket_id = 'avatars');
create policy "avatars own write" on storage.objects for insert to authenticated with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own update" on storage.objects for update to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "avatars own delete" on storage.objects for delete to authenticated using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
