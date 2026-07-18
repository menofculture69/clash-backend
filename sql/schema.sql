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

create table if not exists content_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Clash Companion',
  message text not null,
  image_url text not null default '',
  link_label text not null default '',
  link_url text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table content_announcements
  add column if not exists image_url text not null default '';

alter table content_announcements
  add column if not exists poll_question text,
  add column if not exists poll_options jsonb not null default '[]'::jsonb;

create index if not exists idx_content_announcements_public
  on content_announcements (published, created_at desc);

create table if not exists announcement_reactions (
  announcement_id uuid not null references content_announcements(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  reaction text not null check (reaction in ('like', 'love', 'laugh', 'wow', 'sad', 'support')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_announcement_reactions_announcement
  on announcement_reactions (announcement_id);

create table if not exists announcement_poll_votes (
  announcement_id uuid not null references content_announcements(id) on delete cascade,
  user_id uuid not null references app_users(id) on delete cascade,
  option_index integer not null check (option_index between 0 and 5),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists idx_announcement_poll_votes_announcement
  on announcement_poll_votes (announcement_id);

create table if not exists content_strategies (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  town_hall text not null,
  troops jsonb not null default '[]'::jsonb,
  spells jsonb not null default '[]'::jsonb,
  clan_castle jsonb not null default '[]'::jsonb,
  heroes jsonb not null default '[]'::jsonb,
  hero_loadouts jsonb not null default '[]'::jsonb,
  army_link text not null default '',
  published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_content_strategies_public
  on content_strategies (town_hall, published, created_at desc);

alter table content_strategies
  add column if not exists hero_loadouts jsonb not null default '[]'::jsonb;

alter table content_strategies
  add column if not exists army_link text not null default '';

create table if not exists social_posts (
  id uuid primary key default gen_random_uuid(),
  player_tag text not null,
  player_name text not null,
  player_avatar_url text,
  player_clan_name text,
  player_clan_role text,
  body text not null default '',
  image_url text not null default '',
  poll_question text,
  poll_options jsonb not null default '[]'::jsonb,
  hashtags jsonb not null default '[]'::jsonb,
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

alter table social_posts
  add column if not exists hashtags jsonb not null default '[]'::jsonb;

update social_posts
set hashtags = hashtags
  - 'Trophies'
  - 'Town Hall Level'
  - 'Donation'
  - 'Clan Capital Contribution'
  - 'War Stars'
where hashtags ?| array[
  'Trophies',
  'Town Hall Level',
  'Donation',
  'Clan Capital Contribution',
  'War Stars'
];

alter table social_posts
  add column if not exists player_clan_name text,
  add column if not exists player_clan_role text;

create index if not exists idx_social_posts_public
  on social_posts (published, featured, created_at desc);

create table if not exists social_notifications (
  id uuid primary key default gen_random_uuid(),
  player_tag text,
  type text not null,
  message text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_social_notifications_recent
  on social_notifications (created_at desc);

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

create table if not exists social_post_reports (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references social_posts(id) on delete cascade,
  reporter_tag text not null,
  reporter_name text,
  reason text not null default 'Reported from app',
  created_at timestamptz not null default now(),
  unique (post_id, reporter_tag)
);

create index if not exists idx_social_post_reports_recent
  on social_post_reports (created_at desc);

create table if not exists social_follows (
  follower_tag text not null,
  following_tag text not null,
  follower_name text not null,
  follower_avatar_url text,
  follower_clan_name text,
  following_name text not null,
  following_avatar_url text,
  following_clan_name text,
  created_at timestamptz not null default now(),
  primary key (follower_tag, following_tag),
  constraint social_follows_not_self check (follower_tag <> following_tag)
);

create index if not exists idx_social_follows_follower
  on social_follows (follower_tag, created_at desc);

create index if not exists idx_social_follows_following
  on social_follows (following_tag, created_at desc);

create table if not exists army_items (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  normalized_name text not null,
  category text not null check (category in ('troops', 'superTroops', 'spells', 'heroes', 'siegeMachines', 'pets', 'heroEquipment')),
  village text not null check (village in ('home', 'builderBase')),
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (normalized_name, category, village)
);

create index if not exists idx_army_items_lookup
  on army_items (normalized_name, category, village);

create table if not exists hall_assets (
  id uuid primary key default gen_random_uuid(),
  hall_type text not null check (hall_type in ('townHall', 'builderHall')),
  level integer not null check (level between 1 and 99),
  image_url text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (hall_type, level)
);

create index if not exists idx_hall_assets_lookup
  on hall_assets (hall_type, level);
