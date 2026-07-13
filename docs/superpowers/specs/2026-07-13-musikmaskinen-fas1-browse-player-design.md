# Musikmaskinen — Fas 1: Browse + Player (design spec)

**Date:** 2026-07-13
**Status:** Approved direction, pending written-spec review
**Supabase ref:** `kqujhispsknyxcmpfdkl` · **Repo:** Gebbzkovich/musikmaskinen

## Product vision (context)

Musikmaskinen is a premium, mobile-first music app. everynoise.com's genre data
(imported in Fas 0) becomes a curated genre/subgenre taxonomy; **iTunes Search
API** supplies real tracks, album art, and 30-second previews. The visual target
is Apple-class: dark, deep glass, one focal point per screen, text always on the
top legible layer.

The **defining hook** is social and comes in Fas 2: sending a song **with a
comment to a specific friend**, exactly like sharing a TikTok — one tap, pick a
friend, add a line, it lands in a **private thread** you two keep commenting in.
Nothing is public. Fas 1 is built to feed straight into that.

**The map is dropped.** The earlier everynoise scatter-map (canvas pan/zoom) is
not built. everynoise data is used only as the taxonomy + per-genre color.

## Fas 1 goals

Browse and play, shippable on its own:

1. **Genre → Subgenre → Songs → Now Playing** navigation.
2. In-app **30s preview playback** (single audio element, global player).
3. Per-song and in-player **service shortcuts**: Apple Music (real iTunes link)
   and Spotify (deep-link search — no Spotify API, no keys).
4. **Shareable song links**: a deep-link route that opens the app straight to a
   song (and can auto-play its preview) + a Share button (copy link / native
   share sheet). No login required.
5. Premium dark-glass design system.

## Non-goals (deferred to Fas 2+)

- Accounts / **Sign in with Apple** (Apple-only to start), friends.
- In-app **send-to-friend** share, **private comment threads** (the TikTok hook).
- User libraries/playlists.
These are designed-for (stable IDs, reserved Share slot) but not implemented now.

## Data model (migration `0003_browse_schema.sql`)

Builds on Fas 0 (`genres` with everynoise name/x/y/color; `tracks` skeleton).

- `genre_families` — curated top genres:
  `id uuid pk, name text, slug text unique, color text, sort int, created_at`.
- `genres.family_id uuid null references genre_families(id)` — a curated
  everynoise genre becomes a browsable **subgenre** by getting a `family_id`.
  Non-curated genres keep `family_id = null` and simply don't surface.
- Extend `tracks`:
  `itunes_track_id bigint unique` (stable id), `artwork_url text`,
  `preview_url text`, `apple_music_url text`, `duration_ms int`.
- `subgenre_tracks` — join so a track can appear under multiple subgenres:
  `genre_id uuid references genres(id), track_id uuid references tracks(id),
   rank int, primary key (genre_id, track_id)`.
- RLS: `genre_families`, `subgenre_tracks` → public `select` (anon +
  authenticated). `tracks` gets a public `select` now (it needs to be readable
  for browsing; the earlier "no anon policy" was for the empty skeleton).
  Writes remain service-role only.

## Taxonomy curation

Curated **~24 top-level families** (Pop, Hip-Hop, Latin, Rock, Metal,
Electronic, Jazz, R&B/Soul, Country, Classical, Folk, Reggae, Blues, Punk,
Indie, K-Pop, Afro, Ambient, Funk/Disco, Gospel, Soundtrack, World, Experimental,
Schlager/Nordic). Each family:

- has a color (chosen to match its everynoise neighborhood) and sort order;
- maps to a curated set of everynoise subgenres by name-matching against the
  `genres` table (e.g. Latin → reggaeton, latin pop, trap latino, dembow,
  bachata, salsa, cumbia…), reviewed so each family has ~6–15 real subgenres.

The mapping is produced during implementation as a **seed** (SQL or a checked-in
data file consumed by the migration/import), so it is reproducible and reviewable.
Exact family list + assignments are finalized in the plan, not improvised at runtime.

## Track ingestion — `scripts/import-tracks.ts`

Same discipline as `import-genres.ts`: one script, `--dry-run` (default) /
`--execute`, service-role key from env, batch upsert, idempotent, re-runnable.

- For each surfaced subgenre, query iTunes Search API with a **tuned search term**
  (subgenre name, plus fallbacks/qualifiers where the raw name is too broad — the
  term-search quality issue is real and handled per-subgenre, not blindly).
