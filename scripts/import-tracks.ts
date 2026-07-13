/**
 * import-tracks.ts — fetch iTunes tracks per curated subgenre; upsert tracks +
 * subgenre_tracks links. bun; service role key from env.
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... bun scripts/import-tracks.ts [--execute]
 */
import { createClient } from '@supabase/supabase-js'
import { families } from './lib/taxonomy.ts'
import { slugify } from './lib/slug.ts'
import { buildSearchUrl, parseTracks, type RawTrack } from './lib/itunes.ts'

const PER_SUBGENRE = 30
// iTunes rate-limits ~20 requests/minute per IP. Stay under it with steady pacing
// (bursts get 403-blocked), rather than fast requests + retries on a blocked burst.
const THROTTLE_MS = 3000

function requireEnv(k: string): string {
  const v = process.env[k]
  if (!v) throw new Error(`Missing env var: ${k}`)
  return v
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// iTunes rate-limits bursts with 403/429. Retry those (and 5xx) with exponential
// backoff so a temporary throttle doesn't silently drop a subgenre's tracks.
// Returns a successful Response, a non-retryable Response, or null when every
// attempt failed (retryable status or a thrown network error). Never throws, so
// one flaky request can't crash the whole run.
async function fetchWithRetry(url: string, attempts = 5): Promise<Response | null> {
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return res
      if (res.status === 403 || res.status === 429 || res.status >= 500) {
        await sleep(800 * 2 ** i) // 0.8s, 1.6s, 3.2s, 6.4s, 12.8s
        continue
      }
      return res // non-retryable status
    } catch {
      await sleep(800 * 2 ** i) // network error — back off and retry
    }
  }
  return null
}

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
      const { data, error } = await supabase.from('genres').select('id').eq('slug', slugify(s.name)).limit(1)
      if (error) throw new Error(`subgenre lookup failed for "${s.name}": ${error.message}`)
      if (data && data.length) {
        targets.push({ genreId: (data[0] as { id: string }).id, term: s.searchTerm ?? s.name, name: s.name })
      }
    }
  }
  console.log(`[import-tracks] mode=${execute ? 'execute' : 'dry-run'} subgenres=${targets.length}`)

  const before = await countTracks()
  const trackByItunes = new Map<number, RawTrack>()
  const links: { name: string; ids: number[] }[] = []
  const failures: string[] = []
  for (const t of targets) {
    const res = await fetchWithRetry(buildSearchUrl(t.term, PER_SUBGENRE))
    if (!res || !res.ok) {
      console.error(`[import-tracks] iTunes fetch failed for "${t.name}": ${res ? `${res.status} ${res.statusText}` : 'network error'}`)
      failures.push(t.name)
      await sleep(THROTTLE_MS)
      continue
    }
    const rows = parseTracks(await res.json())
    for (const r of rows) trackByItunes.set(r.itunesTrackId, r)
    links.push({ name: t.name, ids: rows.map((r) => r.itunesTrackId) })
    await sleep(THROTTLE_MS) // be polite to the iTunes endpoint
  }
  if (failures.length) {
    console.error(`[import-tracks] WARNING: ${failures.length} subgenre fetch(es) failed: ${failures.join(', ')}`)
    process.exitCode = 1 // surface partial import; the run is idempotent, so re-run recovers
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

  // Map itunes_track_id -> tracks.id for link rows. Paginate: PostgREST caps
  // each response at 1000 rows, so a single select silently truncates.
  const idByItunes = new Map<number, string>()
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data: page, error: pe } = await supabase
      .from('tracks').select('id, itunes_track_id').not('itunes_track_id', 'is', null)
      .range(from, from + PAGE - 1)
    if (pe) throw new Error(`track id read failed: ${pe.message}`)
    if (!page || page.length === 0) break
    for (const r of page as { id: string; itunes_track_id: number }[]) idByItunes.set(r.itunes_track_id, r.id)
    if (page.length < PAGE) break
  }

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
