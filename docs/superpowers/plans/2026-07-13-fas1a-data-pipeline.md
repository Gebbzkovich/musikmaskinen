# Fas 1a — Data Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Populate the Musikmaskinen database with a curated genre→subgenre taxonomy and real iTunes tracks (art + preview + Apple Music link), verified against the remote DB.

**Architecture:** One migration adds the browse schema (`genre_families`, `genres.family_id`/`slug`, extended `tracks`, `subgenre_tracks`). A checked-in taxonomy module drives two idempotent `bun` scripts: `apply-taxonomy.ts` (seeds families, tags curated everynoise genres as subgenres) and `import-tracks.ts` (fetches tracks per subgenre from iTunes). Same dry-run/execute discipline as the existing `import-genres.ts`.

**Tech Stack:** Supabase (Postgres) via Supabase CLI migrations; TypeScript run with `bun`; `@supabase/supabase-js` (service role, from env); `bun test` for unit tests; iTunes Search API (no auth).

## Global Constraints

- Standalone project — no reference to Z-Profil / zprofil.se / Supabase `ltkumctoowadvqtdytvw`. This project's ref: `kqujhispsknyxcmpfdkl`.
- All DB changes via `supabase/migrations/` — never ad hoc DDL. Do NOT use the Supabase MCP tools (they point at the Z-Profil project); use the Supabase CLI with a **personal** `SUPABASE_ACCESS_TOKEN` (sbp_…) scoped per command + `SUPABASE_DB_PASSWORD`.
- Service-role key and all tokens come from env — NEVER hardcoded, NEVER committed.
- `bun x tsc -b` must be green before every commit.
- Deliverables count as done only after empirical verification against the real DB; report results.
- Scripts: one script, `--dry-run` (default) / `--execute`, batch upsert, idempotent, re-runnable. Dry-run writes nothing (assert count before == after).
- Work on branch `fas-1-browse-player`; feature branch → PR → Gustav merges.
- Never `git add -A`; stage explicit files.

---

### Task 1: Migration `0003_browse_schema.sql`

**Files:**
- Create: `supabase/migrations/0003_browse_schema.sql`

**Interfaces:**
- Produces: tables/columns `genre_families(id,name,slug,color,sort,created_at)`, `genres.family_id`, `genres.slug`, `tracks.itunes_track_id/artwork_url/preview_url/apple_music_url/duration_ms`, `subgenre_tracks(genre_id,track_id,rank)`; public-read RLS on `genre_families`, `subgenre_tracks`, `tracks`.

- [ ] **Step 1: Write the migration**

```sql
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
```

- [ ] **Step 2: Push to the remote DB**

Run (fill secrets from env you already hold this session; never write them to a file):
```bash
cd ~/dev/noisemap && printf 'Y\n' | env \
  SUPABASE_ACCESS_TOKEN="$SBP_TOKEN" SUPABASE_DB_PASSWORD="$DB_PASSWORD" \
  supabase db push
```
Expected: `Applying migration 0003_browse_schema.sql...` then `Finished supabase db push.`

- [ ] **Step 3: Verify schema on the remote DB**

Run (Management API; `$SBP_TOKEN` = personal sbp token):
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/kqujhispsknyxcmpfdkl/database/query" \
  -H "Authorization: Bearer $SBP_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select count(*) as families from genre_families; "}'
