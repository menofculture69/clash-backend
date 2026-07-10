create extension if not exists "pgcrypto";

create table if not exists app_users (
  id uuid primary key default gen_random_uuid(),
  player_tag text not null unique,
  player_name text not null,
  clan_tag text,
  clan_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references app_users(id) on delete cascade,
  refresh_token_hash text not null,
  device_info text,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_app_sessions_user_id on app_sessions(user_id);

create table if not exists auth_audit_logs (
  id bigserial primary key,
  player_tag text not null,
  success boolean not null,
  ip_address text,
  device_info text,
  reason text,
  created_at timestamptz not null default now()
);
