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

create table if not exists content_layouts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  town_hall text not null,
  description text not null default '',
  image_url text not null default '',
  layout_url text not null,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_layouts_public
  on content_layouts (town_hall, published, created_at desc);

create table if not exists content_strategies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  town_hall text not null,
  troops jsonb not null default '[]'::jsonb,
  spells jsonb not null default '[]'::jsonb,
  clan_castle jsonb not null default '[]'::jsonb,
  heroes jsonb not null default '[]'::jsonb,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_strategies_public
  on content_strategies (town_hall, published, created_at desc);

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  player_tag text not null,
  player_name text not null,
  player_avatar_url text,
  body text not null default '',
  image_url text not null default '',
  poll_question text,
  poll_options jsonb not null default '[]'::jsonb,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  share_count integer not null default 0,
  featured boolean not null default false,
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint social_posts_content_check check (
    body <> '' or image_url <> '' or poll_question is not null
  )
);

create index if not exists idx_social_posts_public
  on social_posts (published, featured, created_at desc);

create table if not exists social_post_likes (
  post_id uuid not null references social_posts(id) on delete cascade,
  player_tag text not null,
  created_at timestamptz not null default now(),
  primary key (post_id, player_tag)
);

create table if not exists social_post_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  player_tag text not null,
  player_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_post_comments_post_id
  on social_post_comments (post_id, created_at desc);

create table if not exists army_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  category text not null check (category in ('troops', 'spells', 'heroes', 'heroEquipment')),
  village text not null check (village in ('home', 'builderBase')),
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name, category, village)
);

create index if not exists idx_army_items_lookup
  on army_items (normalized_name, category, village);