```
Then confirm columns exist:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/kqujhispsknyxcmpfdkl/database/query" \
  -H "Authorization: Bearer $SBP_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select column_name from information_schema.columns where table_name='"'"'tracks'"'"' and column_name in ('"'"'itunes_track_id'"'"','"'"'preview_url'"'"','"'"'apple_music_url'"'"');"}'
```
Expected: `families` = 0 (table exists, empty); the three track columns listed.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/noisemap && git add supabase/migrations/0003_browse_schema.sql
git -c commit.gpgsign=false commit -m "feat(db): 0003 browse schema — families, subgenres, track enrichment"
```

---

### Task 2: Taxonomy data module + validation test

**Files:**
- Create: `scripts/lib/taxonomy.ts`
- Create: `scripts/lib/slug.ts`
- Test: `scripts/lib/taxonomy.test.ts`

**Interfaces:**
- Produces: `slugify(name: string): string`; types `SubgenreSeed = { name: string; searchTerm?: string }`, `FamilySeed = { name: string; slug: string; color: string; sort: number; subgenres: SubgenreSeed[] }`; `export const families: FamilySeed[]`.
- Consumes: nothing.

- [ ] **Step 1: Write `slugify`**

Create `scripts/lib/slug.ts`:
```ts
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}
```

- [ ] **Step 2: Write the taxonomy module**

Create `scripts/lib/taxonomy.ts`. Names must be real everynoise genre names (they are matched against the `genres` table; unmatched ones are reported, not fatal). Colors are curated accents.
```ts
export interface SubgenreSeed {
  name: string
  searchTerm?: string // iTunes term override when the raw name is too broad
}

export interface FamilySeed {
  name: string
  slug: string
  color: string
  sort: number
  subgenres: SubgenreSeed[]
}

