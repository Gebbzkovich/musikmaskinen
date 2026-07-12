-- 0002_genre_schema: real genre schema for Musikmaskinen (Fas 0).
-- Drops the bootstrap smoke-test table and introduces genres, genre_examples,
-- and the canonical tracks skeleton. Coordinates/colors are stored raw from the
-- source; normalization happens in the render layer (Fas 1).

-- Retire the bootstrap placeholder from 0001.
drop table if exists _migrations_smoke_test;

create table genres (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  x numeric not null,
  y numeric not null,
  color text not null,              -- hex or rgb string, as the source delivers
  spotify_playlist_id text,         -- "The Sound of X" playlist if the source has it, else null
  source text not null,             -- 'everynoise-watch-csv' | 'everynoise-scrape'
  imported_at timestamptz not null default now()
);

create index genres_name_trgm on genres using gin (name gin_trgm_ops);

create table genre_examples (
  id uuid primary key default gen_random_uuid(),
  genre_id uuid not null references genres(id) on delete cascade,
  artist_name text not null,
  spotify_artist_id text,
  rank int,
  unique (genre_id, artist_name)
);

-- Canonical track model: skeleton now, used by the list functions in Fas 2.
-- Platform IDs are enriching metadata, NEVER primary keys.
create table tracks (
  id uuid primary key default gen_random_uuid(),
  artist_name text not null,
  track_name text not null,
  isrc text,
  itunes_id text,
  spotify_id text,
  youtube_id text,
  created_at timestamptz not null default now(),
  unique (artist_name, track_name)
);

-- RLS: enabled on all three. genres + genre_examples are publicly readable
-- (map data). tracks has no anon policy yet. Writes happen only via the service
-- role (the import script), which bypasses RLS.
alter table genres enable row level security;
alter table genre_examples enable row level security;
alter table tracks enable row level security;

-- Public read of the genre map. Granted to both anon and authenticated so a
-- logged-in user (Fas 2 auth) does not lose read access to the public map.
create policy "genres are publicly readable"
  on genres for select
  to anon, authenticated
  using (true);

create policy "genre_examples are publicly readable"
  on genre_examples for select
  to anon, authenticated
  using (true);