- Take top N (≈25–40) music tracks with a `previewUrl` and `artworkUrl`; upscale
  art to 300×300; capture `trackId`, `trackViewUrl` (Apple Music), `trackTimeMillis`.
- Dedupe by `itunes_track_id`; upsert into `tracks`; link via `subgenre_tracks`
  with `rank`.
- `--dry-run` reports counts (tracks, links, skipped) + samples and writes nothing
  (count before/after assertion). `--execute` writes in batches.

## App architecture (React + Vite + react-router v7)

Routes:
- `/` — **Genres** (`GenreGrid` of `genre_families`, text-on-top tiles, color accents).
- `/g/:familySlug` — **Subgenres** (`SubgenreList` of that family's genres).
- `/s/:subgenreSlug` — **Songs** (`TrackList`, art + title/artist + duration +
  Spotify/Apple shortcuts).
- `/track/:itunesTrackId` — **deep link**: opens the app focused on a song and
  auto-loads it into the player (enables share links).

Player is **global** and persistent: a `MiniPlayer` docked above the tab bar that
expands to full `NowPlaying`. A small **player store** (Zustand or a context+
reducer) owns one `HTMLAudioElement`, the current track, queue (the subgenre's
tracks), and play state.

Data: read `genre_families` / `genres` / `tracks` from Supabase with the anon
client (RLS public read, already in place). Paginate reads defensively
(PostgREST 1000-row cap). Independent fetches run in parallel.

Components: `GenreGrid`, `GenreTile`, `SubgenreList`, `SubgenreRow`, `TrackList`,
`TrackRow`, `MiniPlayer`, `NowPlaying`, `ServiceLinks`, `ShareButton`, plus glass
UI primitives (`GlassSurface`, `GlassPill`, `IconButton`).

## Sharing in Fas 1

- `ShareButton` on `TrackRow` and `NowPlaying`: `navigator.share()` when
  available, else copy-link fallback, targeting `/track/:itunesTrackId`.
- This is the exact affordance Fas 2 upgrades into the TikTok-style
  send-to-a-friend-with-comment flow. Slot and stable id are reserved now.

## Design system

CSS custom-property tokens in `src/styles/tokens.css` (per web coding-style rules):

- Color: deep graphite/violet base, glass surfaces
  (`--glass-bg`, `--glass-stroke`, `--glass-blur`, `--glass-sat`), per-genre
  accent injected from the DB `color`.
- Type: system/SF stack, tight tracking on titles; **text always on the top
  layer, never beneath graphics**; tiles lead with the label.
- Space/radius/motion tokens; animate compositor-only properties
  (`transform`, `opacity`, `filter`); `font-display: swap`.
- Mobile-first; breakpoints 320/375/768/1024; no horizontal overflow.

## Playback & shortcuts

- One `HTMLAudioElement` in the player store; `preview_url` from iTunes.
- Apple Music shortcut = real `apple_music_url` (`trackViewUrl`).
- Spotify shortcut = `https://open.spotify.com/search/<encoded "artist track">`
  (deep link / search — no Spotify API or credentials, honoring "no Spotify
  integration").

## Verification (per project rules — empirical before ✅)

- `bun x tsc -b` green.
- `0003` migration pushed to remote; schema verified by query.
- `import-tracks.ts` dry-run report, then execute; verify against remote DB:
  track count, sample rows, `preview_url`/`artwork_url`/`apple_music_url`
  non-null, subgenre→track link counts, no orphans.
- Run the app; screenshot mobile breakpoints (320/375/768); confirm a preview
  actually plays and a `/track/:id` deep link opens the right song.

## Roadmap (updates docs/PHASES.md)

- **Fas 1** (this spec) — browse + player + share links.
- **Fas 2 — Social (the hook):** Sign in with Apple (Apple-only to start),
  friends, **send-a-song-with-a-comment to a friend like a TikTok**, **private
  comment threads** (song + chosen participants; never public), copy-link kept.
- **Fas 3** — deeper previews / additional service deep links / polish.
- **Fas 4** — PWA, performance, offline niceties.

## Decisions locked (do not re-litigate)

- Browse+player, **no map**. iTunes previews. Curated ~24-family taxonomy.
- Social is Fas 2; Apple sign-in first. Spotify = deep link only, never API.
- Store raw everynoise coords/colors; color used as accent.