export const families: FamilySeed[] = [
  { name: 'Pop', slug: 'pop', color: '#da3d7f', sort: 1, subgenres: [
    { name: 'pop' }, { name: 'dance pop' }, { name: 'art pop' }, { name: 'indie pop' },
    { name: 'electropop' }, { name: 'swedish pop' }, { name: 'synthpop' }, { name: 'power pop' } ] },
  { name: 'Hip-Hop', slug: 'hip-hop', color: '#ce5d19', sort: 2, subgenres: [
    { name: 'hip hop' }, { name: 'rap' }, { name: 'trap' }, { name: 'conscious hip hop' },
    { name: 'drill' }, { name: 'boom bap' }, { name: 'cloud rap' } ] },
  { name: 'Latin', slug: 'latin', color: '#e04078', sort: 3, subgenres: [
    { name: 'reggaeton' }, { name: 'latin pop' }, { name: 'trap latino' }, { name: 'salsa' },
    { name: 'bachata' }, { name: 'cumbia' }, { name: 'latin hip hop' } ] },
  { name: 'Rock', slug: 'rock', color: '#b6503a', sort: 4, subgenres: [
    { name: 'rock' }, { name: 'classic rock' }, { name: 'alternative rock' }, { name: 'indie rock' },
    { name: 'hard rock' }, { name: 'garage rock' }, { name: 'psychedelic rock' } ] },
  { name: 'Metal', slug: 'metal', color: '#8f3b3b', sort: 5, subgenres: [
    { name: 'metal' }, { name: 'black metal' }, { name: 'death metal' }, { name: 'thrash metal' },
    { name: 'doom metal' }, { name: 'power metal' }, { name: 'metalcore' } ] },
  { name: 'Electronic', slug: 'electronic', color: '#7078bc', sort: 6, subgenres: [
    { name: 'house' }, { name: 'deep house' }, { name: 'techno' }, { name: 'trance' },
    { name: 'drum and bass' }, { name: 'dubstep' }, { name: 'synthwave' }, { name: 'edm' } ] },
  { name: 'Jazz', slug: 'jazz', color: '#568608', sort: 7, subgenres: [
    { name: 'jazz' }, { name: 'bebop' }, { name: 'cool jazz' }, { name: 'jazz fusion' },
    { name: 'vocal jazz' }, { name: 'smooth jazz' } ] },
  { name: 'R&B / Soul', slug: 'rnb-soul', color: '#a05fbf', sort: 8, subgenres: [
    { name: 'r&b', searchTerm: 'r&b' }, { name: 'soul' }, { name: 'neo soul' }, { name: 'funk' },
    { name: 'motown' }, { name: 'contemporary r&b', searchTerm: 'contemporary r&b' } ] },
  { name: 'Country', slug: 'country', color: '#c77a3a', sort: 9, subgenres: [
    { name: 'country' }, { name: 'contemporary country' }, { name: 'outlaw country' },
    { name: 'americana' }, { name: 'bluegrass' } ] },
  { name: 'Folk', slug: 'folk', color: '#7a9a2a', sort: 10, subgenres: [
    { name: 'folk' }, { name: 'indie folk' }, { name: 'folk rock' }, { name: 'singer-songwriter' } ] },
  { name: 'Classical', slug: 'classical', color: '#6f86c9', sort: 11, subgenres: [
    { name: 'classical' }, { name: 'baroque' }, { name: 'opera' }, { name: 'compositional ambient' },
    { name: 'orchestral soundtrack', searchTerm: 'orchestral' } ] },
  { name: 'Reggae', slug: 'reggae', color: '#3f9a4d', sort: 12, subgenres: [
    { name: 'reggae' }, { name: 'dancehall' }, { name: 'dub' }, { name: 'roots reggae' }, { name: 'ska' } ] },
  { name: 'Blues', slug: 'blues', color: '#698620', sort: 13, subgenres: [
    { name: 'blues' }, { name: 'delta blues' }, { name: 'electric blues' }, { name: 'blues rock' } ] },
  { name: 'Punk', slug: 'punk', color: '#c23b57', sort: 14, subgenres: [
    { name: 'punk' }, { name: 'pop punk' }, { name: 'hardcore punk' }, { name: 'post-punk' } ] },
  { name: 'Indie', slug: 'indie', color: '#5b9d0c', sort: 15, subgenres: [
    { name: 'indie' }, { name: 'indietronica' }, { name: 'dream pop' }, { name: 'shoegaze' },
    { name: 'bedroom pop' } ] },
  { name: 'K-Pop', slug: 'k-pop', color: '#e35fa0', sort: 16, subgenres: [
    { name: 'k-pop', searchTerm: 'k-pop' }, { name: 'k-rap', searchTerm: 'korean hip hop' },
    { name: 'korean r&b', searchTerm: 'korean r&b' } ] },
  { name: 'Afro', slug: 'afro', color: '#d09a1e', sort: 17, subgenres: [
    { name: 'afrobeats' }, { name: 'afropop' }, { name: 'amapiano' }, { name: 'afro house' } ] },
  { name: 'Ambient', slug: 'ambient', color: '#5aa0a8', sort: 18, subgenres: [
    { name: 'ambient' }, { name: 'dark ambient' }, { name: 'drone' }, { name: 'new age' } ] },
  { name: 'Funk / Disco', slug: 'funk-disco', color: '#c9820c', sort: 19, subgenres: [
    { name: 'disco' }, { name: 'funk' }, { name: 'nu disco' }, { name: 'boogie' } ] },
  { name: 'Gospel', slug: 'gospel', color: '#8a9a20', sort: 20, subgenres: [
    { name: 'gospel' }, { name: 'christian music', searchTerm: 'gospel' }, { name: 'worship' } ] },
  { name: 'Soundtrack', slug: 'soundtrack', color: '#6c6f86', sort: 21, subgenres: [
    { name: 'soundtrack' }, { name: 'video game music' }, { name: 'anime' }, { name: 'movie tunes', searchTerm: 'film score' } ] },
  { name: 'Nordic', slug: 'nordic', color: '#4f8fbf', sort: 22, subgenres: [
    { name: 'swedish pop' }, { name: 'swedish indie' }, { name: 'schlager' }, { name: 'svensk pop', searchTerm: 'svensk pop' } ] },
]
```

- [ ] **Step 3: Write the failing validation test**

Create `scripts/lib/taxonomy.test.ts`:
```ts
import { test, expect } from 'bun:test'
import { families } from './taxonomy'
import { slugify } from './slug'

test('family slugs are unique and non-empty', () => {
  const slugs = families.map((f) => f.slug)
  expect(new Set(slugs).size).toBe(slugs.length)
  for (const s of slugs) expect(s.length).toBeGreaterThan(0)
})

