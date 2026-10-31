create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.application_memberships (
  user_id uuid not null references public.profiles(user_id) on delete cascade,
  app text not null check (app in ('app1', 'app2')),
  role text not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, app)
);

create table if not exists public.auth_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  app text,
  source_ip inet,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table public.profiles enable row level security;
alter table public.application_memberships enable row level security;
alter table public.auth_events enable row level security;

create policy "users can read their own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can read their own memberships"
  on public.application_memberships for select
  to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists auth_events_user_created_idx
  on public.auth_events (user_id, created_at desc);