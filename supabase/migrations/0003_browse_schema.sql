-- 0003_browse_schema: curated genre families, subgenre tagging, track enrichment.

create table genre_families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  color text not null,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

alter table genres add column family_id uuid references genre_families(id) on delete set null;
alter table genres add column slug text unique;
create index genres_family_idx on genres (family_id);

alter table tracks add column itunes_track_id bigint unique;
alter table tracks add column artwork_url text;
alter table tracks add column preview_url text;
alter table tracks add column apple_music_url text;
alter table tracks add column duration_ms int;

create table subgenre_tracks (
  genre_id uuid not null references genres(id) on delete cascade,
  track_id uuid not null references tracks(id) on delete cascade,
  rank int not null default 0,
  primary key (genre_id, track_id)
);
create index subgenre_tracks_genre_idx on subgenre_tracks (genre_id, rank);

alter table genre_families enable row level security;
alter table subgenre_tracks enable row level security;

create policy "genre_families public read" on genre_families
  for select to anon, authenticated using (true);
create policy "subgenre_tracks public read" on subgenre_tracks
  for select to anon, authenticated using (true);
-- tracks had RLS enabled in 0002 with no policy; browsing needs public read now.
create policy "tracks public read" on tracks
  for select to anon, authenticated using (true);