test('every family has at least 3 subgenres and a hex color', () => {
  for (const f of families) {
    expect(f.subgenres.length).toBeGreaterThanOrEqual(3)
    expect(f.color).toMatch(/^#[0-9a-fA-F]{6}$/)
  }
})

test('slugify normalizes names', () => {
  expect(slugify('Deep House')).toBe('deep-house')
  expect(slugify('R&B / Soul')).toBe('r-b-soul')
})
```

- [ ] **Step 4: Run the test**

Run: `cd ~/dev/noisemap && bun test scripts/lib/taxonomy.test.ts`
Expected: 3 pass. (If a name assertion fails, fix `taxonomy.ts`, not the test.)

- [ ] **Step 5: Commit**

```bash
cd ~/dev/noisemap && git add scripts/lib/slug.ts scripts/lib/taxonomy.ts scripts/lib/taxonomy.test.ts
git -c commit.gpgsign=false commit -m "feat(data): curated genre taxonomy + slugify + tests"
```

---

### Task 3: `apply-taxonomy.ts` — seed families, tag subgenres

**Files:**
- Create: `scripts/apply-taxonomy.ts`

**Interfaces:**
- Consumes: `families`, `slugify` (Task 2); env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: rows in `genre_families`; `genres.family_id` + `genres.slug` set for matched subgenres. Reports unmatched subgenre names.

- [ ] **Step 1: Write the script**

Create `scripts/apply-taxonomy.ts`:
```ts
/**
 * apply-taxonomy.ts — seed genre_families and tag curated everynoise genres as
 * subgenres (family_id + slug). Run with bun; service role key from env.
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/apply-taxonomy.ts [--execute]
 */
import { createClient } from '@supabase/supabase-js'
import { families } from './lib/taxonomy'
import { slugify } from './lib/slug'

function requireEnv(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env var: ${k}`)
  return v
}

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const familyRows = families.map((f) => ({ name: f.name, slug: f.slug, color: f.color, sort: f.sort }))
  console.log(`[apply-taxonomy] mode=${execute ? 'execute' : 'dry-run'} families=${familyRows.length}`)

  if (!execute) {
    let matched = 0
    const unmatched: string[] = []
    for (const f of families) {
      for (const s of f.subgenres) {
        const { data } = await supabase.from('genres').select('id').ilike('name', s.name).limit(1)
        if (data && data.length) matched++
        else unmatched.push(`${f.slug}:${s.name}`)
      }
    }
    console.log(`[apply-taxonomy] subgenres matched=${matched} unmatched=${unmatched.length}`)
    if (unmatched.length) console.log('  unmatched:', unmatched.join(', '))
    console.log('[apply-taxonomy] DRY RUN — nothing written.')
    return
  }

  // upsert families on slug
  const { error: fe } = await supabase.from('genre_families').upsert(familyRows, { onConflict: 'slug' })
  if (fe) throw new Error(`family upsert failed: ${fe.message}`)
  const { data: famAll, error: fq } = await supabase.from('genre_families').select('id, slug')
  if (fq || !famAll) throw new Error(`family read failed: ${fq?.message}`)
  const famBySlug = new Map(famAll.map((f) => [f.slug, f.id as string]))

  let tagged = 0
  const unmatched: string[] = []
  for (const f of families) {
    const familyId = famBySlug.get(f.slug)
    for (const s of f.subgenres) {
      const { data: g } = await supabase.from('genres').select('id, name').ilike('name', s.name).limit(1)
      if (!g || !g.length) { unmatched.push(`${f.slug}:${s.name}`); continue }
      const { error: ue } = await supabase.from('genres')
        .update({ family_id: familyId, slug: slugify(g[0].name as string) })
        .eq('id', g[0].id)
      if (ue) throw new Error(`tag failed for ${s.name}: ${ue.message}`)
      tagged++
    }
  }
  console.log(`[apply-taxonomy] EXECUTE done. families=${familyRows.length} subgenres_tagged=${tagged} unmatched=${unmatched.length}`)
  if (unmatched.length) console.log('  unmatched:', unmatched.join(', '))
}

main().catch((e: unknown) => { console.error('[apply-taxonomy] FAILED:', e instanceof Error ? e.message : String(e)); process.exit(1) })
```

- [ ] **Step 2: Typecheck**

`scripts` is already in `tsconfig.node.json` include (from Fas 0). Run:
`cd ~/dev/noisemap && bun x tsc -b`
Expected: EXIT 0.

- [ ] **Step 3: Dry-run against remote**

Run (env from this session; SUPABASE_URL = project URL, key = service role):
```bash
cd ~/dev/noisemap && env SUPABASE_URL="https://kqujhispsknyxcmpfdkl.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" bun scripts/apply-taxonomy.ts
```
Expected: prints matched/unmatched counts, "DRY RUN — nothing written." Note the unmatched list — if a name is wrong, fix `taxonomy.ts` and re-run dry-run until unmatched is small/acceptable.

- [ ] **Step 4: Execute**

```bash
cd ~/dev/noisemap && env SUPABASE_URL="https://kqujhispsknyxcmpfdkl.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" bun scripts/apply-taxonomy.ts --execute
```
Expected: `EXECUTE done. families=22 subgenres_tagged=<N> ...`

- [ ] **Step 5: Verify on remote**

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/kqujhispsknyxcmpfdkl/database/query" \
  -H "Authorization: Bearer $SBP_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select (select count(*) from genre_families) as families, (select count(*) from genres where family_id is not null) as tagged_subgenres;"}'
```
Expected: `families` = 22, `tagged_subgenres` > 100.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/noisemap && git add scripts/apply-taxonomy.ts
git -c commit.gpgsign=false commit -m "feat(data): apply-taxonomy — seed families, tag subgenres"
```

---

### Task 4: iTunes library + parse test

**Files:**
- Create: `scripts/lib/itunes.ts`
- Test: `scripts/lib/itunes.test.ts`

**Interfaces:**
- Produces: `interface RawTrack { itunesTrackId: number; artistName: string; trackName: string; artworkUrl: string; previewUrl: string; appleMusicUrl: string; durationMs: number }`; `buildSearchUrl(term: string, limit: number): string`; `parseTracks(json: unknown): RawTrack[]`.
- Consumes: nothing.

- [ ] **Step 1: Write the library**

Create `scripts/lib/itunes.ts`:
```ts
export interface RawTrack {
  itunesTrackId: number
  artistName: string
  trackName: string
  artworkUrl: string
  previewUrl: string
  appleMusicUrl: string
  durationMs: number
}

export function buildSearchUrl(term: string, limit: number): string {
  const q = new URLSearchParams({ term, media: 'music', entity: 'song', limit: String(limit) })
  return `https://itunes.apple.com/search?${q.toString()}`
}

interface ItunesResult {
  trackId?: number
  artistName?: string
  trackName?: string
  artworkUrl100?: string
  previewUrl?: string
  trackViewUrl?: string
  trackTimeMillis?: number
  kind?: string
}

export function parseTracks(json: unknown): RawTrack[] {
  const results = (json as { results?: ItunesResult[] })?.results
  if (!Array.isArray(results)) return []
  const out: RawTrack[] = []
  for (const r of results) {
    if (r.kind !== 'song') continue
    if (!r.trackId || !r.previewUrl || !r.artworkUrl100 || !r.trackViewUrl) continue
    out.push({
      itunesTrackId: r.trackId,
      artistName: r.artistName ?? '',
      trackName: r.trackName ?? '',
      artworkUrl: r.artworkUrl100.replace('100x100bb', '300x300bb'),
      previewUrl: r.previewUrl,
      appleMusicUrl: r.trackViewUrl,
      durationMs: r.trackTimeMillis ?? 0,
    })
  }
  return out
}
```

- [ ] **Step 2: Write the failing test**

Create `scripts/lib/itunes.test.ts`:
```ts
import { test, expect } from 'bun:test'
import { buildSearchUrl, parseTracks } from './itunes'

test('buildSearchUrl encodes term and params', () => {
  const url = buildSearchUrl('deep house', 25)
  expect(url).toContain('term=deep+house')
  expect(url).toContain('entity=song')
  expect(url).toContain('limit=25')
})

test('parseTracks keeps valid songs and upscales art', () => {
  const json = { results: [
    { kind: 'song', trackId: 1, artistName: 'A', trackName: 'T', artworkUrl100: 'x/100x100bb.jpg',
      previewUrl: 'p', trackViewUrl: 'v', trackTimeMillis: 180000 },
    { kind: 'song', trackId: 2, artistName: 'B', trackName: 'U', artworkUrl100: 'y/100x100bb.jpg' },
  ] }
  const rows = parseTracks(json)
  expect(rows.length).toBe(1)
  expect(rows[0].artworkUrl).toBe('x/300x300bb.jpg')
  expect(rows[0].appleMusicUrl).toBe('v')
})

test('parseTracks tolerates junk', () => {
  expect(parseTracks(null)).toEqual([])
  expect(parseTracks({})).toEqual([])
})
```

- [ ] **Step 3: Run — verify pass**

Run: `cd ~/dev/noisemap && bun test scripts/lib/itunes.test.ts`
Expected: 3 pass.

- [ ] **Step 4: Commit**

```bash
cd ~/dev/noisemap && git add scripts/lib/itunes.ts scripts/lib/itunes.test.ts
git -c commit.gpgsign=false commit -m "feat(data): iTunes search url + track parser + tests"
```

---

### Task 5: `import-tracks.ts` — ingest tracks per subgenre

**Files:**
- Create: `scripts/import-tracks.ts`

**Interfaces:**
- Consumes: `families`, `slugify` (Task 2); `buildSearchUrl`, `parseTracks`, `RawTrack` (Task 4); env `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- Produces: rows in `tracks` (upsert on `itunes_track_id`) and `subgenre_tracks` links.

- [ ] **Step 1: Write the script**

Create `scripts/import-tracks.ts`:
```ts
/**
 * import-tracks.ts — fetch iTunes tracks per curated subgenre; upsert tracks +
 * subgenre_tracks links. bun; service role key from env.
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/import-tracks.ts [--execute]
 */
import { createClient } from '@supabase/supabase-js'
import { families } from './lib/taxonomy'
import { slugify } from './lib/slug'
import { buildSearchUrl, parseTracks, type RawTrack } from './lib/itunes'

const PER_SUBGENRE = 30

function requireEnv(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env var: ${k}`)
  return v
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function main(): Promise<void> {
  const execute = process.argv.includes('--execute')
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })

  const countTracks = async (): Promise<number> => {
    const { count, error } = await supabase.from('tracks').select('*', { count: 'exact', head: true })
    if (error) throw new Error(`count failed: ${error.message}`)
    return count ?? 0
  }

  // Resolve each subgenre to its genre_id via slug (set by apply-taxonomy).
  const targets: { genreId: string; term: string; name: string }[] = []
  for (const f of families) {
    for (const s of f.subgenres) {
      const slug = slugify(s.name)
      const { data } = await supabase.from('genres').select('id').eq('slug', slug).limit(1)
      if (data && data.length) targets.push({ genreId: data[0].id as string, term: s.searchTerm ?? s.name, name: s.name })
    }
  }
  console.log(`[import-tracks] mode=${execute ? 'execute' : 'dry-run'} subgenres=${targets.length}`)

  const before = await countTracks()
  const trackByItunes = new Map<number, RawTrack>()
  const links: { name: string; ids: number[] }[] = []
  for (const t of targets) {
    const res = await fetch(buildSearchUrl(t.term, PER_SUBGENRE))
    const rows = res.ok ? parseTracks(await res.json()) : []
    for (const r of rows) trackByItunes.set(r.itunesTrackId, r)
    links.push({ name: t.name, ids: rows.map((r) => r.itunesTrackId) })
    await sleep(200) // be polite to the iTunes endpoint
  }
  console.log(`[import-tracks] fetched unique tracks=${trackByItunes.size} across ${targets.length} subgenres`)
  console.log('[import-tracks] sample:', [...trackByItunes.values()].slice(0, 5).map((r) => `${r.trackName} — ${r.artistName}`).join(' | '))

  if (!execute) {
    const after = await countTracks()
    console.log(`[import-tracks] dry-run tracks count before=${before} after=${after}`)
    if (before !== after) throw new Error('dry-run mutated tracks')
    console.log('[import-tracks] DRY RUN — nothing written.')
    return
  }

  // Upsert tracks in batches of 500 (on itunes_track_id).
  const allTracks = [...trackByItunes.values()].map((r) => ({
    artist_name: r.artistName, track_name: r.trackName, itunes_track_id: r.itunesTrackId,
    artwork_url: r.artworkUrl, preview_url: r.previewUrl, apple_music_url: r.appleMusicUrl, duration_ms: r.durationMs,
  }))
  for (let i = 0; i < allTracks.length; i += 500) {
    const { error } = await supabase.from('tracks').upsert(allTracks.slice(i, i + 500), { onConflict: 'itunes_track_id' })
    if (error) throw new Error(`track upsert failed at ${i}: ${error.message}`)
  }

  // Map itunes_track_id -> tracks.id for link rows.
  const { data: idRows, error: ie } = await supabase.from('tracks').select('id, itunes_track_id').not('itunes_track_id', 'is', null)
  if (ie || !idRows) throw new Error(`track id read failed: ${ie?.message}`)
  const idByItunes = new Map<number, string>(idRows.map((r) => [r.itunes_track_id as number, r.id as string]))

  const linkRows: { genre_id: string; track_id: string; rank: number }[] = []
  for (const t of targets) {
    const l = links.find((x) => x.name === t.name)
    if (!l) continue
    l.ids.forEach((itid, rank) => {
      const tid = idByItunes.get(itid)
      if (tid) linkRows.push({ genre_id: t.genreId, track_id: tid, rank })
    })
  }
  for (let i = 0; i < linkRows.length; i += 500) {
    const { error } = await supabase.from('subgenre_tracks').upsert(linkRows.slice(i, i + 500), { onConflict: 'genre_id,track_id' })
    if (error) throw new Error(`link upsert failed at ${i}: ${error.message}`)
  }

  const total = await countTracks()
  console.log(`[import-tracks] EXECUTE done. tracks=${total} links=${linkRows.length}`)
}

main().catch((e: unknown) => { console.error('[import-tracks] FAILED:', e instanceof Error ? e.message : String(e)); process.exit(1) })
```

- [ ] **Step 2: Typecheck**

Run: `cd ~/dev/noisemap && bun x tsc -b`
Expected: EXIT 0.

- [ ] **Step 3: Dry-run**

```bash
cd ~/dev/noisemap && env SUPABASE_URL="https://kqujhispsknyxcmpfdkl.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" bun scripts/import-tracks.ts
```
Expected: prints subgenre count, unique-track count, sample; "dry-run tracks count before=0 after=0"; "DRY RUN — nothing written."

- [ ] **Step 4: Execute**

```bash
cd ~/dev/noisemap && env SUPABASE_URL="https://kqujhispsknyxcmpfdkl.supabase.co" \
  SUPABASE_SERVICE_ROLE_KEY="$SERVICE_ROLE_KEY" bun scripts/import-tracks.ts --execute
```
Expected: `EXECUTE done. tracks=<N> links=<M>` with N in the thousands, M ≥ N.

- [ ] **Step 5: Idempotency re-run**

Re-run Step 4. Expected: `tracks` count roughly unchanged, no errors.

- [ ] **Step 6: Commit**

```bash
cd ~/dev/noisemap && git add scripts/import-tracks.ts
git -c commit.gpgsign=false commit -m "feat(data): import-tracks — iTunes ingestion + subgenre links"
```

---

### Task 6: Data-pipeline verification + docs + PR

**Files:**
- Modify: `docs/PHASES.md`

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Empirical verification queries**

Run and record verbatim:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/kqujhispsknyxcmpfdkl/database/query" \
  -H "Authorization: Bearer $SBP_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select (select count(*) from genre_families) families, (select count(*) from genres where family_id is not null) subgenres, (select count(*) from tracks where preview_url is not null) tracks_with_preview, (select count(*) from subgenre_tracks) links, (select count(*) from tracks where artwork_url is null or preview_url is null or apple_music_url is null) bad_tracks;"}'
```
Expected: families=22, subgenres>100, tracks_with_preview in the thousands, links ≥ tracks, bad_tracks=0.

Sample join (readable spot-check):
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/kqujhispsknyxcmpfdkl/database/query" \
  -H "Authorization: Bearer $SBP_TOKEN" -H "Content-Type: application/json" \
  -d '{"query":"select gf.name family, g.name subgenre, t.track_name, t.artist_name from subgenre_tracks st join genres g on g.id=st.genre_id join genre_families gf on gf.id=g.family_id join tracks t on t.id=st.track_id order by random() limit 5;"}'
```
Expected: 5 rows tying family → subgenre → real track.

- [ ] **Step 2: Update `docs/PHASES.md`**

Replace the Fas 1 block to reflect the pivot:
```markdown
## Fas 1 — Bläddrare + spelare

Genre → subgenre → låtar → glas-spelare. Kartan är SLOPAD; everynoise-datat är
taxonomi + färg. **Fas 1a (data):** migration 0003 (genre_families, genres.family_id/slug,
tracks-berikning, subgenre_tracks) + apply-taxonomy + import-tracks (iTunes: omslag,
30s-preview, Apple Music-länk). **Fas 1b (app):** React browse+player, delningslänkar.

## Fas 2 — Social (kärnan)

Sign in with Apple (endast Apple först), vänner, dela låt + kommentar till en vän
precis som en TikTok, privata kommentarstrådar (aldrig publikt), kopiera-länk.
```

- [ ] **Step 3: Typecheck + tests green**

Run: `cd ~/dev/noisemap && bun x tsc -b && bun test scripts`
Expected: tsc EXIT 0; all tests pass.

- [ ] **Step 4: Commit + push + open PR**

```bash
cd ~/dev/noisemap && git add docs/PHASES.md
git -c commit.gpgsign=false commit -m "docs: PHASES reflects browse+player pivot (Fas 1a/1b, Fas 2 social)"
GEBBZ_PAT="$GEBBZ_PAT" git -c credential.helper= \
  -c credential.helper='!f(){ echo username=Gebbzkovich; echo "password=$GEBBZ_PAT"; }; f' \
  push -u origin fas-1-browse-player
```
Then open a PR via the GitHub API (body includes the Step 1 verification output) targeting `main`; report the PR URL.

---

## Self-Review

**Spec coverage:** migration 0003 (schema) ✓ Task 1; curated taxonomy ✓ Task 2; family_id tagging ✓ Task 3; iTunes ingestion with tuned terms + stable ids ✓ Tasks 4–5; RLS public read ✓ Task 1; empirical verification ✓ Task 6. App architecture / player / UI / share links / design system are **out of scope for 1a** — they are Plan 1b (documented in the spec, next plan).

**Placeholder scan:** no TBD/TODO; every code step has full code; verification commands have expected outputs. Secrets referenced via env vars (`$SBP_TOKEN`, `$DB_PASSWORD`, `$SERVICE_ROLE_KEY`, `$GEBBZ_PAT`) — the executor supplies them; none hardcoded.

**Type consistency:** `RawTrack` defined in Task 4 and consumed in Task 5; `families`/`slugify` from Task 2 used in Tasks 3 & 5; `genres.slug` written in Task 3 and read in Task 5; `subgenre_tracks(genre_id,track_id,rank)` created in Task 1 and written in Task 5. Consistent.
